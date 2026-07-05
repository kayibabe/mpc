import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { shift_id } = body;

    // Get the cashier shift
    const shift = await base44.asServiceRole.entities.CashierShift.get(shift_id);
    if (!shift) return Response.json({ error: 'Shift not found' }, { status: 404 });

    // Only the shift's cashier or an admin can reconcile it
    if (shift.cashier_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: can only reconcile your own shift' }, { status: 403 });
    }

    const openedAt = new Date(shift.opened_at);
    const closedAt = shift.closed_at ? new Date(shift.closed_at) : new Date();

    // Get all payments made during this shift's timeframe
    const payments = await base44.asServiceRole.entities.Payment.filter(
      {
        created_date: { $gte: openedAt.toISOString(), $lte: closedAt.toISOString() },
      },
      'created_date',
      2000
    );

    // Group actual payments by method
    const actual = { cash: 0, card: 0, mobile: 0, bank_transfer: 0, total: 0 };
    payments.forEach(p => {
      const method = p.payment_method;
      if (method === 'cash') {
        actual.cash += p.amount;
      } else if (method === 'card') {
        actual.card += p.amount;
      } else if (method === 'airtel_money' || method === 'tnm_mpamba') {
        actual.mobile += p.amount;
      } else if (method === 'bank_transfer') {
        actual.bank_transfer += p.amount;
      }
      actual.total += p.amount;
    });

    // Recorded totals from the shift
    const recorded = {
      cash: shift.total_cash_collected || 0,
      card: shift.total_card_collected || 0,
      mobile: shift.total_mobile_collected || 0,
      insurance: shift.total_insurance_claims || 0,
      total: (shift.total_cash_collected || 0) + (shift.total_card_collected || 0) + (shift.total_mobile_collected || 0),
    };

    // Calculate discrepancies
    const discrepancies = {
      cash: recorded.cash - actual.cash,
      card: recorded.card - actual.card,
      mobile: recorded.mobile - actual.mobile,
      total: recorded.total - actual.total,
    };

    // Severity: <500 MWK = minor, <5000 = warning, >=5000 = critical
    const severity = (diff) => {
      const abs = Math.abs(diff);
      if (abs < 500) return 'minor';
      if (abs < 5000) return 'warning';
      return 'critical';
    };

    const items = [
      {
        method: 'Cash',
        recorded: recorded.cash,
        actual: actual.cash,
        discrepancy: discrepancies.cash,
        severity: severity(discrepancies.cash),
      },
      {
        method: 'Card',
        recorded: recorded.card,
        actual: actual.card,
        discrepancy: discrepancies.card,
        severity: severity(discrepancies.card),
      },
      {
        method: 'Mobile Money',
        recorded: recorded.mobile,
        actual: actual.mobile,
        discrepancy: discrepancies.mobile,
        severity: severity(discrepancies.mobile),
      },
    ];

    const totalDiscrepancy = discrepancies.total;
    const totalSeverity = severity(totalDiscrepancy);
    const isReconciled = Math.abs(totalDiscrepancy) < 500;

    return Response.json({
      shift: {
        id: shift.id,
        cashier_id: shift.cashier_id,
        opened_at: shift.opened_at,
        closed_at: shift.closed_at,
        opening_balance: shift.opening_balance,
        closing_balance: shift.closing_balance,
        status: shift.status,
      },
      items,
      total_actual: actual.total,
      total_recorded: recorded.total,
      total_discrepancy: totalDiscrepancy,
      total_severity: totalSeverity,
      is_reconciled: isReconciled,
      payment_count: payments.length,
      has_bank_transfers: actual.bank_transfer > 0,
      bank_transfer_total: actual.bank_transfer,
      insurance_recorded: recorded.insurance,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});