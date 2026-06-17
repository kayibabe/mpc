import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Sync appointments for staff
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const appointments = await base44.entities.Appointment.filter(
      { appointment_date: tomorrowStr },
      "-appointment_time",
      500
    );

    // Create draft reminders/summaries
    const staffApptSummary = appointments.length > 0
      ? `${appointments.length} appointments scheduled for ${tomorrowStr}`
      : `No appointments scheduled for ${tomorrowStr}`;

    // Send notification to admin
    await base44.entities.Notification.create({
      title: "Daily Appointment Sync",
      message: staffApptSummary,
      target_role: "admin",
      is_read: false,
    });

    return Response.json({
      synced_appointments: appointments.length,
      sync_date: tomorrowStr,
      summary: staffApptSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});