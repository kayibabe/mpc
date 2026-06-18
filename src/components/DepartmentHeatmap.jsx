import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Activity } from "lucide-react";

const DEPARTMENTS = [
  { key: "reception",  label: "Reception",  icon: "🏥", queue_statuses: ["waiting"] },
  { key: "triage",     label: "Triage",     icon: "🔴", queue_statuses: ["triaged"] },
  { key: "clinical",   label: "Clinical",   icon: "🩺", queue_statuses: ["in_consultation"] },
  { key: "lab",        label: "Laboratory", icon: "🧪", queue_statuses: ["in_lab"] },
  { key: "pharmacy",   label: "Pharmacy",   icon: "💊", queue_statuses: ["in_pharmacy"] },
  { key: "inpatient",  label: "Inpatient",  icon: "🛏️", queue_statuses: ["admitted"] },
];

function getHeatColor(value, max) {
  if (max === 0 || value === 0) return { bg: "bg-muted/40", text: "text-muted-foreground", bar: "bg-muted/60", label: "Empty" };
  const pct = value / max;
  if (pct >= 0.75) return { bg: "bg-red-50 border-red-200",    text: "text-red-700",    bar: "bg-red-500",    label: "Critical" };
  if (pct >= 0.5)  return { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", bar: "bg-orange-400",  label: "High" };
  if (pct >= 0.25) return { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", bar: "bg-yellow-400",  label: "Moderate" };
  return             { bg: "bg-green-50 border-green-200",   text: "text-green-700",   bar: "bg-green-400",   label: "Low" };
}

export default function DepartmentHeatmap() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = async () => {
    try {
      const visits = await base44.entities.Visit.filter(
        { queue_status: { $in: ["waiting", "triaged", "in_consultation", "in_lab", "in_pharmacy", "admitted"] } },
        "",
        500
      );
      const result = {};
      DEPARTMENTS.forEach(dept => {
        result[dept.key] = visits.filter(v => dept.queue_statuses.includes(v.queue_status)).length;
      });
      // Add inpatient from admissions directly
      const admissions = await base44.entities.Admission.filter({ status: "admitted" }, "", 200);
      result.inpatient = admissions.length;
      setCounts(result);
      setLastRefresh(new Date());
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const max = Math.max(...Object.values(counts), 1);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const busiest = DEPARTMENTS.reduce((a, b) => (counts[b.key] > counts[a.key] ? b : a), DEPARTMENTS[0]);

  return (
    <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold">Department Volume Heatmap</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{total} active patients</span>
          <button onClick={load} className="text-xs text-primary hover:underline">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Busiest dept banner */}
          {total > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs">
              <span className="font-bold text-red-600">⚡ Highest Volume:</span>
              <span className="font-semibold text-red-700">{busiest.icon} {busiest.label}</span>
              <span className="text-red-500 ml-auto font-mono font-bold">{counts[busiest.key]} patients</span>
            </div>
          )}

          {/* Heatmap grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {DEPARTMENTS.map(dept => {
              const count = counts[dept.key] || 0;
              const { bg, text, bar, label } = getHeatColor(count, max);
              const pct = max > 0 ? Math.round((count / max) * 100) : 0;
              return (
                <div key={dept.key} className={`rounded-lg border p-3 transition-all ${bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{dept.icon}</span>
                      <span className="text-xs font-semibold text-foreground">{dept.label}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${text} bg-white/60`}>{label}</span>
                  </div>
                  {/* Bar */}
                  <div className="h-1.5 w-full bg-white/70 rounded-full overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-end justify-between">
                    <span className={`text-2xl font-bold font-mono tabular-nums ${text}`}>{count}</span>
                    <span className="text-[10px] text-muted-foreground">patients</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-3 pt-1 text-[10px] text-muted-foreground">
            {[
              { color: "bg-green-400", label: "Low" },
              { color: "bg-yellow-400", label: "Moderate" },
              { color: "bg-orange-400", label: "High" },
              { color: "bg-red-500",   label: "Critical" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${l.color}`} />
                {l.label}
              </div>
            ))}
            {lastRefresh && <span className="ml-2">· {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </div>
      )}
    </div>
  );
}