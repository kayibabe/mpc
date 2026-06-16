import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Find all open cashier shifts
    const openShifts = await base44.asServiceRole.entities.CashierShift.filter(
      { status: 'open' },
      '-created_date',
      20
    );

    let flagsCreated = 0;
    let flagsUpdated = 0;

    for (const shift of openShifts) {
      const openedAt = new Date(shift.opened_at);
      const now = new Date();

      const payments = await base44.asServiceRole.entities.Payment.filter(
        { created_date: { $gte: openedAt.toISOString(), $lte: now.toISOString() } },
        'created_date',
        2000
      );

      const actual = { cash: 0, card: 0, mobile: 0 };
      payments.forEach(p => {
        if (p.payment_method === 'cash') actual.cash += p.amount;
        else if (p.payment_method === 'card') actual.card += p.amount;
        else if (p.payment_method === 'airtel_money' || p.payment_method === 'tnm_mpamba') actual.mobile += p.amount;
      });

      const recorded = {
        cash: shift.total_cash_collected || 0,
        card: shift.total_card_collected || 0,
        mobile: shift.total_mobile_collected || 0,
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

      for (const m of methods) {
        const diff = m.recorded - m.actual;
        const sev = severity(diff);

        const existingFlags = await base44.asServiceRole.entities.AuditFlag.filter({
          shift_id: shift.id,
          discrepancy_type: m.type,
          is_resolved: false,
        });

        if (Math.abs(diff) >= 500) {
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
              notes: `Auto-flagged on payment event — MWK ${Math.abs(diff).toLocaleString()} discrepancy in ${m.label}`,
            });
            flagsCreated++;
          } else {
            await base44.asServiceRole.entities.AuditFlag.update(existingFlags[0].id, {
              recorded_amount: m.recorded,
              actual_amount: m.actual,
              difference: diff,
              severity: sev,
            });
            flagsUpdated++;
          }
        } else {
          // Auto-resolve flags below threshold
          for (const flag of existingFlags) {
            await base44.asServiceRole.entities.AuditFlag.update(flag.id, {
              is_resolved: true,
              resolved_at: now.toISOString(),
              notes: (flag.notes || '') + ' | Auto-resolved after new payment brought difference below threshold',
            });
          }
        }
      }

      // Notification for critical discrepancies
      const totalDiff = (recorded.cash + recorded.card + recorded.mobile) - (actual.cash + actual.card + actual.mobile);
      if (severity(totalDiff) === 'critical') {
        await base44.asServiceRole.entities.Notification.create({
          title: '🚨 Cashier Discrepancy Alert',
          message: `Shift opened at ${new Date(shift.opened_at).toLocaleTimeString('en-GB')} has MWK ${Math.abs(totalDiff).toLocaleString()} gap. Recorded: MWK ${(recorded.cash + recorded.card + recorded.mobile).toLocaleString()} vs Actual: MWK ${(actual.cash + actual.card + actual.mobile).toLocaleString()}`,
          type: 'alert',
          target_role: 'admin',
        });
      }
    }

    return Response.json({
      success: true,
      open_shifts: openShifts.length,
      flags_created: flagsCreated,
      flags_updated: flagsUpdated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});