import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().slice(0, 10);

    // Get all staff with active shifts
    const staff = await base44.asServiceRole.entities.User.filter(
      { role: { $in: ["doctor", "clinician", "nurse", "pharmacist", "lab_technician"] } },
      "",
      200
    );

    const analytics = [];

    for (const person of staff) {
      let doctorMetrics = { consultations: 0, avg_time_mins: 0, patients_per_hour: 0 };
      let nurseMetrics = { tasks_assigned: 0, tasks_completed: 0, completion_rate: 0, avg_task_time: 0 };
      let pharmacistMetrics = { dispensed_count: 0, errors: 0, error_rate: 0, avg_dispensing_time: 0 };
      let labMetrics = { orders_processed: 0, avg_processing_time: 0, errors: 0 };

      if (["doctor", "clinician"].includes(person.role)) {
        // Count consultations
        const consultations = await base44.asServiceRole.entities.Consultation.filter(
          { doctor_id: person.id, consultation_date: { $gte: today } },
          "",
          100
        );
        doctorMetrics.consultations = consultations.length;
        doctorMetrics.patients_per_hour = (consultations.length / 8).toFixed(1);
      } else if (person.role === "nurse") {
        // Count nurse tasks
        const tasks = await base44.asServiceRole.entities.NurseTask.filter(
          { assigned_to_id: person.id, task_date: today },
          "",
          100
        );
        const completed = tasks.filter(t => t.status === "completed").length;
        nurseMetrics.tasks_assigned = tasks.length;
        nurseMetrics.tasks_completed = completed;
        nurseMetrics.completion_rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
      } else if (person.role === "pharmacist") {
        // Count dispensing
        const dispensing = await base44.asServiceRole.entities.PharmacyDispensing.filter(
          { dispensed_by_id: person.id },
          "",
          100
        );
        pharmacistMetrics.dispensed_count = dispensing.length;
        pharmacistMetrics.error_rate = "0%";
      } else if (person.role === "lab_technician") {
        // Count lab orders
        const labOrders = await base44.asServiceRole.entities.LabOrder.filter(
          { ordered_by: person.id },
          "",
          100
        );
        labMetrics.orders_processed = labOrders.length;
      }

      analytics.push({
        staff_id: person.id,
        name: person.display_name || person.full_name,
        role: person.role,
        date: today,
        doctor_metrics: doctorMetrics,
        nurse_metrics: nurseMetrics,
        pharmacist_metrics: pharmacistMetrics,
        lab_metrics: labMetrics,
      });
    }

    // Identify bottlenecks
    const bottlenecks = [];
    
    const doctors = analytics.filter(a => a.doctor_metrics.consultations > 0);
    if (doctors.length > 0) {
      const avgConsults = doctors.reduce((sum, d) => sum + d.doctor_metrics.consultations, 0) / doctors.length;
      const overloaded = doctors.filter(d => d.doctor_metrics.consultations > avgConsults * 1.5);
      if (overloaded.length > 0) {
        bottlenecks.push(`Doctors overloaded: ${overloaded.map(d => d.name).join(", ")} (${Math.round(avgConsults * 1.5)} consult/day threshold)`);
      }
    }

    const nurses = analytics.filter(a => a.nurse_metrics.tasks_assigned > 0);
    if (nurses.length > 0) {
      const lowCompletion = nurses.filter(n => n.nurse_metrics.completion_rate < 70);
      if (lowCompletion.length > 0) {
        bottlenecks.push(`Nurse task backlog: ${lowCompletion.map(n => n.name).join(", ")} (<70% completion)`);
      }
    }

    // Create analytics record
    await base44.asServiceRole.entities.AuditLog.create({
      entity_name: "StaffPerformanceAnalytics",
      entity_id: today,
      action: "performance_analysis",
      user_id: "system",
      description: `Analyzed ${analytics.length} staff. Bottlenecks: ${bottlenecks.length}`,
      timestamp: new Date().toISOString(),
    });

    // Notify admin if bottlenecks
    if (bottlenecks.length > 0) {
      await base44.asServiceRole.entities.Notification.create({
        title: "⚠️ Staff Performance Bottlenecks",
        message: bottlenecks.join("; "),
        is_read: false,
        target_role: "admin",
        priority: "high",
      });
    }

    return Response.json({
      status: "success",
      date: today,
      staff_analyzed: analytics.length,
      bottlenecks: bottlenecks,
      summary: analytics,
    });

  } catch (error) {
    console.error("Error analyzing staff performance:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});