import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    if (!data?.visit_id) {
      return Response.json({ error: 'No visit_id provided' }, { status: 400 });
    }

    // Get or create the PatientJourney for this visit
    const journeys = await base44.asServiceRole.entities.PatientJourney.filter(
      { visit_id: data.visit_id },
      "-created_date",
      1
    );

    let journey = journeys[0];
    if (!journey) {
      const visit = await base44.asServiceRole.entities.Visit.get(data.visit_id);
      if (!visit) {
        return Response.json({ error: 'Visit not found' }, { status: 404 });
      }
      journey = await base44.asServiceRole.entities.PatientJourney.create({
        visit_id: data.visit_id,
        patient_id: visit.patient_id,
        current_stage: "RECEPTION",
        status: "active",
      });
    }

    // Determine next stage based on entity type and data
    let nextStage = journey.current_stage;
    let stageHistory = [];
    try {
      stageHistory = journey.stage_history ? JSON.parse(journey.stage_history) : [];
    } catch (_) {}

    if (event.entity_name === "Visit" && event.type === "create") {
      nextStage = "RECEPTION";
    } else if (event.entity_name === "VitalSigns" && event.type === "create") {
      nextStage = "TRIAGE";
    } else if (event.entity_name === "Consultation" && event.type === "create") {
      nextStage = "CONSULTATION";
    } else if (event.entity_name === "LabOrder" && event.type === "create") {
      nextStage = "LAB_PENDING";
    } else if (event.entity_name === "LabOrder" && data.status === "in_progress") {
      nextStage = "LAB_PROCESSING";
    } else if (event.entity_name === "LabResult" && data.status === "final") {
      nextStage = "CONSULTATION"; // Back to doctor to review results
    } else if (event.entity_name === "ImagingOrder" && event.type === "create") {
      nextStage = "IMAGING_PENDING";
    } else if (event.entity_name === "ImagingOrder" && data.status === "in_progress") {
      nextStage = "IMAGING_PROCESSING";
    } else if (event.entity_name === "Prescription" && event.type === "create") {
      nextStage = "PHARMACY_PENDING";
    } else if (event.entity_name === "PharmacyDispensing" && data.status === "dispensed") {
      nextStage = "PHARMACY_DISPENSING";
    } else if (event.entity_name === "Admission" && event.type === "create") {
      nextStage = "NURSING_ADMINISTRATION";
    } else if (event.entity_name === "Invoice" && data.status === "paid") {
      nextStage = "BILLING";
    }

    // Only update if stage actually changed
    if (nextStage !== journey.current_stage) {
      stageHistory.push({
        from: journey.current_stage,
        to: nextStage,
        timestamp: new Date().toISOString(),
        triggered_by: event.entity_name,
      });

      await base44.asServiceRole.entities.PatientJourney.update(journey.id, {
        current_stage: nextStage,
        stage_history: JSON.stringify(stageHistory),
        assigned_to_role: getRoleForStage(nextStage),
      });
    }

    return Response.json({
      status: "success",
      visit_id: data.visit_id,
      stage: nextStage,
      history_length: stageHistory.length,
    });

  } catch (error) {
    console.error("Error updating journey stage:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function getRoleForStage(stage) {
  const roleMap = {
    RECEPTION: "receptionist",
    TRIAGE: "nurse",
    CONSULTATION: "doctor",
    LAB_PENDING: "nurse",
    LAB_PROCESSING: "lab_technician",
    IMAGING_PENDING: "nurse",
    IMAGING_PROCESSING: "radiographer",
    PHARMACY_PENDING: "nurse",
    PHARMACY_DISPENSING: "pharmacist",
    NURSING_ADMINISTRATION: "nurse",
    BILLING: "cashier",
    COMPLETED: "admin",
  };
  return roleMap[stage] || "user";
}