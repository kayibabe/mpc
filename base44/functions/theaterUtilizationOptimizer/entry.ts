import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().slice(0, 10);
    const lastSevenDays = new Date();
    lastSevenDays.setDate(lastSevenDays.getDate() - 7);

    const bookings = await base44.asServiceRole.entities.SurgicalBooking.filter({}, "", 500);
    const recentBookings = bookings.filter(b => new Date(b.scheduled_date) >= lastSevenDays);

    const theaters = ["theatre_1", "theatre_2", "minor_theatre", "maternity_theatre", "emergency_theatre"];
    const utilization = {};
    let totalCancellations = 0;
    let totalCompleted = 0;
    let totalTurnaroundTime = 0;
    let turnaroundCount = 0;

    for (const theater of theaters) {
      const theaterBookings = recentBookings.filter(b => b.theater_room === theater);
      const completed = theaterBookings.filter(b => b.status === "completed").length;
      const cancelled = theaterBookings.filter(b => b.status === "cancelled").length;

      const totalMinutes = theaterBookings.reduce((sum, b) => {
        const start = parseInt(b.start_time?.split(":")[0] || 0) * 60 + parseInt(b.start_time?.split(":")[1] || 0);
        const end = parseInt(b.end_time?.split(":")[0] || 0) * 60 + parseInt(b.end_time?.split(":")[1] || 0);
        return sum + (end - start);
      }, 0);

      const avgTurnaroundTime = completed > 0 ? totalMinutes / completed : 0;
      utilization[theater] = {
        scheduled: theaterBookings.length,
        completed: completed,
        cancelled: cancelled,
        utilization_pct: theaterBookings.length > 0 ? Math.round((completed / theaterBookings.length) * 100) : 0,
        avg_turnaround_min: Math.round(avgTurnaroundTime),
      };

      totalCancellations += cancelled;
      totalCompleted += completed;
      totalTurnaroundTime += avgTurnaroundTime * completed;
      turnaroundCount += completed;
    }

    const avgSystemTurnaround = turnaroundCount > 0 ? totalTurnaroundTime / turnaroundCount : 0;
    const cancellationRate = recentBookings.length > 0 ? Math.round((totalCancellations / recentBookings.length) * 100) : 0;

    const issues = [];
    if (cancellationRate > 15) issues.push(`High cancellation rate: ${cancellationRate}%`);
    if (avgSystemTurnaround > 90) issues.push(`Long turnaround time: ${Math.round(avgSystemTurnaround)} min`);

    const underutilized = Object.entries(utilization).filter(([_, u]) => u.utilization_pct < 60);
    if (underutilized.length > 0) {
      issues.push(`Underutilized: ${underutilized.map(([k, v]) => k).join(", ")} (<60%)`);
    }

    if (issues.length > 0) {
      await base44.asServiceRole.entities.Notification.create({
        title: "🏥 Theatre Utilization Issues",
        message: issues.join("; ") + `. Review scheduling and cancellation patterns.`,
        is_read: false,
        target_role: "admin",
        priority: "high",
      });
    }

    return Response.json({
      status: "success",
      period: "last_7_days",
      total_scheduled: recentBookings.length,
      total_completed: totalCompleted,
      cancellation_rate_pct: cancellationRate,
      avg_turnaround_min: Math.round(avgSystemTurnaround),
      theater_metrics: utilization,
      issues: issues,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});