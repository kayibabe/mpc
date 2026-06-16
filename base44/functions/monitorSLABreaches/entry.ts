import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SLA_THRESHOLDS = {
  RECEPTION: 15,
  TRIAGE: 20,
  CONSULTATION: 45,
  LAB_PENDING: 30,
  LAB_PROCESSING: 60,
  IMAGING_PENDING: 30,
  IMAGING_PROCESSING: 60,
  PHARMACY_PENDING: 30,
  PHARMACY_DISPENSING: 45,
  NURSING_ADMINISTRATION: 60,
  BILLING: 30,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const journeys = await base44.asServiceRole.entities.PatientJourney.filter(
      { status: "active", current_stage: { $ne: "COMPLETED" } },
      "-created_date",
      100
    );

    let breachesFound = 0;
    let escalations = 0;

    for (const journey of journeys) {
      try {
        const threshold = SLA_THRESHOLDS[journey.current_stage];
        if (!threshold) continue;

        // Determine when this stage started
        let stageStartTime;
        if (journey.stage_history) {
          const history = JSON.parse(journey.stage_history);
          const lastEntry = history[history.length - 1];
          if (lastEntry && lastEntry.to === journey.current_stage) {
            stageStartTime = new Date(lastEntry.timestamp);
          }
        }
        if (!stageStartTime) {
          stageStartTime = new Date(journey.updated_date || journey.created_date);
        }

        const minutesInStage = (Date.now() - stageStartTime.getTime()) / 60000;
        if (minutesInStage <= threshold) continue;

        breachesFound++;

        // Check if we already created a breach notification for this journey recently
        const recentNotif = await base44.asServiceRole.entities.Notification.filter(
          {
            visit_id: journey.visit_id,
            type: "alert",
            title: { $regex: "SLA Breach" },
            created_date: { $gte: new Date(Date.now() - 30 * 60000).toISOString() },
          },
          "-created_date",
          1
        );

        if (recentNotif.length > 0) continue; // Already notified in last 30 min

        // Fetch patient name
        let patientName = "Unknown patient";
        try {
          const patient = await base44.asServiceRole.entities.Patient.get(journey.patient_id);
          if (patient) patientName = `${patient.first_name} ${patient.last_name}`;
        } catch (_) {}

        const stageLabel = journey.current_stage.replace(/_/g, " ").toLowerCase();
        const slaMin = threshold;
        const elapsedMin = Math.round(minutesInStage);

        // Auto-escalate visit priority
        try {
          const visit = await base44.asServiceRole.entities.Visit.get(journey.visit_id);
          if (visit && visit.priority !== "emergency") {
            const newPriority = visit.priority === "normal" ? "urgent" : "emergency";
            await base44.asServiceRole.entities.Visit.update(journey.visit_id, { priority: newPriority });
            escalations++;
          }
        } catch (_) {}

        // Notify manager
        await base44.asServiceRole.entities.Notification.create({
          title: `⚠️ SLA Breach: ${patientName}`,
          message: `${patientName} has been stuck in ${stageLabel} for ${elapsedMin}min (SLA: ${slaMin}min). Priority auto-escalated.`,
          type: "alert",
          target_role: "admin",
          patient_id: journey.patient_id,
          visit_id: journey.visit_id,
          is_read: false,
          action_url: "/",
        });

        // Also notify the assigned role
        if (journey.assigned_to_role && journey.assigned_to_role !== "admin") {
          await base44.asServiceRole.entities.Notification.create({
            title: `⏰ Stale Patient: ${patientName}`,
            message: `${patientName} has been in your ${stageLabel} queue for ${elapsedMin}min — SLA is ${slaMin}min.`,
            type: "alert",
            target_role: journey.assigned_to_role,
            patient_id: journey.patient_id,
            visit_id: journey.visit_id,
            is_read: false,
            action_url: "/",
          });
        }
      } catch (_) { /* per-journey errors are non-fatal */ }
    }

    return Response.json({
      success: true,
      total_active_journeys: journeys.length,
      sla_breaches: breachesFound,
      escalations,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});