import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const STAGE_TRANSITIONS = {
  RECEPTION: { allowed: ["TRIAGE", "CONSULTATION", "COMPLETED"], next_role: "doctor" },
  TRIAGE: { allowed: ["CONSULTATION", "LAB_PENDING", "IMAGING_PENDING", "COMPLETED"], next_role: "doctor" },
  CONSULTATION: { allowed: ["LAB_PENDING", "IMAGING_PENDING", "PHARMACY_PENDING", "NURSING_ADMINISTRATION", "BILLING", "COMPLETED"], next_role: null },
  LAB_PENDING: { allowed: ["LAB_PROCESSING", "CONSULTATION", "COMPLETED"], next_role: "lab_technician" },
  LAB_PROCESSING: { allowed: ["CONSULTATION", "COMPLETED"], next_role: "doctor" },
  IMAGING_PENDING: { allowed: ["IMAGING_PROCESSING", "CONSULTATION", "COMPLETED"], next_role: "radiographer" },
  IMAGING_PROCESSING: { allowed: ["CONSULTATION", "COMPLETED"], next_role: "doctor" },
  PHARMACY_PENDING: { allowed: ["PHARMACY_DISPENSING", "CONSULTATION", "COMPLETED"], next_role: "pharmacist" },
  PHARMACY_DISPENSING: { allowed: ["NURSING_ADMINISTRATION", "BILLING", "COMPLETED"], next_role: null },
  NURSING_ADMINISTRATION: { allowed: ["BILLING", "COMPLETED"], next_role: "nurse" },
  BILLING: { allowed: ["COMPLETED"], next_role: "cashier" },
  COMPLETED: { allowed: [], next_role: null },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { journey_id, next_stage, notes } = body;

    if (!journey_id || !next_stage) {
      return Response.json({ error: 'journey_id and next_stage are required' }, { status: 400 });
    }

    // Fetch current journey
    const journey = await base44.asServiceRole.entities.PatientJourney.get(journey_id);
    if (!journey) return Response.json({ error: 'Journey not found' }, { status: 404 });

    const currentStage = journey.current_stage;
    const transition = STAGE_TRANSITIONS[currentStage];

    if (!transition) {
      return Response.json({ error: `Unknown stage: ${currentStage}` }, { status: 400 });
    }

    if (!transition.allowed.includes(next_stage)) {
      return Response.json({
        error: `Cannot transition from ${currentStage} to ${next_stage}. Allowed: ${transition.allowed.join(', ')}`
      }, { status: 400 });
    }

    // Build stage history
    const history = journey.stage_history ? JSON.parse(journey.stage_history) : [];
    history.push({
      from: currentStage,
      to: next_stage,
      timestamp: new Date().toISOString(),
      user_id: user.id,
      notes: notes || '',
    });

    // Determine next role assignment
    const nextRole = STAGE_TRANSITIONS[next_stage]?.next_role || 'admin';

    // Update journey
    await base44.asServiceRole.entities.PatientJourney.update(journey_id, {
      current_stage: next_stage,
      assigned_to_role: nextRole,
      notes: notes || journey.notes,
      stage_history: JSON.stringify(history),
    });

    // Update visit queue_status to match
    try {
      await base44.asServiceRole.entities.Visit.update(journey.visit_id, {
        queue_status: next_stage.toLowerCase(),
      });
    } catch (_) { /* visit may not exist */ }

    // Create notification for the next stage's target role
    const stageLabel = next_stage.replace(/_/g, ' ').toLowerCase();
    const patient = journey.patient_id ? await base44.asServiceRole.entities.Patient.get(journey.patient_id).catch(() => null) : null;
    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown patient';

    await base44.asServiceRole.entities.Notification.create({
      title: `Patient ready for ${stageLabel}`,
      message: `${patientName} has been moved to ${stageLabel} by ${user.full_name || 'staff'}.`,
      type: 'workflow',
      target_role: nextRole,
      patient_id: journey.patient_id,
      visit_id: journey.visit_id,
      is_read: false,
      action_url: '/',
    });

    // Log audit trail
    await base44.asServiceRole.entities.AuditLog.create({
      user_id: user.id,
      action: 'workflow_transition',
      entity_type: 'PatientJourney',
      entity_id: journey_id,
      changes: JSON.stringify({ from: currentStage, to: next_stage }),
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      journey_id,
      previous_stage: currentStage,
      current_stage: next_stage,
      history,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});