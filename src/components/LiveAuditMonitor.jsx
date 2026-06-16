import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldAlert, DollarSign, CreditCard, Smartphone, RotateCcw, AlertTriangle, XCircle, CheckCircle, Eye, EyeOff, TrendingUp, Clock, RefreshCw } from "lucide-react";

const SEVERITY_CONFIG = {
  minor: { bg: "bg-muted/50", border: "border-border", text: "text-muted-foreground", icon: CheckCircle, iconColor: "text-chart-3" },
  warning: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-600", icon: AlertTriangle, iconColor: "text-chart-2" },
  critical: { bg: "bg-destructive/5", border: "border-destructive/20", text: "text-destructive", icon: XCircle, iconColor: "text-destructive" },
};

export default function LiveAuditMonitor({ compact = false }) {
  const [openShifts, setOpenShifts] = useState([]);
  const [auditResults, setAuditResults] = useState({});
  const [auditing, setAuditing] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [lastAuditTime, setLastAuditTime] = useState(null);
  const [autoAudit, setAutoAudit] = useState(true);

  const runAudit = useCallback(async (shifts) => {
    if (!shifts || shifts.length === 0) return;
    setAuditing(true);
    const results = {};
    for (const shift of shifts) {
      try {
        const { data } = await base44.functions.invoke("liveAuditShift", { shift_id: shift.id });
        results[shift.id] = data;
      } catch (e) { console.error(e); }
    }
    setAuditResults(results);
    setLastAuditTime(new Date());
    setAuditing(false);
  }, []);

  useEffect(() => {
    loadAndAudit();
    if (autoAudit) {
      const interval = setInterval(loadAndAudit, 30000);
      return () => clearInterval(interval);
    }
  }, [autoAudit]);

  const loadAndAudit = async () => {
    try {
      const shifts = await base44.entities.CashierShift.filter({ status: "open" }, "-created_date", 20);
      setOpenShifts(shifts);
      if (shifts.length > 0) {
        await runAudit(shifts);
      }
    } catch (e) { console.error(e); }
  };

  const totalDiscrepancy = Object.values(auditResults).reduce((sum, r) => sum + Math.abs(r.total_discrepancy || 0), 0);
  const hasCritical = Object.values(auditResults).some(r => r.total_severity === "critical");
  const criticalCount = Object.values(auditResults).filter(r => r.total_severity === "critical").length;
  const warningCount = Object.values(auditResults).filter(r => r.total_severity === "warning").length;

  if (openShifts.length === 0 || (Object.keys(auditResults).length === 0 && !auditing)) {
    if (compact) return null;
    return (
      <div className="bg-card rounded-xl border border-border/60 p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">Live Audit Monitor</h3>
          </div>
          <button onClick={loadAndAudit} className="p-1.5 rounded hover:bg-muted"><RefreshCw className="w-3.5 h-3.5 text-muted-foreground" /></button>
        </div>
        <div className="py-4 text-center">
          <CheckCircle className="w-8 h-8 text-chart-3 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No open cashier shifts</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Audit monitoring activates when a cashier opens a shift</p>
        </div>
      </div>
    );
  }

  const pulseClass = hasCritical ? "animate-pulse" : "";
  const statusColor = hasCritical ? "bg-destructive" : warningCount > 0 ? "bg-chart-2" : "bg-chart-3";

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-2 py-1 ${hasCritical ? "bg-destructive/10" : "bg-muted/30"} rounded-lg`}>
        <div className={`w-2 h-2 rounded-full ${statusColor} ${pulseClass}`} />
        <span className="text-xs font-medium">
          {hasCritical ? `⚠ ${criticalCount} critical` : warningCount > 0 ? `⚠ ${warningCount} warning` : "✓ Clean"}
        </span>
        {totalDiscrepancy > 0 && (
          <span className="text-xs text-muted-foreground font-mono">MWK {totalDiscrepancy.toLocaleString()}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-card rounded-xl border-2 shadow-sm overflow-hidden ${
      hasCritical ? "border-destructive/30" : warningCount > 0 ? "border-chart-2/30" : "border-chart-3/20"
    }`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            hasCritical ? "bg-destructive/10" : warningCount > 0 ? "bg-chart-2/10" : "bg-chart-3/10"
          }`}>
            <ShieldAlert className={`w-5 h-5 ${hasCritical ? "text-destructive" : warningCount > 0 ? "text-chart-2" : "text-chart-3"}`} />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
              Live Audit Monitor
              <div className={`w-2 h-2 rounded-full ${statusColor} ${pulseClass}`} />
            </h3>
            <p className="text-xs text-muted-foreground">
              {openShifts.length} shift{openShifts.length > 1 ? 's' : ''} open
              {lastAuditTime && ` • Last check ${lastAuditTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Summary badge */}
          {hasCritical ? (
            <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
              {criticalCount} CRITICAL
            </span>
          ) : warningCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full bg-chart-2/10 text-chart-2 text-[10px] font-bold">
              {warningCount} WARNINGS
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-chart-3/10 text-chart-3 text-[10px] font-bold">
              CLEAN
            </span>
          )}
          {auditing && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          <button onClick={(e) => { e.stopPropagation(); setAutoAudit(!autoAudit); }} className="p-1 rounded hover:bg-muted" title={autoAudit ? "Pause auto-audit" : "Resume auto-audit"}>
            {autoAudit ? <Eye className="w-3.5 h-3.5 text-chart-3" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-border px-4 py-3 space-y-3 max-h-[500px] overflow-y-auto">
          {openShifts.map(shift => {
            const result = auditResults[shift.id];
            if (!result) return null;

            return (
              <div key={shift.id} className={`rounded-lg border p-3 ${result.is_clean ? "border-chart-3/20 bg-chart-3/5" : result.total_severity === "critical" ? "border-destructive/20 bg-destructive/5" : "border-chart-2/20 bg-chart-2/5"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">
                      Shift opened {new Date(shift.opened_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {Math.round((Date.now() - new Date(shift.opened_at).getTime()) / 3600000 * 10) / 10}h ago
                      <span className="font-mono">• {result.payment_count} payments</span>
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    result.is_clean
                      ? "bg-chart-3/10 text-chart-3"
                      : result.total_severity === "critical"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-chart-2/10 text-chart-2"
                  }`}>
                    {result.is_clean ? "✓ Clean" : `MWK ${Math.abs(result.total_discrepancy).toLocaleString()} gap`}
                  </span>
                </div>

                {/* Discrepancy breakdown */}
                <div className="space-y-1.5">
                  {result.discrepancies.map(d => {
                    const cfg = SEVERITY_CONFIG[d.severity];
                    const Icon = cfg.icon;
                    return (
                      <div key={d.type} className="flex items-center justify-between bg-white/60 rounded p-1.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          {d.type === 'cash' ? <DollarSign className="w-3 h-3 text-chart-2" />
                            : d.type === 'card' ? <CreditCard className="w-3 h-3 text-chart-4" />
                            : <Smartphone className="w-3 h-3 text-chart-1" />}
                          <span className="font-medium">{d.label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-muted-foreground">Recorded: <span className="font-mono font-medium text-foreground">{d.recorded.toLocaleString()}</span></span>
                          <span className="text-muted-foreground">Actual: <span className="font-mono font-medium text-foreground">{d.actual.toLocaleString()}</span></span>
                          <span className={`font-mono font-bold ${Math.abs(d.difference) < 500 ? "text-chart-3" : Math.abs(d.difference) < 5000 ? "text-chart-2" : "text-destructive"}`}>
                            {d.difference > 0 ? "+" : ""}{d.difference.toLocaleString()}
                          </span>
                          <Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Total row */}
          <div className={`p-2.5 rounded-lg border flex items-center justify-between ${hasCritical ? "border-destructive/30 bg-destructive/5" : warningCount > 0 ? "border-chart-2/30 bg-chart-2/5" : "border-border bg-muted/20"}`}>
            <span className="text-xs font-semibold">Total Gap Across All Open Shifts</span>
            <span className={`text-sm font-mono font-bold ${hasCritical ? "text-destructive" : warningCount > 0 ? "text-chart-2" : "text-chart-3"}`}>
              MWK {totalDiscrepancy.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}