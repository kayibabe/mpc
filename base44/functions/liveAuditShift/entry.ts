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
      if (method === 'cash') actual.cash += p.amount;
      else if (method === 'card') actual.card += p.amount;
      else if (method === 'airtel_money' || method === 'tnm_mpamba') actual.mobile += p.amount;
      else if (method === 'bank_transfer') actual.bank_transfer += p.amount;
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

    const severity = (diff) => {
      const abs = Math.abs(diff);
      if (abs < 500) return 'minor';
      if (abs < 5000) return 'warning';
      return 'critical';
    };

    const methods = [
      { type: 'cash', label: 'Cash', recorded: recorded.cash, actual: actual.cash },
      { type: 'card', label: 'Card', recorded: recorded.card, actual: actual.card },
      { type: 'mobile', label: 'Mobile Money', recorded: recorded.mobile, actual: actual.mobile },
    ];

    const discrepancies = [];
    for (const m of methods) {
      const diff = m.recorded - m.actual;
      const sev = severity(diff);
      if (Math.abs(diff) >= 500) {
        const existingFlags = await base44.asServiceRole.entities.AuditFlag.filter({
          shift_id: shift.id,
          discrepancy_type: m.type,
          is_resolved: false,
        });
        
        if (existingFlags.length === 0) {
          await base44.asServiceRole.entities.AuditFlag.create({
            shift_id: shift.id,
            cashier_id: shift.cashier_id,
            discrepancy_type: m.type,
            recorded_amount: m.recorded,
            actual_amount: m.actual,
            difference: diff,
            severity: sev,
            is_resolved: false,
            notes: `Auto-detected during live audit — ${shift.status === 'open' ? 'shift still open' : 'shift closed'}`,
          });
        } else {
          // Update existing flag with latest amounts
          await base44.asServiceRole.entities.AuditFlag.update(existingFlags[0].id, {
            recorded_amount: m.recorded,
            actual_amount: m.actual,
            difference: diff,
            severity: sev,
          });
        }
      } else {
        // Remove flags that have been resolved (difference fell below threshold)
        const existingFlags = await base44.asServiceRole.entities.AuditFlag.filter({
          shift_id: shift.id,
          discrepancy_type: m.type,
          is_resolved: false,
        });
        for (const flag of existingFlags) {
          await base44.asServiceRole.entities.AuditFlag.update(flag.id, {
            is_resolved: true,
            resolved_at: new Date().toISOString(),
            notes: (flag.notes || '') + ' | Auto-resolved: difference below threshold',
          });
        }
      }
      discrepancies.push({
        type: m.type,
        label: m.label,
        recorded: m.recorded,
        actual: m.actual,
        difference: diff,
        severity: sev,
      });
    }

    const totalDiff = recorded.total - actual.total;
    const totalSev = severity(totalDiff);

    // Create notification for critical discrepancies
    if (totalSev === 'critical' && !shift.closed_at) {
      await base44.asServiceRole.entities.Notification.create({
        title: '⚠ Critical Cashier Discrepancy',
        message: `Shift opened at ${new Date(shift.opened_at).toLocaleTimeString('en-GB')} has a MWK ${Math.abs(totalDiff).toLocaleString()} gap between recorded (MWK ${recorded.total.toLocaleString()}) and actual (MWK ${actual.total.toLocaleString()}) collections.`,
        type: 'alert',
        target_role: 'admin',
      });
    }

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
      discrepancies,
      total_actual: actual.total,
      total_recorded: recorded.total,
      total_discrepancy: totalDiff,
      total_severity: totalSev,
      is_clean: Math.abs(totalDiff) < 500,
      payment_count: payments.length,
      has_bank_transfers: actual.bank_transfer > 0,
      bank_transfer_total: actual.bank_transfer,
      insurance_recorded: recorded.insurance,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});