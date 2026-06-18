import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.patient_id || !data?.admission_id) {
      return Response.json({ error: "Missing admission data" }, { status: 400 });
    }

    const admission = await base44.asServiceRole.entities.Admission.get(data.admission_id);
    if (!admission) return Response.json({ error: "Admission not found" }, { status: 404 });

    const admissionDate = new Date(admission.admission_date);
    const daysSinceAdmission = Math.floor((Date.now() - admissionDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceAdmission < 7) return Response.json({ status: "skipped", reason: "Too early for HAI screening" });

    // Check if on antibiotics
    const prescriptions = await base44.asServiceRole.entities.Prescription.filter(
      { patient_id: data.patient_id },
      "-prescription_date",
      20
    );

    const activeAntibiotics = [];
    for (const px of prescriptions) {
      const items = await base44.asServiceRole.entities.PrescriptionItem.filter(
        { prescription_id: px.id },
        "",
        20
      );
      const antibioticItems = items.filter(i => 
        ["amoxicillin", "ceftriaxone", "ciprofloxacin", "azithromycin", "meropenem", "vancomycin", "flucloxacillin"].some(ab => i.drug_name?.toLowerCase().includes(ab))
      );
      activeAntibiotics.push(...antibioticItems);
    }

    if (activeAntibiotics.length > 0 && daysSinceAdmission > 7) {
      // Flag for HAI screening
      await base44.asServiceRole.entities.Notification.create({
        title: "🔬 HAI Screening Required",
        message: `Patient on antibiotics for ${daysSinceAdmission} days. Auto-order blood culture, wound culture if applicable. Initiate isolation protocols.`,
        is_read: false,
        target_role: "nurse",
        priority: "high",
        linked_patient_id: data.patient_id,
        linked_visit_id: data.admission_id,
      });

      // Auto-create cultures
      const culturesNeeded = [];
      if (daysSinceAdmission > 7) culturesNeeded.push("blood_culture");
      if (data.has_wound) culturesNeeded.push("wound_culture");

      for (const culture of culturesNeeded) {
        await base44.asServiceRole.entities.LabOrder.create({
          visit_id: admission.visit_id,
          patient_id: data.patient_id,
          ordered_by: "system",
          order_date: new Date().toISOString(),
          tests: [culture],
          priority: "urgent",
          status: "ordered",
          clinical_notes: `HAI screening - LOS ${daysSinceAdmission} days on antibiotics`,
        });
      }
    }

    return Response.json({
      status: "success",
      patient_id: data.patient_id,
      los_days: daysSinceAdmission,
      on_antibiotics: activeAntibiotics.length > 0,
      antibiotics: activeAntibiotics.map(a => a.drug_name),
      hai_risk: daysSinceAdmission > 7 && activeAntibiotics.length > 0,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});