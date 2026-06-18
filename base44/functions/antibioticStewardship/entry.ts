import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.patient_id) return Response.json({ error: "Missing patient data" }, { status: 400 });

    const prescriptions = await base44.asServiceRole.entities.Prescription.filter(
      { patient_id: data.patient_id, status: { $in: ["pending", "dispensed"] } },
      "-prescription_date",
      20
    );

    const antibioticsOnboard = [];

    for (const px of prescriptions) {
      const items = await base44.asServiceRole.entities.PrescriptionItem.filter(
        { prescription_id: px.id },
        "",
        20
      );

      for (const item of items) {
        const isAntibiotic = ["amoxicillin", "ceftriaxone", "ciprofloxacin", "azithromycin", "meropenem", "vancomycin", "flucloxacillin", "doxycycline"].some(ab => 
          item.drug_name?.toLowerCase().includes(ab)
        );

        if (isAntibiotic) {
          const daysOnAntibiotics = Math.floor((Date.now() - new Date(px.prescription_date).getTime()) / (1000 * 60 * 60 * 24));

          if (daysOnAntibiotics > 3) {
            antibioticsOnboard.push({
              drug: item.drug_name,
              days_on: daysOnAntibiotics,
              start_date: px.prescription_date,
              status: px.status,
            });
          }
        }
      }
    }

    if (antibioticsOnboard.length > 0) {
      const overuseAlert = antibioticsOnboard.filter(a => a.days_on > 7);

      await base44.asServiceRole.entities.Notification.create({
        title: "💊 Antibiotic De-escalation Review",
        message: `Patient on ${antibioticsOnboard.map(a => a.drug).join(", ")} for ${Math.max(...antibioticsOnboard.map(a => a.days_on))} days. Review labs, consider narrower spectrum or discontinuation.`,
        is_read: false,
        target_role: "pharmacist",
        priority: overuseAlert.length > 0 ? "high" : "normal",
        linked_patient_id: data.patient_id,
      });

      // Log stewardship review
      await base44.asServiceRole.entities.AuditLog.create({
        entity_name: "AntibioticStewardship",
        entity_id: data.patient_id,
        action: "deescalation_review",
        user_id: "system",
        description: `Antibiotics: ${antibioticsOnboard.map(a => `${a.drug}(${a.days_on}d)`).join(", ")}`,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      status: "success",
      patient_id: data.patient_id,
      antibiotics_active: antibioticsOnboard.length,
      antibiotics: antibioticsOnboard,
      needs_deescalation: antibioticsOnboard.filter(a => a.days_on > 7).length > 0,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});