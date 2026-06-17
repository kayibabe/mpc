import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    // Check expiring drugs
    const [expiringDrugs, expiredDrugs] = await Promise.all([
      base44.entities.Drug.filter({
        expiry_date: { $gte: todayStr, $lte: thirtyDaysFromNow }
      }, "-expiry_date", 200),
      base44.entities.Drug.filter({
        expiry_date: { $lt: todayStr }
      }, "-expiry_date", 200),
    ]);

    // Check expiring reagents
    const [expiringReagents, expiredReagents] = await Promise.all([
      base44.entities.LabReagent.filter({
        expiry_date: { $gte: todayStr, $lte: thirtyDaysFromNow }
      }, "-expiry_date", 200),
      base44.entities.LabReagent.filter({
        expiry_date: { $lt: todayStr }
      }, "-expiry_date", 200),
    ]);

    const alerts = [];

    // Create alerts for expired items
    if (expiredDrugs.length > 0) {
      alerts.push({
        type: "expired_drugs",
        count: expiredDrugs.length,
        severity: "critical",
        items: expiredDrugs.slice(0, 5),
      });

      await base44.entities.Notification.create({
        title: "EXPIRED DRUGS - Immediate Disposal Required",
        message: `${expiredDrugs.length} expired drugs detected. Remove from stock immediately.`,
        target_role: "admin",
        is_read: false,
      });
    }

    if (expiredReagents.length > 0) {
      alerts.push({
        type: "expired_reagents",
        count: expiredReagents.length,
        severity: "critical",
        items: expiredReagents.slice(0, 5),
      });

      await base44.entities.Notification.create({
        title: "EXPIRED REAGENTS - Immediate Disposal Required",
        message: `${expiredReagents.length} expired reagents detected. Remove from stock immediately.`,
        target_role: "admin",
        is_read: false,
      });
    }

    // Create alerts for expiring items
    if (expiringDrugs.length > 0) {
      alerts.push({
        type: "expiring_drugs",
        count: expiringDrugs.length,
        severity: "warning",
        items: expiringDrugs.slice(0, 5),
      });

      await base44.entities.Notification.create({
        title: "Drugs Expiring Soon",
        message: `${expiringDrugs.length} drugs will expire within 30 days. Plan usage accordingly.`,
        target_role: "admin",
        is_read: false,
      });
    }

    if (expiringReagents.length > 0) {
      alerts.push({
        type: "expiring_reagents",
        count: expiringReagents.length,
        severity: "warning",
        items: expiringReagents.slice(0, 5),
      });

      await base44.entities.Notification.create({
        title: "Reagents Expiring Soon",
        message: `${expiringReagents.length} reagents will expire within 30 days. Plan usage accordingly.`,
        target_role: "admin",
        is_read: false,
      });
    }

    return Response.json({
      alerts_generated: alerts.length,
      expired_drugs: expiredDrugs.length,
      expired_reagents: expiredReagents.length,
      expiring_drugs: expiringDrugs.length,
      expiring_reagents: expiringReagents.length,
      check_date: todayStr,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});