import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Clock, X, ChevronDown, ChevronUp } from "lucide-react";

export default function InventoryAlerts() {
  const [alerts, setAlerts] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    base44.functions.invoke('checkInventoryAlerts', {})
      .then(({ data }) => setAlerts(data))
      .catch(() => {});
  }, []);

  if (!alerts || alerts.total_alerts === 0 || dismissed) return null;

  const criticalAlerts = alerts.alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.alerts.filter(a => a.severity === 'warning');

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold flex items-center gap-2 text-amber-800">
          <AlertTriangle className="w-5 h-5" />
          Inventory Alerts ({alerts.total_alerts})
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-amber-100 text-amber-600"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={() => setDismissed(true)} className="p-1 rounded hover:bg-amber-100">
            <X className="w-4 h-4 text-amber-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {alerts.low_stock_count > 0 ? (
          <button onClick={() => setExpanded(!expanded)} className="bg-white rounded-lg p-3 border border-amber-200 text-left hover:border-amber-300 hover:shadow-sm transition-all">
            <p className="text-xs text-muted-foreground">Low Stock</p>
            <p className="text-xl font-bold text-amber-700">{alerts.low_stock_count}</p>
          </button>
        ) : (
          <div className="bg-white rounded-lg p-3 border border-amber-200">
            <p className="text-xs text-muted-foreground">Low Stock</p>
            <p className="text-xl font-bold text-muted-foreground/30">0</p>
          </div>
        )}
        {alerts.expiring_count > 0 ? (
          <button onClick={() => setExpanded(!expanded)} className="bg-white rounded-lg p-3 border border-amber-200 text-left hover:border-amber-300 hover:shadow-sm transition-all">
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
            <p className="text-xl font-bold text-amber-700">{alerts.expiring_count}</p>
          </button>
        ) : (
          <div className="bg-white rounded-lg p-3 border border-amber-200">
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
            <p className="text-xl font-bold text-muted-foreground/30">0</p>
          </div>
        )}
        {alerts.expired_count > 0 ? (
          <button onClick={() => setExpanded(!expanded)} className="bg-white rounded-lg p-3 border border-red-200 text-left hover:border-red-300 hover:shadow-sm transition-all">
            <p className="text-xs text-muted-foreground">Expired</p>
            <p className="text-xl font-bold text-red-600">{alerts.expired_count}</p>
          </button>
        ) : (
          <div className="bg-white rounded-lg p-3 border border-red-200">
            <p className="text-xs text-muted-foreground">Expired</p>
            <p className="text-xl font-bold text-muted-foreground/30">0</p>
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-3">
          {criticalAlerts.length > 0 && (
            <div className="space-y-1.5 mb-2">
              <p className="text-xs font-semibold text-red-700 uppercase">Critical</p>
              {criticalAlerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2 text-sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-red-800">{a.message}</p>
                </div>
              ))}
            </div>
          )}

          {warningAlerts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-amber-700 uppercase">Warnings</p>
              {warningAlerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2 bg-white border border-amber-200 rounded-lg p-2 text-sm">
                  <Clock className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-amber-800">{a.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}