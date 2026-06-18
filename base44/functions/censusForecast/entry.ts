import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get 30-day admission history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const admissions = await base44.asServiceRole.entities.Admission.filter({}, "-admission_date", 500);
    const recentAdmissions = admissions.filter(a => new Date(a.admission_date) >= thirtyDaysAgo);

    // Calculate daily averages by day of week
    const dayOfWeekStats = {
      0: { total: 0, count: 0 }, // Sunday
      1: { total: 0, count: 0 }, // Monday
      2: { total: 0, count: 0 },
      3: { total: 0, count: 0 },
      4: { total: 0, count: 0 },
      5: { total: 0, count: 0 },
      6: { total: 0, count: 0 }, // Saturday
    };

    recentAdmissions.forEach(a => {
      const dow = new Date(a.admission_date).getDay();
      dayOfWeekStats[dow].count++;
      dayOfWeekStats[dow].total += 1;
    });

    // Calculate average admissions per day of week
    const forecast = {};
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (let i = 0; i < 7; i++) {
      const avg = dayOfWeekStats[i].count > 0 ? Math.round(dayOfWeekStats[i].total / dayOfWeekStats[i].count) : 0;
      forecast[dayNames[i]] = avg;
    }

    // Get current bed occupancy
    const occupiedBeds = await base44.asServiceRole.entities.Bed.filter(
      { status: "occupied" },
      "",
      500
    );

    const totalBeds = await base44.asServiceRole.entities.Bed.list("", 500);
    const occupancyRate = Math.round((occupiedBeds.length / totalBeds.length) * 100);

    // Forecast next 7 days
    const nextWeek = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dow = date.getDay();
      nextWeek.push({
        date: date.toISOString().slice(0, 10),
        day: dayNames[dow],
        predicted_admissions: forecast[dayNames[dow]],
      });
    }

    // Alert if trending high
    const avgAdmissions = Object.values(forecast).reduce((a, b) => a + b, 0) / 7;
    if (avgAdmissions > 10 || occupancyRate > 85) {
      await base44.asServiceRole.entities.Notification.create({
        title: "📈 High Occupancy Forecast",
        message: `Predicted avg ${Math.round(avgAdmissions)} admissions/day. Current occupancy: ${occupancyRate}%. Prepare surge protocols.`,
        is_read: false,
        target_role: "admin",
        priority: occupancyRate > 95 ? "critical" : "high",
      });
    }

    return Response.json({
      status: "success",
      current_occupancy_pct: occupancyRate,
      current_occupied_beds: occupiedBeds.length,
      total_beds: totalBeds.length,
      average_daily_admissions: Math.round(avgAdmissions),
      forecast_next_7_days: nextWeek,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});