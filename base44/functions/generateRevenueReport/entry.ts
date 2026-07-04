import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'cashier'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: admin or cashier role required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const period = body.period || "30days";
    let startDate;

    switch (period) {
      case "today":
        startDate = new Date().toISOString().slice(0, 10);
        break;
      case "7days":
        startDate = new Date(Date.now() - 7 * 86400000).toISOString();
        break;
      case "30days":
        startDate = new Date(Date.now() - 30 * 86400000).toISOString();
        break;
      case "90days":
        startDate = new Date(Date.now() - 90 * 86400000).toISOString();
        break;
      case "year":
        startDate = new Date(Date.now() - 365 * 86400000).toISOString();
        break;
      default:
        startDate = new Date(Date.now() - 30 * 86400000).toISOString();
    }

    const invoices = await base44.asServiceRole.entities.Invoice.filter(
      { created_date: { $gte: startDate } },
      "-created_date",
      1000
    );

    const payments = await base44.asServiceRole.entities.Payment.filter(
      { created_date: { $gte: startDate } },
      "-created_date",
      1000
    );

    const claims = await base44.asServiceRole.entities.InsuranceClaim.filter(
      { created_date: { $gte: startDate } },
      "-created_date",
      500
    );

    // Revenue by status
    const byStatus = {};
    invoices.forEach(inv => {
      const status = inv.status || "pending";
      if (!byStatus[status]) byStatus[status] = { count: 0, amount: 0 };
      byStatus[status].count++;
      byStatus[status].amount += inv.net_amount || inv.total_amount || 0;
    });

    // Revenue by payment type
    const byPaymentType = {};
    invoices.forEach(inv => {
      const pt = inv.payment_type || "cash";
      if (!byPaymentType[pt]) byPaymentType[pt] = { count: 0, amount: 0 };
      byPaymentType[pt].count++;
      byPaymentType[pt].amount += inv.net_amount || inv.total_amount || 0;
    });

    // Revenue by department (from visit linkage)
    const byDepartment = {};
    for (const inv of invoices) {
      // Try to get department from visit
      let dept = "unknown";
      try {
        if (inv.visit_id) {
          const visit = await base44.asServiceRole.entities.Visit.get(inv.visit_id);
          if (visit) dept = visit.department || visit.visit_type || "unknown";
        }
      } catch (_) {}
      if (!byDepartment[dept]) byDepartment[dept] = { count: 0, amount: 0 };
      byDepartment[dept].count++;
      byDepartment[dept].amount += inv.net_amount || inv.total_amount || 0;
    }

    // Daily revenue trend
    const dailyMap = {};
    invoices.forEach(inv => {
      const day = inv.created_date?.slice(0, 10);
      if (!day) return;
      if (!dailyMap[day]) dailyMap[day] = 0;
      dailyMap[day] += inv.net_amount || inv.total_amount || 0;
    });
    const dailyTrend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount: Math.round(amount) }));

    // Payment method breakdown
    const byPaymentMethod = {};
    payments.forEach(p => {
      const method = p.payment_method || "cash";
      if (!byPaymentMethod[method]) byPaymentMethod[method] = { count: 0, amount: 0 };
      byPaymentMethod[method].count++;
      byPaymentMethod[method].amount += p.amount || 0;
    });

    // Insurance claim stats
    const claimStats = {
      total: claims.length,
      approved: claims.filter(c => c.status === "approved" || c.status === "paid").length,
      pending: claims.filter(c => c.status === "pending" || c.status === "submitted").length,
      rejected: claims.filter(c => c.status === "rejected").length,
      totalAmount: claims.reduce((s, c) => s + (c.claim_amount || 0), 0),
      approvedAmount: claims.filter(c => c.status === "approved" || c.status === "paid").reduce((s, c) => s + (c.claim_amount || 0), 0),
    };

    const totalRevenue = invoices.reduce((s, i) => s + (i.net_amount || i.total_amount || 0), 0);
    const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalOutstanding = totalRevenue - totalCollected;

    return Response.json({
      period,
      start_date: startDate,
      generated_at: new Date().toISOString(),
      summary: {
        total_revenue: Math.round(totalRevenue),
        total_collected: Math.round(totalCollected),
        total_outstanding: Math.round(totalOutstanding),
        total_invoices: invoices.length,
        total_payments: payments.length,
        collection_rate: totalRevenue > 0 ? Math.round(totalCollected / totalRevenue * 100) : 0,
      },
      by_status: Object.entries(byStatus).map(([status, data]) => ({ status, ...data, amount: Math.round(data.amount) })),
      by_payment_type: Object.entries(byPaymentType).map(([type, data]) => ({ type, ...data, amount: Math.round(data.amount) })),
      by_department: Object.entries(byDepartment).map(([dept, data]) => ({ department: dept, ...data, amount: Math.round(data.amount) })).sort((a, b) => b.amount - a.amount),
      by_payment_method: Object.entries(byPaymentMethod).map(([method, data]) => ({ method, ...data, amount: Math.round(data.amount) })),
      daily_trend: dailyTrend,
      insurance_claims: claimStats,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});