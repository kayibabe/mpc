import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.patient_id) return Response.json({ error: "Missing patient data" }, { status: 400 });

    const patient = await base44.asServiceRole.entities.Patient.get(data.patient_id);
    const bloodGroup = patient?.blood_group || "unknown";

    // Track transfusion requests
    const transfusions = await base44.asServiceRole.entities.BloodTransfusion?.filter?.(
      { patient_id: data.patient_id },
      "-created_date",
      10
    ) || [];

    // Get available blood inventory
    const bloodInventory = await base44.asServiceRole.entities.Drug.filter(
      { category: "blood_products" },
      "",
      50
    );

    const availableUnits = bloodInventory.filter(b => b.name.includes(bloodGroup)).reduce((sum, b) => sum + (b.quantity_in_stock || 0), 0);
    const criticalThreshold = 5;

    if (availableUnits < criticalThreshold) {
      await base44.asServiceRole.entities.Notification.create({
        title: `🩸 Critical Blood Shortage: ${bloodGroup}`,
        message: `Only ${availableUnits} units of ${bloodGroup} available. Below critical threshold of ${criticalThreshold}. Order emergency supplies.`,
        is_read: false,
        target_role: "pharmacist",
        priority: "critical",
        linked_patient_id: data.patient_id,
      });
    }

    // Create transfusion record if needed
    if (data.transfusion_needed) {
      const transfusionRequest = {
        patient_id: data.patient_id,
        blood_group: bloodGroup,
        units_requested: data.units_requested || 2,
        indication: data.indication || "anemia",
        requested_date: new Date().toISOString(),
        status: "pending",
        requested_by: "system",
      };

      // Log in AuditLog (since no BloodTransfusion entity exists, we use audit log)
      await base44.asServiceRole.entities.AuditLog.create({
        entity_name: "BloodTransfusion",
        entity_id: data.patient_id,
        action: "transfusion_request",
        user_id: "system",
        description: `Requested ${transfusionRequest.units_requested} units ${bloodGroup} for ${transfusionRequest.indication}`,
        timestamp: new Date().toISOString(),
      });

      // Notify blood bank
      await base44.asServiceRole.entities.Notification.create({
        title: "🩸 Blood Transfusion Request",
        message: `${patient.first_name} ${patient.last_name} (${bloodGroup}) needs ${transfusionRequest.units_requested} units. Indication: ${transfusionRequest.indication}. Verify type & cross, start transfusion protocol.`,
        is_read: false,
        target_role: "nurse",
        priority: "high",
        linked_patient_id: data.patient_id,
      });
    }

    return Response.json({
      status: "success",
      patient_id: data.patient_id,
      blood_group: bloodGroup,
      available_units: availableUnits,
      critical: availableUnits < criticalThreshold,
      transfusions_logged: transfusions.length,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});