import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all shifts in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const shifts = await base44.asServiceRole.entities.CashierShift.filter(
      { created_date: { $gte: thirtyDaysAgo } },
      "-created_date",
      200
    );

    // Fetch users for names
    const users = await base44.asServiceRole.entities.User.list("", 50);
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.full_name || u.email; });

    // Calculate metrics
    const totalShifts = shifts.length;
    const openShifts = shifts.filter(s => s.status === "open");
    const closedShifts = shifts.filter(s => s.status === "closed");

    let totalCash = 0;
    let totalCard = 0;
    let totalMobile = 0;
    let totalInsurance = 0;
    let totalOpening = 0;
    let totalClosing = 0;
    const shiftDetails = [];

    closedShifts.forEach(s => {
      totalCash += s.total_cash_collected || 0;
      totalCard += s.total_card_collected || 0;
      totalMobile += s.total_mobile_collected || 0;
      totalInsurance += s.total_insurance_claims || 0;
      totalOpening += s.opening_balance || 0;
      totalClosing += s.closing_balance || 0;

      const duration = s.closed_at && s.opened_at
        ? (new Date(s.closed_at) - new Date(s.opened_at)) / 3600000
        : null;

      shiftDetails.push({
        id: s.id,
        cashier: userMap[s.cashier_id] || "Unknown",
        opened: s.opened_at,
        closed: s.closed_at,
        duration_hours: duration ? Math.round(duration * 10) / 10 : null,
        opening_balance: s.opening_balance,
        closing_balance: s.closing_balance,
        cash: s.total_cash_collected || 0,
        card: s.total_card_collected || 0,
        mobile: s.total_mobile_collected || 0,
        insurance: s.total_insurance_claims || 0,
        total_collected: (s.total_cash_collected || 0) + (s.total_card_collected || 0) + (s.total_mobile_collected || 0),
        variance: (s.closing_balance || 0) - (s.opening_balance || 0) - ((s.total_cash_collected || 0) + (s.total_card_collected || 0) + (s.total_mobile_collected || 0)),
      });
    });

    const totalCollected = totalCash + totalCard + totalMobile;
    const avgShiftRevenue = closedShifts.length > 0 ? totalCollected / closedShifts.length : 0;
    const avgShiftDuration = shiftDetails.filter(s => s.duration_hours).reduce((sum, s) => sum + s.duration_hours, 0) / (shiftDetails.filter(s => s.duration_hours).length || 1);

    // Per-cashier breakdown
    const cashierStats = {};
    shiftDetails.forEach(s => {
      if (!cashierStats[s.cashier]) {
        cashierStats[s.cashier] = { shifts: 0, total: 0, cash: 0, card: 0, mobile: 0, insurance: 0 };
      }
      cashierStats[s.cashier].shifts++;
      cashierStats[s.cashier].total += s.total_collected;
      cashierStats[s.cashier].cash += s.cash;
      cashierStats[s.cashier].card += s.card;
      cashierStats[s.cashier].mobile += s.mobile;
      cashierStats[s.cashier].insurance += s.insurance;
    });

    const cashierBreakdown = Object.entries(cashierStats).map(([name, stats]) => ({
      cashier: name,
      ...stats,
      avg_per_shift: Math.round(stats.total / stats.shifts),
    })).sort((a, b) => b.total - a.total);

    // Payment method breakdown
    const paymentBreakdown = [
      { method: "Cash", amount: totalCash, percentage: totalCollected > 0 ? Math.round(totalCash / totalCollected * 100) : 0 },
      { method: "Card", amount: totalCard, percentage: totalCollected > 0 ? Math.round(totalCard / totalCollected * 100) : 0 },
      { method: "Mobile Money", amount: totalMobile, percentage: totalCollected > 0 ? Math.round(totalMobile / totalCollected * 100) : 0 },
    ];

    return Response.json({
      period: "30 days",
      generated_at: new Date().toISOString(),
      summary: {
        total_shifts: totalShifts,
        open_shifts: openShifts.length,
        closed_shifts: closedShifts.length,
        total_collected_mwk: Math.round(totalCollected),
        total_insurance_claims: Math.round(totalInsurance),
        avg_shift_revenue_mwk: Math.round(avgShiftRevenue),
        avg_shift_duration_hours: Math.round(avgShiftDuration * 10) / 10,
        total_opening_balance: Math.round(totalOpening),
        total_closing_balance: Math.round(totalClosing),
      },
      payment_breakdown: paymentBreakdown,
      cashier_breakdown: cashierBreakdown,
      recent_shifts: shiftDetails.slice(0, 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});