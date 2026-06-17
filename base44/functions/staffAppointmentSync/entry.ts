import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Sync staff schedules with appointments
    const doctors = await base44.entities.User.filter({ role: { $in: ["admin", "user"] } }, "", 100);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const staffSchedules = [];
    
    for (const doctor of doctors) {
      const doctorSchedule = await base44.entities.DoctorSchedule?.filter?.(
        { doctor_id: doctor.id, schedule_date: tomorrow },
        "",
        1
      ) || [];

      const doctorAppointments = await base44.entities.Appointment?.filter?.(
        { appointment_date: tomorrow },
        "",
        100
      ) || [];

      staffSchedules.push({
        doctor_id: doctor.id,
        doctor_name: doctor.full_name,
        scheduled: doctorSchedule.length > 0,
        appointments_count: doctorAppointments.length,
      });
    }

    // Create summary notification
    const scheduledStaff = staffSchedules.filter(s => s.scheduled).length;
    await base44.entities.Notification.create({
      title: "Staff Schedule Sync",
      message: `${scheduledStaff}/${doctors.length} staff scheduled for tomorrow`,
      target_role: "admin",
      is_read: false,
    });

    return Response.json({
      synced_staff: staffSchedules.length,
      scheduled_count: scheduledStaff,
      staff_schedules: staffSchedules,
      sync_date: tomorrow,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});