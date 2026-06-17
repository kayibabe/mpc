import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const users = await base44.asServiceRole.entities.User.list("", 100);
    const userMap = {};
    users.forEach(u => { userMap[u.id] = { name: u.full_name || u.email || u.id.slice(0, 8), role: u.role }; });

    // ── Consultations ──
    const allConsults = await base44.asServiceRole.entities.Consultation.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 1000
    );

    // ── Prescriptions ──
    const allPrescriptions = await base44.asServiceRole.entities.Prescription.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 1000
    );

    // ── Diagnoses ──
    const allDiagnoses = await base44.asServiceRole.entities.Diagnosis.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 1000
    );

    // ── Lab Orders ──
    const allLabOrders = await base44.asServiceRole.entities.LabOrder.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 1000
    );

    // ── Imaging Orders ──
    const allImagingOrders = await base44.asServiceRole.entities.ImagingOrder.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 1000
    );

    // ── Admissions ──
    const allAdmissions = await base44.asServiceRole.entities.Admission.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 500
    );

    // ── Discharges ──
    const allDischarges = await base44.asServiceRole.entities.Discharge.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 500
    );

    // ── Signatures ──
    const allSignatures = await base44.asServiceRole.entities.DigitalSignature.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 1000
    );

    // ── Doctor Handovers ──
    const allDoctorHandovers = await base44.asServiceRole.entities.DoctorHandover.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 300
    );

    // ── Patient Journeys for wait time analysis ──
    const journeys = await base44.asServiceRole.entities.PatientJourney.filter(
      { created_date: { $gte: thirtyDaysAgo } }, "-created_date", 500
    );

    // ── Diagnosis distribution ──
    const diagnosisCounts = {};
    allDiagnoses.forEach(d => {
      const name = (d.diagnosis_name || d.name || "Unknown").trim();
      if (name) diagnosisCounts[name] = (diagnosisCounts[name] || 0) + 1;
    });
    const topDiagnoses = Object.entries(diagnosisCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // ── Build per-physician metrics ──
    const physicianIds = new Set();
    allConsults.forEach(c => physicianIds.add(c.clinician_id || c.created_by_id));
    allPrescriptions.forEach(p => physicianIds.add(p.prescribed_by || p.created_by_id));
    allAdmissions.forEach(a => physicianIds.add(a.admitting_doctor_id));

    const physicians = [];
    physicianIds.forEach(pid => {
      if (!pid) return;
      const name = userMap[pid]?.name || pid.slice(0, 8);

      // Consultations
      const consults = allConsults.filter(c => (c.clinician_id || c.created_by_id) === pid);
      const consultsToday = consults.filter(c => c.created_date?.startsWith(today));
      const consultsLast7 = consults.filter(c => new Date(c.created_date) >= new Date(sevenDaysAgo));

      // Prescriptions
      const rx = allPrescriptions.filter(p => (p.prescribed_by || p.created_by_id) === pid);

      // Diagnoses
      const dx = allDiagnoses.filter(d => d.created_by_id === pid);

      // Lab orders
      const labOrders = allLabOrders.filter(l => (l.ordered_by || l.created_by_id) === pid);

      // Imaging
      const imagingOrders = allImagingOrders.filter(i => (i.ordered_by || i.created_by_id) === pid);

      // Admissions
      const admissions = allAdmissions.filter(a => a.admitting_doctor_id === pid);
      const activeAdmissions = admissions.filter(a => a.status === "admitted");

      // Discharges
      const discharges = allDischarges.filter(d => d.created_by_id === pid);

      // Signatures
      const sigs = allSignatures.filter(s => s.signed_by === pid);
      const signedConsultIds = new Set(sigs.filter(s => s.document_type === "consultation").map(s => s.document_id));
      const unsignedConsults = consults.filter(c => !signedConsultIds.has(c.id)).length;

      // Handovers
      const handovers = allDoctorHandovers.filter(h => h.from_doctor_id === pid || h.created_by_id === pid);
      const handoversAcknowledged = allDoctorHandovers.filter(h =>
        (h.from_doctor_id === pid || h.created_by_id === pid) && h.acknowledged
      );

      // ── Wait time analysis ──
      const consultPatientIds = new Set(consults.map(c => c.patient_id));
      const patientJourneys = journeys.filter(j => consultPatientIds.has(j.patient_id));

      let totalWaitMinutes = 0;
      let waitCount = 0;
      let longestWait = 0;

      patientJourneys.forEach(j => {
        try {
          const history = j.stage_history ? JSON.parse(j.stage_history) : [];
          const triageEntry = history.find(h => h.to === "TRIAGE");
          const consultEntry = history.find(h => h.to === "CONSULTATION");
          if (triageEntry && consultEntry) {
            const triageTime = new Date(triageEntry.timestamp);
            const consultTime = new Date(consultEntry.timestamp);
            const wait = (consultTime - triageTime) / 60000;
            if (wait > 0 && wait < 1440) {
              totalWaitMinutes += wait;
              waitCount++;
              if (wait > longestWait) longestWait = wait;
            }
          }
        } catch (_) {}
      });

      const avgWaitMinutes = waitCount > 0 ? Math.round(totalWaitMinutes / waitCount) : 0;

      // Averages
      const avgDxPerConsult = consults.length > 0
        ? Math.round((dx.length / consults.length) * 10) / 10 : 0;
      const avgRxPerConsult = consults.length > 0
        ? Math.round((rx.length / consults.length) * 10) / 10 : 0;
      const labRate = consults.length > 0
        ? Math.round((labOrders.length / consults.length) * 100) : 0;
      const sigCompliance = consults.length > 0
        ? Math.round((signedConsultIds.size / consults.length) * 100) : 100;
      const handoverCompliance = handovers.length > 0
        ? Math.round((handoversAcknowledged.length / handovers.length) * 100) : 100;
      const avgConsultsPerDay = Math.round(consultsLast7.length / 7 * 10) / 10;

      // Overall efficiency score
      const efficiencyScore = Math.round(
        (sigCompliance * 0.3) +
        (handoverCompliance * 0.2) +
        (Math.min(100, avgConsultsPerDay * 10) * 0.25) +
        (labRate <= 50 ? 100 : Math.max(0, 100 - (labRate - 50) * 2)) * 0.25
      );

      physicians.push({
        id: pid,
        name,
        role: userMap[pid]?.role || 'user',
        consultations: {
          total: consults.length,
          today: consultsToday.length,
          last_7_days: consultsLast7.length,
          avg_per_day: avgConsultsPerDay,
        },
        prescriptions: {
          total: rx.length,
          avg_per_consult: avgRxPerConsult,
        },
        diagnoses: {
          total: dx.length,
          avg_per_consult: avgDxPerConsult,
        },
        investigations: {
          lab_orders: labOrders.length,
          imaging_orders: imagingOrders.length,
          lab_investigation_rate: labRate,
        },
        admissions: {
          total: admissions.length,
          active: activeAdmissions.length,
        },
        discharges: discharges.length,
        wait_time: {
          avg_minutes: avgWaitMinutes,
          longest_minutes: Math.round(longestWait),
          tracked_visits: waitCount,
        },
        compliance: {
          signature_rate: sigCompliance,
          unsigned_consults: unsignedConsults,
          handover_rate: handoverCompliance,
          total_handovers: handovers.length,
        },
        efficiency_score: efficiencyScore,
      });
    });

    physicians.sort((a, b) => b.consultations.total - a.consultations.total);

    // ── Summary metrics ──
    const totalConsults = allConsults.length;
    const totalPrescriptions = allPrescriptions.length;
    const totalDiagnoses = allDiagnoses.length;
    const totalLabOrders = allLabOrders.length;
    const totalImagingOrders = allImagingOrders.length;
    const totalAdmissions = allAdmissions.length;
    const totalDischarges = allDischarges.length;
    const totalSignatures = allSignatures.length;
    const activePhysicians = physicians.length;

    // Overall clinic avg wait time
    const avgClinicWait = physicians.length > 0
      ? Math.round(physicians.reduce((s, p) => s + p.wait_time.avg_minutes, 0) / physicians.filter(p => p.wait_time.avg_minutes > 0).length || physicians.length)
      : 0;

    // ── Weekly trend ──
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      dailyTrend.push({
        date: d,
        consultations: allConsults.filter(c => c.created_date?.startsWith(d)).length,
        prescriptions: allPrescriptions.filter(p => p.created_date?.startsWith(d)).length,
        admissions: allAdmissions.filter(a => a.created_date?.startsWith(d)).length,
        discharges: allDischarges.filter(dc => dc.created_date?.startsWith(d)).length,
      });
    }

    // ── Top physicians by efficiency ──
    const topByEfficiency = [...physicians]
      .filter(p => p.consultations.total >= 3)
      .sort((a, b) => b.efficiency_score - a.efficiency_score)
      .slice(0, 5);

    return Response.json({
      generated_at: new Date().toISOString(),
      period: "30 days",
      summary: {
        active_physicians: activePhysicians,
        total_consultations: totalConsults,
        total_prescriptions: totalPrescriptions,
        total_diagnoses: totalDiagnoses,
        total_lab_orders: totalLabOrders,
        total_imaging_orders: totalImagingOrders,
        total_admissions: totalAdmissions,
        total_discharges: totalDischarges,
        total_signatures: totalSignatures,
        avg_consultations_per_physician: activePhysicians > 0 ? Math.round(totalConsults / activePhysicians) : 0,
        avg_clinic_wait_minutes: avgClinicWait,
      },
      daily_trend: dailyTrend,
      physicians,
      top_by_efficiency: topByEfficiency,
      top_diagnoses: topDiagnoses,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});