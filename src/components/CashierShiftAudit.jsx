import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DollarSign, Clock, User, TrendingUp, Wallet, CreditCard, Smartphone, Building2 } from "lucide-react";

const PAYMENT_METHODS = ["cash", "card", "airtel_money", "tnm_mpamba", "bank_transfer"];

const METHOD_LABELS = {
  cash: "Cash",
  card: "Card",
  airtel_money: "Airtel Money",
  tnm_mpamba: "TNM Mpamba",
  bank_transfer: "Bank Transfer",
};

const METHOD_ICONS = {
  cash: Wallet,
  card: CreditCard,
  airtel_money: Smartphone,
  tnm_mpamba: Smartphone,
  bank_transfer: Building2,
};

export default function CashierShiftAudit() {
  const [shifts, setShifts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedShift, setExpandedShift] = useState(null);
  const [todaySummary, setTodaySummary] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [s, p, u] = await Promise.all([
          base44.entities.CashierShift.list("-created_date", 100),
          base44.entities.Payment.filter({ created_date: { $gte: today } }, "-created_date", 500),
          base44.entities.User.list("", 50),
        ]);
        setShifts(s);
        setPayments(p);
        setUsers(u);
        // Calculate today's summary
        const summary = {};
        PAYMENT_METHODS.forEach(m => { summary[m] = 0; });
        let total = 0;
        p.forEach(pmt => {
          const m = pmt.payment_method;
          if (summary[m] !== undefined) summary[m] += pmt.amount || 0;
          total += pmt.amount || 0;
        });
        setTodaySummary({ byMethod: summary, total, count: p.length });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getUserName = (uid) => {
    const u = users.find(u => u.id === uid);
    return u ? u.full_name || u.email : uid?.slice(0, 8) || "Unknown";
  };

  const getShiftPayments = (shift) => {
    if (!shift.opened_at || !shift.closed_at) return [];
    const openTime = new Date(shift.opened_at).getTime();
    const closeTime = shift.closed_at ? new Date(shift.closed_at).getTime() : Date.now();
    return payments.filter(p => {
      const pt = new Date(p.payment_date || p.created_date).getTime();
      return pt >= openTime && pt <= closeTime && p.payment_method !== "card" && p.payment_method !== "airtel_money" && p.payment_method !== "tnm_mpamba" && p.payment_method !== "bank_transfer" ? false : true;
    });
  };

  const getShiftTotal = (shift) => {
    const shiftPayments = getShiftPayments(shift);
    return shiftPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  const getShiftCashTotal = (shift) => {
    const shiftPayments = getShiftPayments(shift);
    return shiftPayments.filter(p => p.payment_method === "cash").reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  const getDiscrepancy = (shift) => {
    const cashCollected = getShiftCashTotal(shift);
    const expected = (shift.total_cash_collected || 0);
    // Try to calculate from payments if no explicit total
    const effective = shift.total_cash_collected || cashCollected;
    const closing = shift.closing_balance || 0;
    // Discrepancy = (opening + collected) - closing
    const opening = shift.opening_balance || 0;
    return (opening + effective) - closing;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Today's summary
  const todayOpenShifts = shifts.filter(s => s.status === "open");
  const todayClosedShifts = shifts.filter(s => s.status === "closed");

  return (
    <div className="space-y-6">
      {/* Today's Collection Summary */}
      {todaySummary && (
        <div className="bg-card rounded-xl border border-border/60 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Today's Collections
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {PAYMENT_METHODS.map(method => {
              const Icon = METHOD_ICONS[method];
              const amt = todaySummary.byMethod[method] || 0;
              if (amt === 0) return null;
              return (
                <div key={method} className="bg-muted/20 rounded-lg p-3 text-center">
                  <Icon className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-bold font-mono">{amt.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{METHOD_LABELS[method]}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-center">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{todaySummary.total.toLocaleString()} MWK</strong> total from {todaySummary.count} payments today
            </p>
          </div>
        </div>
      )}

      {/* Open Shifts Alert */}
      {todayOpenShifts.length > 0 && (
        <div className="bg-chart-2/5 border border-chart-2/20 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-chart-2 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-chart-2">{todayOpenShifts.length} open shift(s)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {todayOpenShifts.map(s => getUserName(s.cashier_id)).join(", ")} — 
              shifts must be closed for accurate reconciliation
            </p>
          </div>
        </div>
      )}

      {/* Shift Audit Table */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="font-heading font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Cashier Shift Audit
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{shifts.length} shifts recorded</p>
        </div>

        {shifts.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No cashier shifts recorded yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Shifts are created on the Billing page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Cashier</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Opened</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Closed</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Opening Bal.</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Cash Collected</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Closing Bal.</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Discrepancy</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map(shift => {
                  const discrepancy = getDiscrepancy(shift);
                  const isReconciled = Math.abs(discrepancy) < 1;
                  return (
                    <tr key={shift.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-primary" />
                          <span className="font-medium">{getUserName(shift.cashier_id)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">{new Date(shift.opened_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-3 px-4 text-xs">
                        {shift.closed_at
                          ? new Date(shift.closed_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                          : <span className="text-chart-2 font-medium">Open</span>
                        }
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs">{(shift.opening_balance || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs">{(shift.total_cash_collected || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs">{(shift.closing_balance || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        {shift.status === "open" ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <span className={`font-mono text-xs font-semibold ${isReconciled ? "text-clinical-normal" : "text-destructive"}`}>
                            {isReconciled ? "✓ 0" : `${discrepancy > 0 ? "+" : ""}${discrepancy.toLocaleString()}`}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          shift.status === "open" ? "bg-chart-2/10 text-chart-2" :
                          isReconciled ? "bg-clinical-normal/10 text-clinical-normal" :
                          "bg-destructive/10 text-destructive"
                        }`}>
                          {shift.status === "open" ? "Open" : isReconciled ? "Reconciled" : "Discrepancy"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border/60 p-3 text-center">
          <p className="text-2xl font-bold">{shifts.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Shifts</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-3 text-center">
          <p className="text-2xl font-bold text-chart-2">{shifts.filter(s => s.status === "open").length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Open Now</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-3 text-center">
          <p className="text-2xl font-bold text-clinical-normal">{shifts.filter(s => s.status === "closed" && Math.abs(getDiscrepancy(s)) < 1).length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reconciled</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{shifts.filter(s => s.status === "closed" && Math.abs(getDiscrepancy(s)) >= 1).length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Discrepancies</p>
        </div>
      </div>
    </div>
  );
}