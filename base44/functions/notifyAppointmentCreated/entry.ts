import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { event, data } = await req.json();

    // Only fire on create events
    if (event?.type !== 'create') {
      return Response.json({ status: 'skipped', reason: 'not a create event' });
    }

    const appointment = data;
    if (!appointment?.patient_id) {
      return Response.json({ status: 'skipped', reason: 'no patient_id' });
    }

    // Get patient details
    const patient = await base44.asServiceRole.entities.Patient.get(appointment.patient_id);
    if (!patient) {
      return Response.json({ status: 'skipped', reason: 'patient not found' });
    }

    const patientName = `${patient.first_name} ${patient.last_name}`;
    const dateDisplay = new Date(appointment.appointment_date).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Send email notification
    if (patient.email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: patient.email,
        subject: `Appointment Confirmed — Zomba City Private Clinic`,
        body: `Dear ${patientName},\n\nYour appointment has been confirmed:\n\nDate: ${dateDisplay}\nTime: ${appointment.appointment_time || 'To be confirmed'}\nType: ${(appointment.type || 'General').replace(/_/g, ' ')}\nDepartment: ${appointment.department || 'General OPD'}\n\nPlease arrive 15 minutes early with your ID and insurance card if applicable.\n\nIf you need to reschedule, please call us at +265 888 111 222.\n\nThank you,\nZomba City Private Clinic`,
      });
    }

    return Response.json({
      status: 'notification_sent',
      patient_name: patientName,
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
      email_sent: !!patient.email,
      phone: patient.phone || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});