import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, FlaskConical, Pill, X, RefreshCw } from "lucide-react";

export default function ExpiryAlerts({ department }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: result } = await base44.functions.invoke('runExpiryAlerts', {});
      setData(result);
    } catch (e) {
      console.error('Expiry alerts failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  if (loading) {
    return (
      <div className="mb-5 bg-card rounded-xl border border-border/60 p-3 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
        Checking expiry dates...
      </div>
    );
  }

  if (!data || data.total_notifications === 0 || dismissed) return null;

  const filtered = department
    ? data.notifications.filter(n => n.department === department)
    : data.notifications;

  if (filtered.length === 0) return null;

  const deptIcon = department === 'pharmacy'
    ? <Pill className="w-4 h-4" />
    : department === 'laboratory'
    ? <FlaskConical className="w-4 h-4" />
    : null;

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'warning': return 'bg-chart-2/10 border-chart-2/30 text-chart-2';
      case 'info': return 'bg-chart-1/10 border-chart-1/30 text-chart-1';
      default: return 'bg-muted border-border';
    }
  };

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case 'critical': return '⏰ ≤30 days';
      case 'warning': return '⚠ ≤60 days';
      case 'info': return 'ℹ ≤90 days';
      default: return severity;
    }
  };

  return (
    <div className="mb-5 bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="font-heading text-sm font-semibold text-amber-800 flex items-center gap-2">
              {deptIcon}
              Expiry Alerts{deptIcon ? ` — ${department === 'pharmacy' ? 'Pharmacy' : 'Laboratory'}` : ''}
            </h3>
            <p className="text-xs text-amber-600">{filtered.length} item{filtered.length !== 1 ? 's' : ''} approaching expiry</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAlerts}
            disabled={refreshing}
            className="p-1.5 rounded hover:bg-amber-100 text-amber-600"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setDismissed(true)} className="p-1.5 rounded hover:bg-amber-100 text-amber-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50/50 border-b border-amber-100">
        {['critical', 'warning', 'info'].map(sev => {
          const count = filtered.filter(n => n.severity === sev).length;
          if (count === 0) return null;
          return (
            <span key={sev} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getSeverityStyles(sev)}`}>
              {getSeverityLabel(sev)}: {count}
            </span>
          );
        })}
      </div>

      {/* Items */}
      <div className="divide-y divide-border/40 max-h-80 overflow-y-auto">
        {filtered
          .sort((a, b) => a.days_remaining - b.days_remaining)
          .map((n, i) => (
            <div
              key={i}
              className={`px-4 py-2.5 flex items-start gap-3 hover:bg-muted/20 transition-colors ${
                n.severity === 'critical' ? 'bg-destructive/5' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                n.severity === 'critical' ? 'bg-destructive/10' :
                n.severity === 'warning' ? 'bg-chart-2/10' : 'bg-chart-1/10'
              }`}>
                {n.department === 'pharmacy' ? (
                  <Pill className={`w-4 h-4 ${n.severity === 'critical' ? 'text-destructive' : n.severity === 'warning' ? 'text-chart-2' : 'text-chart-1'}`} />
                ) : (
                  <FlaskConical className={`w-4 h-4 ${n.severity === 'critical' ? 'text-destructive' : n.severity === 'warning' ? 'text-chart-2' : 'text-chart-1'}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{n.item}</p>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${getSeverityStyles(n.severity)}`}>
                    {n.days_remaining}d
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Expires {new Date(n.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {n.batch ? ` · Lot ${n.batch}` : ''}
                  {n.stock != null ? ` · Stock: ${n.stock}` : ''}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}