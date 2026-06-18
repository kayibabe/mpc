import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().slice(0, 10);

    const visits = await base44.asServiceRole.entities.Visit.filter(
      { queue_status: { $in: ["waiting", "triaged", "in_consultation", "in_lab", "in_pharmacy"] } },
      "",
      200
    );

    const bottlenecks = {
      waiting: [],
      triaged: [],
      consultation: [],
      lab: [],
      pharmacy: [],
    };

    const avgWaitTimes = {
      waiting: 0,
      triaged: 0,
      consultation: 0,
      lab: 0,
      pharmacy: 0,
    };

    // Calculate wait times by status
    visits.forEach(v => {
      const waitMinutes = Math.round((Date.now() - new Date(v.created_date).getTime()) / 60000);
      const status = v.queue_status;

      if (status === "waiting" && waitMinutes > 20) bottlenecks.waiting.push(v);
      if (status === "triaged" && waitMinutes > 30) bottlenecks.triaged.push(v);
      if (status === "in_consultation" && waitMinutes > 45) bottlenecks.consultation.push(v);
      if (status === "in_lab" && waitMinutes > 60) bottlenecks.lab.push(v);
      if (status === "in_pharmacy" && waitMinutes > 30) bottlenecks.pharmacy.push(v);
    });

    const alerts = [];
    const slowestStage = Object.entries(bottlenecks).reduce((a, [k, v]) => v.length > a[1].length ? [k, v] : a, ["", []]);

    if (bottlenecks.waiting.length > 5) {
      alerts.push(`🔴 Triage bottleneck: ${bottlenecks.waiting.length} waiting >20min`);
    }
    if (bottlenecks.consultation.length > 3) {
      alerts.push(`🟠 Doctor bottleneck: ${bottlenecks.consultation.length} in consultation >45min`);
    }
    if (bottlenecks.lab.length > 2) {
      alerts.push(`🟠 Lab bottleneck: ${bottlenecks.lab.length} results pending >60min`);
    }
    if (bottlenecks.pharmacy.length > 4) {
      alerts.push(`🟠 Pharmacy bottleneck: ${bottlenecks.pharmacy.length} waiting >30min`);
    }

    if (alerts.length > 0) {
      await base44.asServiceRole.entities.Notification.create({
        title: "⏱️ Queue Bottleneck Alert",
        message: alerts.join("; ") + `. Slowest stage: ${slowestStage[0]}. Deploy staff to bottleneck area.`,
        is_read: false,
        target_role: "receptionist",
        priority: "high",
      });
    }

    return Response.json({
      status: "success",
      timestamp: new Date().toISOString(),
      total_waiting: visits.length,
      bottlenecks: {
        waiting_queue: bottlenecks.waiting.length,
        triage_queue: bottlenecks.triaged.length,
        consultation_queue: bottlenecks.consultation.length,
        lab_queue: bottlenecks.lab.length,
        pharmacy_queue: bottlenecks.pharmacy.length,
      },
      slowest_stage: slowestStage[0],
      alerts: alerts,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});