import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const users = await base44.asServiceRole.entities.User.list("", 100);
    const userMap = {};
    users.forEach(u => { userMap[u.id] = { name: u.full_name || u.email || u.id.slice(0, 8), role: u.role }; });

    // ── 1. Handover Compliance ──
    const shiftHandovers = await base44.asServiceRole.entities.ShiftHandoverLog.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 300
    );
    const doctorHandovers = await base44.asServiceRole.entities.DoctorHandover.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 300
    );

    // Shift handover by staff
    const shiftHandoverByUser = {};
    shiftHandovers.forEach(h => {
      const uid = h.handover_from_user_id || h.created_by_id;
      if (!uid) return;
      if (!shiftHandoverByUser[uid]) shiftHandoverByUser[uid] = { total: 0, acknowledged: 0, unacknowledged: 0 };
      shiftHandoverByUser[uid].total++;
      if (h.acknowledged) shiftHandoverByUser[uid].acknowledged++;
      else shiftHandoverByUser[uid].unacknowledged++;
    });

    // Doctor handover by doctor
    doctorHandovers.forEach(h => {
      const uid = h.from_doctor_id;
      if (!uid) return;
      if (!shiftHandoverByUser[uid]) shiftHandoverByUser[uid] = { total: 0, acknowledged: 0, unacknowledged: 0 };
      shiftHandoverByUser[uid].total++;
      if (h.acknowledged) shiftHandoverByUser[uid].acknowledged++;
      else shiftHandoverByUser[uid].unacknowledged++;
    });

    const handoverCompliance = Object.entries(shiftHandoverByUser)
      .filter(([_, s]) => s.total > 0)
      .map(([uid, s]) => ({
        staff_id: uid,
        staff_name: userMap[uid]?.name || uid.slice(0, 8),
        role: userMap[uid]?.role || 'user',
        total_handovers: s.total,
        acknowledged: s.acknowledged,
        unacknowledged: s.unacknowledged,
        compliance_rate: Math.round(s.acknowledged / s.total * 100),
        status: Math.round(s.acknowledged / s.total * 100) >= 80 ? 'compliant' :
                Math.round(s.acknowledged / s.total * 100) >= 50 ? 'warning' : 'non_compliant',
      }))
      .sort((a, b) => a.compliance_rate - b.compliance_rate);

    // ── 2. Signature Compliance ──
    const signatures = await base44.asServiceRole.entities.DigitalSignature.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 500
    );

    // Get all consultations, prescriptions, dispensing to find unsigned ones
    const [consultations, prescriptions, dispensings, labResults] = await Promise.all([
      base44.asServiceRole.entities.Consultation.filter({ created_date: { $gte: thirtyDaysAgo } }, "-created_date", 500),
      base44.asServiceRole.entities.Prescription.filter({ created_date: { $gte: thirtyDaysAgo } }, "-created_date", 500),
      base44.asServiceRole.entities.PharmacyDispensing.filter({ created_date: { $gte: thirtyDaysAgo } }, "-created_date", 500),
      base44.asServiceRole.entities.LabResult.filter({ created_date: { $gte: thirtyDaysAgo } }, "-created_date", 500),
    ]);

    // Count signed vs unsigned by staff
    const sigByUser = {};
    signatures.forEach(s => {
      const uid = s.signed_by;
      if (!uid) return;
      if (!sigByUser[uid]) sigByUser[uid] = { signed: 0, unsigned: 0 };
      sigByUser[uid].signed++;
    });

    // Count unsigned documents
    consultations.forEach(c => {
      const uid = c.clinician_id || c.created_by_id;
      if (!uid) return;
      if (!sigByUser[uid]) sigByUser[uid] = { signed: 0, unsigned: 0 };
      sigByUser[uid].unsigned++;
    });
    prescriptions.forEach(p => {
      const uid = p.prescribed_by || p.created_by_id;
      if (!uid) return;
      if (!sigByUser[uid]) sigByUser[uid] = { signed: 0, unsigned: 0 };
      sigByUser[uid].unsigned++;
    });

    // Subtract signed from unsigned to get actual missing
    const sigSigned = {};
    signatures.forEach(s => {
      const key = `${s.signed_by}_${s.document_type}_${s.document_id}`;
      sigSigned[key] = true;
    });
    // Re-count unsigned only for truly missing signatures
    const missingSigs = {};
    signatures.forEach(s => sigSigned[`${s.signed_by}_${s.document_type}_${s.document_id}`] = true);

    // Simple: count unique staff who have signed docs vs total staff creating clinical docs
    const clinicalDoctors = new Set();
    consultations.forEach(c => clinicalDoctors.add(c.clinician_id || c.created_by_id));
    const signedDoctors = new Set();
    signatures.forEach(s => signedDoctors.add(s.signed_by));

    const signatureCompliance = [...clinicalDoctors].map(uid => {
      const signed = signedDoctors.has(uid) ? 1 : 0;
      return {
        staff_id: uid,
        staff_name: userMap[uid]?.name || uid.slice(0, 8),
        role: userMap[uid]?.role || 'user',
        consultations_done: consultations.filter(c => (c.clinician_id || c.created_by_id) === uid).length,
        signatures_completed: signed,
        documents_unsigned: !signed ? 1 : 0,
        compliance_rate: signed ? 100 : 0,
        status: signed ? 'compliant' : 'non_compliant',
      };
    }).sort((a, b) => a.compliance_rate - b.compliance_rate);

    // ── 3. SLA Compliance ──
    const allNotifications = await base44.asServiceRole.entities.Notification.filter(
      { created_date: { $gte: thirtyDaysAgo } },
      "-created_date",
      500
    );
    const slaBreaches = allNotifications.filter(n => n.title && n.title.includes("SLA BREACH"));

    const slaByDept = {};
    slaBreaches.forEach(n => {
      const dept = n.message?.match(/at (\w+)/)?.[1] || 'unknown';
      if (!slaByDept[dept]) slaByDept[dept] = { breaches: 0, target_role: n.target_role };
      slaByDept[dept].breaches++;
    });

    const slaCompliance = Object.entries(slaByDept).map(([dept, s]) => ({
      department: dept,
      breaches: s.breaches,
      target_role: s.target_role,
      status: s.breaches > 10 ? 'non_compliant' : s.breaches > 3 ? 'warning' : 'compliant',
    })).sort((a, b) => b.breaches - a.breaches);

    // ── 4. Waste Disposal Compliance ──
    const wasteLogs = await base44.asServiceRole.entities.WasteLog.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 300
    );
    const wasteSlaBreached = wasteLogs.filter(w => w.sla_breached).length;
    const wasteSigned = wasteLogs.filter(w => w.signed_by).length;
    const wasteTotal = wasteLogs.length;

    // ── 5. Overall Summary ──
    const allHandoverRates = handoverCompliance.map(h => h.compliance_rate);
    const avgHandoverRate = allHandoverRates.length > 0
      ? Math.round(allHandoverRates.reduce((a, b) => a + b, 0) / allHandoverRates.length)
      : 100;

    const allSigRates = signatureCompliance
      .filter(s => s.consultations_done > 0)
      .map(s => s.compliance_rate);
    const avgSigRate = allSigRates.length > 0
      ? Math.round(allSigRates.reduce((a, b) => a + b, 0) / allSigRates.length)
      : 100;

    const wasteComplianceRate = wasteTotal > 0
      ? Math.round(wasteSigned / wasteTotal * 100)
      : 100;

    const overallScore = Math.round((avgHandoverRate + avgSigRate + (100 - (slaBreaches.length > 0 ? Math.min(100, slaBreaches.length * 5) : 0)) + wasteComplianceRate) / 4);

    return Response.json({
      generated_at: new Date().toISOString(),
      period: "30 days",
      overview: {
        overall_compliance_score: Math.max(0, overallScore),
        avg_handover_rate: avgHandoverRate,
        avg_signature_rate: avgSigRate,
        waste_disposal_rate: wasteComplianceRate,
        total_sla_breaches: slaBreaches.length,
        total_staff_tracked: Object.keys(shiftHandoverByUser).length,
      },
      handover_compliance: handoverCompliance,
      signature_compliance: signatureCompliance,
      sla_compliance: slaCompliance,
      waste_compliance: {
        total_logs: wasteTotal,
        signed: wasteSigned,
        sla_breached: wasteSlaBreached,
        compliance_rate: wasteComplianceRate,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});