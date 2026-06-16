import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const results = {
      follow_ups_created: 0,
      reminders_sent: 0,
      details: [],
    };

    // 1. Discharged patients needing follow-up
    const discharges = await base44.asServiceRole.entities.Discharge.filter(
      { discharge_date: { $gte: sevenDaysAgo } },
      "-created_date",
      100
    );

    for (const d of discharges) {
      if (!d.follow_up_date) continue;
      if (d.follow_up_date < today) continue; // already past

      // Check if a follow-up appointment already exists
      const existing = await base44.asServiceRole.entities.Appointment.filter(
        {
          patient_id: d.patient_id,
          type: "follow_up",
          appointment_date: { $gte: today },
        },
        "",
        1
      );

      if (existing.length > 0) continue;

      // Get patient name
      let patientName = "Patient";
      try {
        const p = await base44.asServiceRole.entities.Patient.get(d.patient_id);
        if (p) patientName = `${p.first_name} ${p.last_name}`;
      } catch (_) {}

      try {
        await base44.asServiceRole.entities.Appointment.create({
          patient_id: d.patient_id,
          appointment_date: d.follow_up_date,
          appointment_time: "09:00",
          type: "follow_up",
          status: "scheduled",
          notes: `Auto-scheduled follow-up from discharge on ${d.discharge_date || "recent visit"}. ${d.follow_up_instructions || ""}`,
        });

        await base44.asServiceRole.entities.Notification.create({
          title: `Follow-up Scheduled: ${patientName}`,
          message: `Auto-scheduled follow-up appointment for ${d.follow_up_date}. Discharge instructions: ${d.follow_up_instructions || "Standard review"}`,
          type: "reminder",
          target_role: "reception",
          patient_id: d.patient_id,
          is_read: false,
          action_url: "/appointments",
        });

        results.follow_ups_created++;
        results.details.push({ type: "discharge_follow_up", patient: patientName, date: d.follow_up_date });
      } catch (_) { /* per-patient error non-fatal */ }
    }

    // 2. Chronic disease patients needing regular review
    const chronicDiagnoses = await base44.asServiceRole.entities.Diagnosis.filter(
      { status: "chronic" },
      "-diagnosis_date",
      100
    );

    const seenPatients = new Set();
    for (const dx of chronicDiagnoses) {
      if (seenPatients.has(dx.patient_id)) continue;
      seenPatients.add(dx.patient_id);

      // Check last visit
      const lastVisit = await base44.asServiceRole.entities.Visit.filter(
        { patient_id: dx.patient_id },
        "-visit_date",
        1
      );

      if (lastVisit.length === 0) continue;

      const lastVisitDate = new Date(lastVisit[0].visit_date || lastVisit[0].created_date);
      const daysSinceVisit = (Date.now() - lastVisitDate.getTime()) / 86400000;

      // Flag if no visit in 30+ days for chronic patients
      if (daysSinceVisit < 30) continue;

      // Check if already has upcoming appointment
      const hasAppt = await base44.asServiceRole.entities.Appointment.filter(
        {
          patient_id: dx.patient_id,
          appointment_date: { $gte: today },
        },
        "",
        1
      );

      if (hasAppt.length > 0) continue;

      let patientName = "Patient";
      try {
        const p = await base44.asServiceRole.entities.Patient.get(dx.patient_id);
        if (p) patientName = `${p.first_name} ${p.last_name}`;
      } catch (_) {}

      await base44.asServiceRole.entities.Notification.create({
        title: `Chronic Care Reminder: ${patientName}`,
        message: `${patientName} hasn't visited in ${Math.round(daysSinceVisit)} days. Diagnosis: ${dx.diagnosis_name}. Last visit: ${lastVisitDate.toISOString().slice(0, 10)}. Schedule follow-up.`,
        type: "reminder",
        target_role: "reception",
        patient_id: dx.patient_id,
        is_read: false,
        action_url: "/appointments",
      });

      results.reminders_sent++;
      results.details.push({ type: "chronic_care_gap", patient: patientName, days_since_visit: Math.round(daysSinceVisit), diagnosis: dx.diagnosis_name });
    }

    // 3. ANC patients (monthly follow-ups)
    const ancVisits = await base44.asServiceRole.entities.MaternalVisit.filter(
      { created_date: { $gte: new Date(Date.now() - 42 * 86400000).toISOString() } },
      "-created_date",
      100
    );

    const ancSeenPatients = new Set();
    for (const mv of ancVisits) {
      if (ancSeenPatients.has(mv.patient_id)) continue;
      ancSeenPatients.add(mv.patient_id);

      // Check if due for next ANC (every 4 weeks)
      const lastAnc = new Date(mv.visit_date || mv.created_date);
      const weeksSince = (Date.now() - lastAnc.getTime()) / (7 * 86400000);

      if (weeksSince < 3.5) continue; // Not yet due

      const hasUpcoming = await base44.asServiceRole.entities.Appointment.filter(
        {
          patient_id: mv.patient_id,
          type: "anc",
          appointment_date: { $gte: today },
        },
        "",
        1
      );

      if (hasUpcoming.length > 0) continue;

      let patientName = "Patient";
      try {
        const p = await base44.asServiceRole.entities.Patient.get(mv.patient_id);
        if (p) patientName = `${p.first_name} ${p.last_name}`;
      } catch (_) {}

      const nextDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

      try {
        await base44.asServiceRole.entities.Appointment.create({
          patient_id: mv.patient_id,
          appointment_date: nextDate,
          appointment_time: "08:30",
          type: "anc",
          status: "scheduled",
          notes: `Auto-scheduled ANC follow-up. Last visit: ${lastAnc.toISOString().slice(0, 10)} (${Math.round(weeksSince)} weeks ago).`,
        });

        results.follow_ups_created++;
        results.details.push({ type: "anc_follow_up", patient: patientName, weeks_since_last: Math.round(weeksSince), next_date: nextDate });
      } catch (_) {}
    }

    return Response.json({
      generated_at: new Date().toISOString(),
      follow_ups_created: results.follow_ups_created,
      reminders_sent: results.reminders_sent,
      total_actions: results.follow_ups_created + results.reminders_sent,
      details: results.details,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});