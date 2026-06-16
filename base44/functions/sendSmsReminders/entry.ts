import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const apiKey = Deno.env.get('AFRICAS_TALKING_API_KEY');
    const username = Deno.env.get('AFRICAS_TALKING_USERNAME');
    const senderId = Deno.env.get('AFRICAS_TALKING_SENDER_ID');

    if (!apiKey || !username) {
      return Response.json({ error: 'SMS not configured' }, { status: 500 });
    }

    // Get tomorrow's date in Africa/Blantyre
    const tomorrow = new Date(Date.now() + 86400000);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    const appointments = await base44.asServiceRole.entities.Appointment.filter(
      { appointment_date: dateStr, status: 'scheduled' },
      '',
      200
    );

    const results = [];
    for (const appt of appointments) {
      try {
        const patient = await base44.asServiceRole.entities.Patient.get(appt.patient_id);
        if (!patient || !patient.phone) {
          results.push({ appointment_id: appt.id, status: 'skipped', reason: 'No phone' });
          continue;
        }

        const msg = `Zomba City Private Clinic: Reminder — your appointment is tomorrow ${new Date(appt.appointment_date).toLocaleDateString('en-GB')} at ${appt.appointment_time}. Please arrive 15 minutes early. For inquiries call +265 888 000 000.`;

        const smsRes = await fetch(`https://api.africastalking.com/version1/messaging`, {
          method: 'POST',
          headers: {
            'ApiKey': apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            username,
            to: patient.phone,
            message: msg,
            from: senderId || '',
          }).toString(),
        });

        const smsData = await smsRes.json();
        results.push({
          appointment_id: appt.id,
          patient_phone: patient.phone,
          status: smsData?.SMSMessageData?.Recipients?.[0]?.status === 'Success' ? 'sent' : 'failed',
          sms_response: JSON.stringify(smsData),
        });
      } catch (e) {
        results.push({ appointment_id: appt.id, status: 'error', error: e.message });
      }
    }

    return Response.json({
      total_appointments: appointments.length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      details: results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});