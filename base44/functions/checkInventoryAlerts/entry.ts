import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const drugs = await base44.asServiceRole.entities.Drug.filter({ status: 'active' }, '', 500);

    const lowStock = drugs.filter(d => d.quantity_in_stock <= d.reorder_level);
    const expiring = drugs.filter(d => d.expiry_date && d.expiry_date <= thirtyDaysOut && d.expiry_date >= today);
    const expired = drugs.filter(d => d.expiry_date && d.expiry_date < today);

    const alerts = [];

    // Low stock alerts
    for (const drug of lowStock) {
      alerts.push({
        type: 'low_stock',
        severity: drug.quantity_in_stock === 0 ? 'critical' : 'warning',
        drug_name: drug.name,
        generic_name: drug.generic_name,
        current_stock: drug.quantity_in_stock,
        reorder_level: drug.reorder_level,
        message: drug.quantity_in_stock === 0
          ? `OUT OF STOCK: ${drug.name} — reorder immediately`
          : `LOW STOCK: ${drug.name} (${drug.quantity_in_stock} remaining, reorder at ${drug.reorder_level})`,
      });
    }

    // Expiry alerts
    for (const drug of expiring) {
      const daysLeft = Math.ceil((new Date(drug.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: 'expiring',
        severity: daysLeft <= 7 ? 'critical' : 'warning',
        drug_name: drug.name,
        generic_name: drug.generic_name,
        expiry_date: drug.expiry_date,
        days_until_expiry: daysLeft,
        batch_number: drug.batch_number,
        message: `EXPIRING: ${drug.name} batch ${drug.batch_number || 'N/A'} expires in ${daysLeft} days (${drug.expiry_date})`,
      });
    }

    // Expired
    for (const drug of expired) {
      alerts.push({
        type: 'expired',
        severity: 'critical',
        drug_name: drug.name,
        generic_name: drug.generic_name,
        expiry_date: drug.expiry_date,
        batch_number: drug.batch_number,
        message: `EXPIRED: ${drug.name} batch ${drug.batch_number || 'N/A'} expired ${drug.expiry_date} — remove from inventory`,
      });
    }

    // Send email summary if there are critical alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      const emailBody = `Zomba City Private Clinic — Inventory Alert Summary\n\n${criticalAlerts.map(a => `• ${a.message}`).join('\n')}\n\nPlease take action immediately. Login to review: (your HIMS URL)\n\n— HIMS System`;
      // Note: email would go to pharmacy/admin — for now we log; add admin emails when configured
    }

    return Response.json({
      generated_at: new Date().toISOString(),
      total_drugs: drugs.length,
      total_alerts: alerts.length,
      critical_count: criticalAlerts.length,
      low_stock_count: lowStock.length,
      expiring_count: expiring.length,
      expired_count: expired.length,
      alerts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});