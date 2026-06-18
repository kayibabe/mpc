import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all staff
    const staff = await base44.asServiceRole.entities.User.filter(
      { role: { $in: ["doctor", "clinician", "nurse", "pharmacist", "lab_technician"] } },
      "",
      200
    );

    const burnoutAlerts = [];

    for (const person of staff) {
      // Count tasks/consultations in last 7 days
      const consultations = await base44.asServiceRole.entities.Consultation.filter(
        { doctor_id: person.id },
        "",
        100
      );
      const nurseTasks = await base44.asServiceRole.entities.NurseTask.filter(
        { assigned_to_id: person.id },
        "",
        100
      );
      const shiftLogs = await base44.asServiceRole.entities.LoginSession.filter(
        { user_id: person.id },
        "-created_date",
        50
      );

      let totalHoursWorked = 0;
      let consecutiveDaysWorked = 0;
      let lastLogout = null;

      // Calculate hours and consecutive days
      for (let i = 0; i < shiftLogs.length; i++) {
        const session = shiftLogs[i];
        if (session.logout_time && session.login_time) {
          const hours = (new Date(session.logout_time) - new Date(session.login_time)) / (1000 * 60 * 60);
          totalHoursWorked += hours;
        }
        if (i === 0) lastLogout = new Date(session.created_date);
      }

      // Check last 7 days
      const lastSevenDays = shiftLogs.filter(s => new Date(s.created_date) >= sevenDaysAgo);
      const uniqueDates = new Set(lastSevenDays.map(s => s.created_date?.slice(0, 10)));
      consecutiveDaysWorked = uniqueDates.size;

      // Calculate workload
      const avgConsultationsPerDay = consultations.length / 7;
      const avgTasksPerDay = nurseTasks.length / 7;
      const avgHoursPerDay = totalHoursWorked / 7;

      // Burnout scoring
      let burnoutScore = 0;
      const burnoutFactors = [];

      if (avgHoursPerDay > 10) {
        burnoutScore += 30;
        burnoutFactors.push(`💼 Overworking: ${avgHoursPerDay.toFixed(1)} hrs/day`);
      }
      if (consecutiveDaysWorked >= 6) {
        burnoutScore += 25;
        burnoutFactors.push(`📅 No rest: Worked ${consecutiveDaysWorked}/7 days`);
      }
      if (["doctor", "clinician"].includes(person.role) && avgConsultationsPerDay > 12) {
        burnoutScore += 20;
        burnoutFactors.push(`👥 High patient load: ${avgConsultationsPerDay.toFixed(1)} consults/day`);
      }
      if (["nurse"].includes(person.role) && avgTasksPerDay > 15) {
        burnoutScore += 20;
        burnoutFactors.push(`📋 High task load: ${avgTasksPerDay.toFixed(1)} tasks/day`);
      }

      if (burnoutScore >= 50) {
        burnoutAlerts.push({
          staff_id: person.id,
          name: person.display_name || person.full_name,
          role: person.role,
          burnout_score: burnoutScore,
          factors: burnoutFactors,
          recommendation: burnoutScore > 70 ? "Immediate reallocation" : "Schedule rest days",
        });
      }
    }

    // Notify admin
    if (burnoutAlerts.length > 0) {
      await base44.asServiceRole.entities.Notification.create({
        title: `⚠️ ${burnoutAlerts.length} Staff at Burnout Risk`,
        message: `${burnoutAlerts.map(a => `${a.name} (${a.role}): Score ${a.burnout_score}`).join("; ")}. Review workload allocation.`,
        is_read: false,
        target_role: "admin",
        priority: "high",
      });
    }

    return Response.json({
      status: "success",
      date: today,
      staff_at_risk: burnoutAlerts.length,
      alerts: burnoutAlerts,
    });

  } catch (error) {
    console.error("Error calculating burnout risk:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});