import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.patient_id) return Response.json({ error: "Missing patient data" }, { status: 400 });

    const patient = await base44.asServiceRole.entities.Patient.get(data.patient_id);
    const vitals = await base44.asServiceRole.entities.VitalSigns.filter(
      { patient_id: data.patient_id },
      "-recorded_date",
      1
    );

    const v = vitals[0];
    let dietOrder = "regular";
    const nutritionFactors = [];

    // Determine diet based on vitals and condition
    if (data.condition === "diabetic") {
      dietOrder = "diabetic_controlled";
      nutritionFactors.push("Diabetic meal plan (low glycemic index)");
    }
    if (data.condition === "renal") {
      dietOrder = "renal_restricted";
      nutritionFactors.push("Protein/potassium restricted");
    }
    if (data.condition === "cardiac") {
      dietOrder = "low_sodium";
      nutritionFactors.push("Low sodium, heart-healthy");
    }
    if (v?.bmi && v.bmi > 30) {
      dietOrder = "weight_reduction";
      nutritionFactors.push("Weight reduction diet (calorie controlled)");
    }
    if (v?.bmi && v.bmi < 18.5) {
      dietOrder = "high_calorie";
      nutritionFactors.push("High-calorie diet for recovery");
    }
    if (data.swallowing_difficulty) {
      dietOrder = "soft_pureed";
      nutritionFactors.push("Soft/puréed (swallowing precautions)");
    }
    if (data.npo_status) {
      dietOrder = "npo";
      nutritionFactors.push("NPO (nothing by mouth) - pre-operative or test");
    }

    // Create nutrition order
    await base44.asServiceRole.entities.AuditLog.create({
      entity_name: "NutritionOrder",
      entity_id: data.patient_id,
      action: "diet_prescribed",
      user_id: "system",
      description: `Diet: ${dietOrder}. Factors: ${nutritionFactors.join(", ")}`,
      timestamp: new Date().toISOString(),
    });

    // Notify nutrition/dietary staff
    await base44.asServiceRole.entities.Notification.create({
      title: "🍎 Nutrition Order",
      message: `${patient.first_name} ${patient.last_name}: ${dietOrder.toUpperCase()}. Notes: ${nutritionFactors.join("; ")}`,
      is_read: false,
      target_role: "nurse",
      priority: "normal",
      linked_patient_id: data.patient_id,
    });

    return Response.json({
      status: "success",
      patient_id: data.patient_id,
      diet_order: dietOrder,
      nutrition_factors: nutritionFactors,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});