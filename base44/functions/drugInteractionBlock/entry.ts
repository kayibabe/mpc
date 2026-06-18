import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.id || !data?.patient_id) {
      return Response.json({ error: "Missing prescription data" }, { status: 400 });
    }

    // Get all current active prescriptions for patient
    const activePrescriptions = await base44.asServiceRole.entities.Prescription.filter(
      { patient_id: data.patient_id, status: { $in: ["pending", "dispensed"] } },
      "-prescription_date",
      50
    );

    // Get prescription items
    const prescriptionItems = await base44.asServiceRole.entities.PrescriptionItem.filter(
      { prescription_id: data.id },
      "",
      20
    );

    // Check drug interactions database
    const interactions = await base44.asServiceRole.entities.DrugInteraction.list("", 500);

    const warnings = [];
    const blocked = [];

    for (const newItem of prescriptionItems) {
      for (const oldPrescription of activePrescriptions) {
        if (oldPrescription.id === data.id) continue; // Skip self

        const oldItems = await base44.asServiceRole.entities.PrescriptionItem.filter(
          { prescription_id: oldPrescription.id },
          "",
          20
        );

        for (const oldItem of oldItems) {
          // Check interaction database
          const interaction = interactions.find(i =>
            (i.drug_a === newItem.drug_name && i.drug_b === oldItem.drug_name) ||
            (i.drug_a === oldItem.drug_name && i.drug_b === newItem.drug_name)
          );

          if (interaction) {
            const msg = `${newItem.drug_name} + ${oldItem.drug_name}: ${interaction.interaction_description || "Contraindicated"}`;
            
            if (interaction.severity === "contraindicated" || interaction.severity === "critical") {
              blocked.push({ drugs: [newItem.drug_name, oldItem.drug_name], reason: interaction.interaction_description });
              warnings.push(`🔴 BLOCKED: ${msg}`);
            } else if (interaction.severity === "severe") {
              warnings.push(`🟠 SEVERE: ${msg} — Requires doctor approval`);
            } else {
              warnings.push(`🟡 CAUTION: ${msg} — Monitor patient`);
            }
          }
        }
      }
    }

    // If blocked interactions, cancel prescription
    if (blocked.length > 0) {
      await base44.asServiceRole.entities.Prescription.update(data.id, { status: "cancelled" });
      
      const doctor = await base44.asServiceRole.entities.User.get(data.prescribed_by);
      
      await base44.asServiceRole.entities.Notification.create({
        title: "❌ Prescription BLOCKED: Drug Interaction",
        message: `${blocked.map(b => `${b.drugs.join(" + ")}: ${b.reason}`).join("; ")}. Prescription cancelled. Review and select alternative.`,
        is_read: false,
        target_role: "doctor",
        priority: "critical",
        linked_patient_id: data.patient_id,
      });

      return Response.json({
        status: "blocked",
        reason: "Contraindicated drug combinations detected",
        interactions: blocked,
        action: "prescription_cancelled",
      });
    }

    // Log warnings
    if (warnings.length > 0) {
      await base44.asServiceRole.entities.Notification.create({
        title: "⚠️ Drug Interaction Warnings",
        message: warnings.join("; "),
        is_read: false,
        target_role: "pharmacist",
        priority: "high",
        linked_patient_id: data.patient_id,
      });

      await base44.asServiceRole.entities.AuditLog.create({
        entity_name: "Prescription",
        entity_id: data.id,
        action: "interaction_warning",
        user_id: "system",
        description: `Drug interaction warnings: ${warnings.length}`,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      status: "approved",
      warnings: warnings,
      safe_to_dispense: blocked.length === 0,
    });

  } catch (error) {
    console.error("Error checking drug interactions:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});