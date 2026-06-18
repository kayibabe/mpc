import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.patient_id) return Response.json({ error: "Missing patient data" }, { status: 400 });

    const patient = await base44.asServiceRole.entities.Patient.get(data.patient_id);
    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });

    const communications = [];

    // Post-discharge care instructions SMS
    if (data.discharged && patient.phone) {
      const instruction = `${patient.first_name}, follow discharge instructions: take medications as prescribed, keep follow-up appointment in 2 weeks, call if fever/bleeding. -Zomba City Clinic`;
      communications.push({ type: "sms", phone: patient.phone, message: instruction, status: "queued" });
    }

    // Appointment reminder SMS (24 hours before)
    const nextAppointment = await base44.asServiceRole.entities.Appointment.filter(
      { patient_id: data.patient_id, status: "scheduled" },
      "appointment_date",
      1
    );

    if (nextAppointment.length > 0 && patient.phone) {
      const apptDate = new Date(nextAppointment[0].appointment_date);
      const hoursUntilAppt = (apptDate.getTime() - Date.now()) / (1000 * 60 * 60);

      if (hoursUntilAppt > 20 && hoursUntilAppt < 24) {
        const reminder = `${patient.first_name}, your appointment is tomorrow at ${apptDate.toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit"})}. Reply YES to confirm or CALL for reschedule. -Zomba City Clinic`;
        communications.push({ type: "sms", phone: patient.phone, message: reminder, status: "queued" });
      }
    }

    // Medication compliance check (for chronic patients)
    const chronicPrescriptions = await base44.asServiceRole.entities.Prescription.filter(
      { patient_id: data.patient_id, status: "dispensed" },
      "-prescription_date",
      5
    );

    if (chronicPrescriptions.length > 2 && patient.phone) {
      const complianceCheck = `${patient.first_name}, are you taking your medications regularly? Reply YES/NO. Important for your health. -Zomba City Clinic`;
      communications.push({ type: "sms", phone: patient.phone, message: complianceCheck, status: "queued" });
    }

    // Post-visit satisfaction survey
    if (data.visit_completed && patient.phone) {
      const survey = `${patient.first_name}, how was your visit? Rate 1-5: text RATE 1-5. Your feedback helps us improve. -Zomba City Clinic`;
      communications.push({ type: "sms", phone: patient.phone, message: survey, status: "queued" });
    }

    // No-show prevention: SMS + call 2 hours before appointment
    const upcomingAppts = await base44.asServiceRole.entities.Appointment.filter(
      { patient_id: data.patient_id, status: "scheduled" },
      "appointment_date",
      10
    );

    for (const appt of upcomingAppts) {
      const apptDate = new Date(appt.appointment_date);
      const minutesUntilAppt = (apptDate.getTime() - Date.now()) / (1000 * 60);

      if (minutesUntilAppt > 110 && minutesUntilAppt < 130 && patient.phone) {
        const noShowAlert = `${patient.first_name}, reminder: appointment in 2 hours. Please be on time. Call ${patient.phone} to confirm. -Zomba City Clinic`;
        communications.push({ type: "sms", phone: patient.phone, message: noShowAlert, status: "queued" });
      }
    }

    // Log communications
    for (const comm of communications) {
      await base44.asServiceRole.entities.AuditLog.create({
        entity_name: "PatientCommunication",
        entity_id: data.patient_id,
        action: `${comm.type}_sent`,
        user_id: "system",
        description: comm.message,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      status: "success",
      patient_id: data.patient_id,
      communications_sent: communications.length,
      communications: communications,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});