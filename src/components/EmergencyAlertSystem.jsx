import { useState, useEffect } from "react";
import { base44, isBase44Env } from "@/api/base44Client";
import { getToken } from "@/api/customClient";
import { AlertTriangle, X, Bell, Clock } from "lucide-react";

export default function EmergencyAlertSystem() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    if (!isBase44Env && !getToken()) return; // skip polling when not logged in
    try {
      // Get critical visits
      const visits = await base44.entities.Visit.filter(
        { priority: "emergency", queue_status: { $in: ["waiting", "triaged", "in_consultation"] } },
        "-created_date",
        50
      );

      // Get critical lab results
      const labResults = await base44.entities.LabResult.filter(
        { is_critical: true, status: "critical" },
        "-created_date",
        50
      );

      // Get low inventory
      const drugs = await base44.entities.Drug.filter(
        { quantity_in_stock: { $lte: 5 } },
        "",
        50
      );

      const allAlerts = [
        ...visits.map(v => ({
          id: v.id,
          type: "emergency",
          title: "Emergency Patient Waiting",
          message: `Patient ${v.patient_id?.slice(0, 8)} priority: ${v.priority}`,
          severity: "critical",
          time: v.created_date,
          action: "triage",
        })),
        ...labResults.map(r => ({
          id: r.id,
          type: "critical_lab",
          title: "Critical Lab Result",
          message: `${r.test_name}: ${r.result_value} (Critical)`,
          severity: "critical",
          time: r.created_date,
          action: "review",
        })),
        ...drugs.map(d => ({
          id: d.id,
          type: "inventory",
          title: "Critical Inventory",
          message: `${d.name} stock: ${d.quantity_in_stock}`,
          severity: "warning",
          time: d.updated_date,
          action: "reorder",
        })),
      ].sort((a, b) => new Date(b.time) - new Date(a.time));

      setAlerts(allAlerts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = (id) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] space-y-2 z-40">
      {alerts.slice(0, 5).map(alert => (
        <div
          key={alert.id}
          className={`rounded-lg border p-3 shadow-lg animate-in fade-in slide-in-from-right-4 ${
            alert.severity === "critical"
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-chart-2/10 border-chart-2/30 text-chart-2"
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs">{alert.title}</p>
              <p className="text-[10px] text-current/70 mt-0.5 truncate">{alert.message}</p>
              <div className="flex items-center gap-1 mt-1.5 text-[10px] opacity-60">
                <Clock className="w-3 h-3" />
                {Math.round((Date.now() - new Date(alert.time).getTime()) / 60000)}m ago
              </div>
            </div>
            <button
              onClick={() => dismissAlert(alert.id)}
              className="p-1 rounded hover:bg-white/20 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
      {alerts.length > 5 && (
        <div className="text-center text-[10px] text-muted-foreground">+{alerts.length - 5} more alerts</div>
      )}
    </div>
  );
}