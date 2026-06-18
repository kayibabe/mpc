import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.patient_id) return Response.json({ error: "Missing patient data" }, { status: 400 });

    const patient = await base44.asServiceRole.entities.Patient.get(data.patient_id);
    const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();

    // Get vaccination history
    const immunizations = await base44.asServiceRole.entities.Immunization.filter(
      { patient_id: data.patient_id },
      "-vaccination_date",
      50
    );

    // Define age-based vaccination schedule
    const schedule = [];

    if (age < 1) {
      schedule.push("BCG", "OPV 0", "Pentavalent 1", "Rotavirus 1", "PCV 1");
    } else if (age < 2) {
      schedule.push("OPV 1", "Pentavalent 2", "Rotavirus 2", "PCV 2");
    } else if (age < 5) {
      schedule.push("Measles 1", "OPV 2", "Pentavalent 3", "PCV 3", "Typhoid");
    } else if (age >= 5 && age < 15) {
      schedule.push("Measles 2", "DPT Booster", "Typhoid Booster", "Anti-malarial (seasonal)");
    } else if (age >= 15) {
      schedule.push("Tetanus/Diphtheria", "Influenza (annual)", "COVID-19 (per protocol)");
    }

    // Check what's due
    const received = immunizations.map(i => i.vaccine_name);
    const overdue = schedule.filter(v => !received.includes(v));

    if (overdue.length > 0) {
      await base44.asServiceRole.entities.Notification.create({
        title: "💉 Vaccination Due",
        message: `${patient.first_name} (age ${age}): ${overdue.join(", ")} due. Schedule immediately.`,
        is_read: false,
        target_role: "nurse",
        priority: "normal",
        linked_patient_id: data.patient_id,
      });
    }

    // Log vaccination if data.vaccinated
    if (data.vaccinated && data.vaccine_name) {
      await base44.asServiceRole.entities.Immunization.create({
        patient_id: data.patient_id,
        vaccine_name: data.vaccine_name,
        batch_number: data.batch_number || "unknown",
        vaccination_date: new Date().toISOString(),
        administered_by: "nurse",
        route: data.route || "IM",
        site: data.site || "left_arm",
        status: "completed",
      });
    }

    return Response.json({
      status: "success",
      patient_id: data.patient_id,
      age: age,
      received: received,
      schedule: schedule,
      overdue: overdue,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});