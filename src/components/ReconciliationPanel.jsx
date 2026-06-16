import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { RotateCcw, CheckCircle, AlertTriangle, XCircle, Loader2, DollarSign, CreditCard, Smartphone, Building2, Shield, ChevronDown, ChevronUp } from "lucide-react";

const SEVERITY_STYLES = {
  minor: "bg-muted/50 border-border",
  warning: "bg-amber-500/5 border-amber-500/20",
  critical: "bg-destructive/5 border-destructive/20",
};

const SEVERITY_ICONS = {
  minor: CheckCircle,
  warning: AlertTriangle,
  critical: XCircle,
};

const SEVERITY_ICON_COLORS = {
  minor: "text-chart-3",
  warning: "text-chart-2",
  critical: "text-destructive",
};

export default function ReconciliationPanel() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState({});
  const [results, setResults] = useState({});
  const [expandedShift, setExpandedShift] = useState(null);

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    try {
      const s = await base44.entities.CashierShift.list("-created_date", 30);
      setShifts(s);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const reconcileShift = async (shift) => {
    setReconciling(prev => ({ ...prev, [shift.id]: true }));
    try {
      const { data } = await base44.functions.invoke("reconcileShift", { shift_id: shift.id });
      setResults(prev => ({ ...prev, [shift.id]: data }));
      setExpandedShift(shift.id);
    } catch (e) {
      console.error(e);
    } finally {
      setReconciling(prev => ({ ...prev, [shift.id]: false }));
    }
  };

  const formatMWK = (val) => (val || 0).toLocaleString();
  const diffColor = (val) => Math.abs(val) < 500 ? "text-chart-3" : Math.abs(val) < 5000 ? "text-chart-2" : "text-destructive";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-heading font-semibold text-sm flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" /> Daily Reconciliation
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">Compare recorded collections against actual payment transactions</p>
        </div>
        <button onClick={loadShifts} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {shifts.length === 0 ? (
        <div className="py-12 text-center">
          <RotateCcw className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No cashier shifts recorded yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Shifts appear here once a cashier opens and closes a shift.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[650px] overflow-y-auto">
          {shifts.map(shift => {
            const result = results[shift.id];
            const isReconciling = reconciling[shift.id];
            const isExpanded = expandedShift === shift.id;

            return (
              <div key={shift.id} className={`rounded-xl border ${result ? SEVERITY_STYLES[result.total_severity] : "border-border/50 bg-muted/10"}`}>
                {/* Shift Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => {
                    if (result) {
                      setExpandedShift(isExpanded ? null : shift.id);
                    } else {
                      reconcileShift(shift);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      shift.status === "closed" ? "bg-chart-3/10" : "bg-primary/10"
                    }`}>
                      <RotateCcw className={`w-4 h-4 ${shift.status === "closed" ? "text-chart-3" : "text-primary"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        Shift {new Date(shift.opened_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — {new Date(shift.opened_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {shift.status === "closed" ? "Closed" : "Open"}
                        {shift.closing_balance != null && ` • Closing: MWK ${shift.closing_balance.toLocaleString()}`}
                      </p>
                    </div>
                    {/* Quick discrepancy badge */}
                    {result && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        result.is_reconciled
                          ? "bg-chart-3/10 text-chart-3"
                          : result.total_severity === "critical"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-chart-2/10 text-chart-2"
                      }`}>
                        {result.is_reconciled ? "Matched" : `MWK ${Math.abs(result.total_discrepancy).toLocaleString()} off`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isReconciling ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : !result ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); reconcileShift(shift); }}
                        className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Reconcile
                      </button>
                    ) : (
                      isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && result && (
                  <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/5">
                    {/* Summary Banner */}
                    <div className={`p-3 rounded-lg border flex items-center gap-3 ${
                      result.is_reconciled
                        ? "bg-chart-3/5 border-chart-3/20"
                        : result.total_severity === "critical"
                        ? "bg-destructive/5 border-destructive/20"
                        : "bg-chart-2/5 border-chart-2/20"
                    }`}>
                      {(() => {
                        const Icon = SEVERITY_ICONS[result.total_severity];
                        return (
                          <Icon className={`w-5 h-5 flex-shrink-0 ${
                            result.is_reconciled ? "text-chart-3" : SEVERITY_ICON_COLORS[result.total_severity]
                          }`} />
                        );
                      })()}
                      <div>
                        <p className={`text-sm font-semibold ${result.is_reconciled ? "text-chart-3" : result.total_severity === "critical" ? "text-destructive" : "text-chart-2"}`}>
                          {result.is_reconciled
                            ? "Reconciled — No significant discrepancy"
                            : `Discrepancy Detected: MWK ${Math.abs(result.total_discrepancy).toLocaleString()} ${result.total_discrepancy > 0 ? "over-recorded" : "under-recorded"}`
                          }
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {result.payment_count} payments processed • {result.has_bank_transfers ? "Includes bank transfers" : "No bank transfers"}
                          {result.insurance_recorded > 0 ? ` • Insurance: MWK ${result.insurance_recorded.toLocaleString()}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Detailed Breakdown Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Method</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Recorded (MWK)</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Actual (MWK)</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Difference</th>
                            <th className="text-center py-2 px-3 font-medium text-muted-foreground w-16">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.items.map((item, i) => (
                            <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                              <td className="py-2.5 px-3 font-medium flex items-center gap-1.5">
                                {item.method === "Cash" ? <DollarSign className="w-3 h-3 text-chart-2" />
                                  : item.method === "Card" ? <CreditCard className="w-3 h-3 text-chart-4" />
                                  : <Smartphone className="w-3 h-3 text-chart-1" />}
                                {item.method}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">{formatMWK(item.recorded)}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{formatMWK(item.actual)}</td>
                              <td className={`py-2.5 px-3 text-right font-mono font-semibold ${diffColor(item.discrepancy)}`}>
                                {item.discrepancy > 0 ? "+" : ""}{formatMWK(item.discrepancy)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {Math.abs(item.discrepancy) < 500 ? (
                                  <CheckCircle className="w-4 h-4 text-chart-3 mx-auto" />
                                ) : Math.abs(item.discrepancy) < 5000 ? (
                                  <AlertTriangle className="w-4 h-4 text-chart-2 mx-auto" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-destructive mx-auto" />
                                )}
                              </td>
                            </tr>
                          ))}
                          {/* Totals Row */}
                          <tr className="bg-muted/30 font-semibold">
                            <td className="py-2.5 px-3">Total</td>
                            <td className="py-2.5 px-3 text-right font-mono">{formatMWK(result.total_recorded)}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{formatMWK(result.total_actual)}</td>
                            <td className={`py-2.5 px-3 text-right font-mono ${diffColor(result.total_discrepancy)}`}>
                              {result.total_discrepancy > 0 ? "+" : ""}{formatMWK(result.total_discrepancy)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {result.is_reconciled ? (
                                <CheckCircle className="w-4 h-4 text-chart-3 mx-auto" />
                              ) : (
                                <AlertTriangle className={`w-4 h-4 mx-auto ${result.total_severity === "critical" ? "text-destructive" : "text-chart-2"}`} />
                              )}
                            </td>
                          </tr>
                          {/* Bank transfers (informational) */}
                          {result.has_bank_transfers && (
                            <tr className="text-muted-foreground">
                              <td className="py-2 px-3 flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Bank Transfers</td>
                              <td className="py-2 px-3 text-right">—</td>
                              <td className="py-2 px-3 text-right font-mono">{formatMWK(result.bank_transfer_total)}</td>
                              <td className="py-2 px-3 text-right text-muted-foreground">(info)</td>
                              <td className="py-2 px-3"></td>
                            </tr>
                          )}
                          {result.insurance_recorded > 0 && (
                            <tr className="text-muted-foreground">
                              <td className="py-2 px-3 flex items-center gap-1.5"><Shield className="w-3 h-3" /> Insurance</td>
                              <td className="py-2 px-3 text-right font-mono">{formatMWK(result.insurance_recorded)}</td>
                              <td className="py-2 px-3 text-right">—</td>
                              <td className="py-2 px-3 text-right text-muted-foreground">(info)</td>
                              <td className="py-2 px-3"></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Shift metadata */}
                    <div className="text-[10px] text-muted-foreground flex gap-4 border-t border-border/40 pt-3">
                      <span>Opened: {new Date(result.shift.opened_at).toLocaleString("en-GB")}</span>
                      {result.shift.closed_at && <span>Closed: {new Date(result.shift.closed_at).toLocaleString("en-GB")}</span>}
                      <span>Opening balance: MWK {(result.shift.opening_balance || 0).toLocaleString()}</span>
                      {result.shift.closing_balance != null && <span>Closing: MWK {result.shift.closing_balance.toLocaleString()}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}