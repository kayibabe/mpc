import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Daily appointment schedule sync
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const [todayAppointments, tomorrowAppointments] = await Promise.all([
      base44.entities.Appointment.filter({ appointment_date: today }, "-appointment_time", 500),
      base44.entities.Appointment.filter({ appointment_date: tomorrow }, "-appointment_time", 500),
    ]);

    const syncData = {
      today: {
        date: today,
        total: todayAppointments.length,
        confirmed: todayAppointments.filter(a => a.status === "confirmed").length,
        pending: todayAppointments.filter(a => a.status === "pending").length,
        cancelled: todayAppointments.filter(a => a.status === "cancelled").length,
      },
      tomorrow: {
        date: tomorrow,
        total: tomorrowAppointments.length,
        confirmed: tomorrowAppointments.filter(a => a.status === "confirmed").length,
        pending: tomorrowAppointments.filter(a => a.status === "pending").length,
        cancelled: tomorrowAppointments.filter(a => a.status === "cancelled").length,
      },
    };

    // Create notification summary
    await base44.entities.Notification.create({
      title: "Daily Appointment Schedule Sync",
      message: `Today: ${syncData.today.confirmed} confirmed | Tomorrow: ${syncData.tomorrow.total} scheduled`,
      target_role: "admin",
      is_read: false,
    });

    return Response.json({
      sync_complete: true,
      schedule_data: syncData,
      last_sync: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});