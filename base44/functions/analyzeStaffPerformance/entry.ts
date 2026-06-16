import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const users = await base44.asServiceRole.entities.User.list("", 100);
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.full_name || u.email || u.id.slice(0, 8); });

    // ── Consultations per doctor ──
    const consultations = await base44.asServiceRole.entities.Consultation.filter(
      { created_date: { $gte: thirtyDaysAgo } },
      "-created_date",
      500
    );
    const doctorStats = {};
    consultations.forEach(c => {
      const docId = c.clinician_id || c.created_by_id;
      if (!docId) return;
      if (!doctorStats[docId]) doctorStats[docId] = { consultations: 0, diagnoses: 0, prescriptions: 0, lab_orders: 0 };
      doctorStats[docId].consultations++;
    });
    const doctorPerformance = Object.entries(doctorStats)
      .map(([id, s]) => ({ name: userMap[id] || id.slice(0, 8), ...s, avg_per_day: Math.round(s.consultations / 30 * 10) / 10 }))
      .sort((a, b) => b.consultations - a.consultations);

    // ── Lab orders processed per technician ──
    const labOrders = await base44.asServiceRole.entities.LabOrder.filter(
      { created_date: { $gte: thirtyDaysAgo } },
      "-created_date",
      500
    );
    const labResults = await base44.asServiceRole.entities.LabResult.filter(
      { created_date: { $gte: thirtyDaysAgo } },
      "-created_date",
      500
    );
    const labTechStats = {};
    labOrders.forEach(o => {
      const techId = o.ordered_by;
      if (!techId) return;
      if (!labTechStats[techId]) labTechStats[techId] = { orders: 0, results: 0, turnaround_minutes: [] };
      labTechStats[techId].orders++;
    });
    labResults.forEach(r => {
      const order = labOrders.find(o => o.id === r.lab_order_id);
      const techId = r.verified_by || r.reported_by || (order ? order.ordered_by : null);
      if (!techId) return;
      if (!labTechStats[techId]) labTechStats[techId] = { orders: 0, results: 0, turnaround_minutes: [] };
      labTechStats[techId].results++;
      if (order && r.reported_date) {
        const tat = (new Date(r.reported_date) - new Date(order.created_date)) / 60000;
        if (tat > 0 && tat < 10080) labTechStats[techId].turnaround_minutes.push(tat);
      }
    });
    const labPerformance = Object.entries(labTechStats)
      .map(([id, s]) => ({
        name: userMap[id] || id.slice(0, 8),
        orders: s.orders,
        results: s.results,
        avg_turnaround_min: s.turnaround_minutes.length > 0
          ? Math.round(s.turnaround_minutes.reduce((a, b) => a + b, 0) / s.turnaround_minutes.length)
          : null,
      }))
      .sort((a, b) => b.results - a.results);

    // ── Pharmacy dispensing per pharmacist ──
    const dispensings = await base44.asServiceRole.entities.PharmacyDispensing.filter(
      { created_date: { $gte: thirtyDaysAgo } },
      "-created_date",
      500
    );
    const pharmacistStats = {};
    dispensings.forEach(d => {
      const pharmId = d.dispensed_by;
      if (!pharmId) return;
      if (!pharmacistStats[pharmId]) pharmacistStats[pharmId] = { items: 0, patients: new Set() };
      pharmacistStats[pharmId].items += d.quantity_dispensed || 1;
      if (d.patient_id) pharmacistStats[pharmId].patients.add(d.patient_id);
    });
    const pharmacyPerformance = Object.entries(pharmacistStats)
      .map(([id, s]) => ({
        name: userMap[id] || id.slice(0, 8),
        items_dispensed: s.items,
        unique_patients: s.patients.size,
      }))
      .sort((a, b) => b.items_dispensed - a.items_dispensed);

    // ── Shift handover compliance ──
    const shiftHandovers = await base44.asServiceRole.entities.ShiftHandoverLog.filter(
      { created_date: { $gte: thirtyDaysAgo } },
      "-created_date",
      200
    );
    const handoverTotal = shiftHandovers.length;
    const handoverAcknowledged = shiftHandovers.filter(h => h.acknowledged).length;
    const handoverCompliance = handoverTotal > 0 ? Math.round(handoverAcknowledged / handoverTotal * 100) : 100;

    // ── Wait time by department (from PatientJourney stage history) ──
    const journeys = await base44.asServiceRole.entities.PatientJourney.filter(
      { created_date: { $gte: thirtyDaysAgo } },
      "-created_date",
      200
    );
    const deptWaitTimes = {};
    journeys.forEach(j => {
      if (!j.stage_history) return;
      try {
        const history = JSON.parse(j.stage_history);
        for (let i = 0; i < history.length - 1; i++) {
          const entry = history[i];
          const nextEntry = history[i + 1];
          const stage = entry.to;
          if (!stage || stage === "COMPLETED") continue;
          const stageStart = new Date(entry.timestamp);
          const stageEnd = new Date(nextEntry.timestamp);
          const minutes = (stageEnd - stageStart) / 60000;
          if (minutes < 0 || minutes > 1440) continue;
          if (!deptWaitTimes[stage]) deptWaitTimes[stage] = { total: 0, count: 0 };
          deptWaitTimes[stage].total += minutes;
          deptWaitTimes[stage].count++;
        }
      } catch (_) {}
    });
    const departmentWaitTimes = Object.entries(deptWaitTimes)
      .map(([stage, data]) => ({
        department: stage.replace(/_/g, " "),
        avg_wait_minutes: Math.round(data.total / data.count),
        patients_processed: data.count,
      }))
      .sort((a, b) => b.avg_wait_minutes - a.avg_wait_minutes);

    return Response.json({
      period: "30 days",
      generated_at: new Date().toISOString(),
      doctor_performance: doctorPerformance,
      lab_performance: labPerformance,
      pharmacy_performance: pharmacyPerformance,
      shift_compliance: {
        total_handovers: handoverTotal,
        acknowledged: handoverAcknowledged,
        compliance_rate: handoverCompliance,
      },
      department_wait_times: departmentWaitTimes,
      summary: {
        total_consultations: consultations.length,
        total_lab_orders: labOrders.length,
        total_lab_results: labResults.length,
        total_dispensings: dispensings.length,
        total_handovers: handoverTotal,
        unique_doctors: doctorPerformance.length,
        unique_lab_techs: labPerformance.length,
        unique_pharmacists: pharmacyPerformance.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});