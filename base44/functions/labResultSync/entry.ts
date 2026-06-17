import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Sync pending lab results to consultations
    const pendingOrders = await base44.entities.LabOrder.filter(
      { status: { $in: ["in_progress", "completed"] } },
      "-created_date",
      200
    );

    const results = await base44.entities.LabResult.filter(
      { status: { $in: ["final", "preliminary"] } },
      "-created_date",
      500
    );

    // Sync critical results to notifications
    const criticalResults = results.filter(r => r.is_critical);
    for (const result of criticalResults) {
      await base44.entities.Notification.create({
        title: "Critical Lab Result",
        message: `${result.test_name}: ${result.result_value} (Critical)`,
        target_role: "admin",
        is_read: false,
      });
    }

    return Response.json({
      synced_orders: pendingOrders.length,
      synced_results: results.length,
      critical_alerts: criticalResults.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});