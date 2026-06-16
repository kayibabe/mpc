import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    // Only react to create or update events on Drug
    if (!event || !["create", "update"].includes(event.type)) {
      return Response.json({ skipped: true, reason: "Not a create/update event" });
    }

    const drug = data;
    if (!drug) return Response.json({ skipped: true, reason: "No drug data" });

    const qty = drug.quantity_in_stock;
    const reorder = drug.reorder_level;
    const expiry = drug.expiry_date;

    const alerts = [];
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    // Low stock
    if (qty !== undefined && reorder !== undefined && qty <= reorder) {
      const sev = qty === 0 ? "critical" : "warning";
      alerts.push({
        type: "low_stock", severity: sev,
        message: qty === 0 ? `OUT OF STOCK: ${drug.name}` : `LOW STOCK: ${drug.name} (${qty} left, reorder at ${reorder})`,
      });
    }

    // Expiring/expired
    if (expiry) {
      if (expiry < today) {
        alerts.push({ type: "expired", severity: "critical", message: `EXPIRED: ${drug.name} batch ${drug.batch_number || "N/A"}` });
      } else if (expiry <= thirtyDays) {
        const daysLeft = Math.ceil((new Date(expiry) - new Date()) / 86400000);
        alerts.push({ type: "expiring", severity: daysLeft <= 7 ? "critical" : "warning", message: `EXPIRING: ${drug.name} in ${daysLeft}d` });
      }
    }

    if (alerts.length === 0) {
      return Response.json({ skipped: true, reason: "No threshold breaches" });
    }

    // Create notifications for pharmacy role
    for (const alert of alerts) {
      await base44.asServiceRole.entities.Notification.create({
        title: alert.severity === "critical" ? `🚨 Inventory Alert: ${drug.name}` : `⚠️ Inventory Warning: ${drug.name}`,
        message: alert.message,
        type: "alert",
        target_role: "pharmacist",
        is_read: false,
        action_url: "/pharmacy",
      });
    }

    return Response.json({
      success: true,
      drug_id: drug.id,
      drug_name: drug.name,
      alerts_created: alerts.length,
      alerts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});