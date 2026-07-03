import { useMemo } from "react";
import { Shield, FileSignature, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

const DEPARTMENTS = [
  "nursing", "clinical", "lab", "imaging", "pharmacy", "inpatient", "maternal", "theatre"
];
const DEPT_LABELS = {
  nursing: "Nursing", clinical: "Clinical", lab: "Laboratory", imaging: "Imaging",
  pharmacy: "Pharmacy", inpatient: "Inpatient", maternal: "Maternal", theatre: "Theatre",
};

export default function WasteComplianceDashboard({ logs, categories }) {
  const complianceData = useMemo(() => {
    return DEPARTMENTS.map(dept => {
      const deptLogs = logs.filter(l => l.origin_department === dept);
      const total = deptLogs.length;
      const disposed = deptLogs.filter(l => l.status === "disposed").length;
      const signed = deptLogs.filter(l => l.signature_url && l.signed_at).length;
      const slaBreached = deptLogs.filter(l => l.sla_breached).length;
      const totalKg = deptLogs.reduce((s, l) => s + (l.quantity_kg || 0), 0);
      const avgTimeToDispose = deptLogs
        .filter(l => l.disposal_method && l.generated_at)
        .map(l => {
          const end = l.treated_at || l.collected_at || l.created_date;
          return (new Date(end) - new Date(l.generated_at)) / 3600000;
        });
      const avgHours = avgTimeToDispose.length > 0
        ? Math.round(avgTimeToDispose.reduce((a, b) => a + b, 0) / avgTimeToDispose.length * 10) / 10
        : null;

      const complianceScore = total === 0 ? null : Math.round(
        ((disposed / total) * 50 + (signed / total) * 30 + (total - slaBreached > 0 ? (1 - slaBreached / total) * 20 : 20))
      );

      return { dept, label: DEPT_LABELS[dept], total, disposed, signed, slaBreached, totalKg, avgHours, complianceScore };
    });
  }, [logs]);

  const totalLogs = logs.length;
  const totalDisposed = logs.filter(l => l.status === "disposed").length;
  const totalSigned = logs.filter(l => l.signature_url && l.signed_at).length;
  const totalSLA = logs.filter(l => l.sla_breached).length;
  const overallCompliance = totalLogs === 0 ? 0 : Math.round(
    ((totalDisposed / totalLogs) * 40 + (totalSigned / totalLogs) * 30 + (totalLogs - totalSLA > 0 ? 30 : 0))
  );

  const HazardCount = useMemo(() => {
    return logs.filter(l => {
      const cat = categories.find(c => c.id === l.waste_category_id);
      return cat && cat.code !== "GEN";
    }).length;
  }, [logs, categories]);

  return (
    <div className="space-y-5">
      {/* Overall Compliance Score */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border/60 p-4 text-center">
          <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
            overallCompliance >= 80 ? "bg-chart-3/10" : overallCompliance >= 50 ? "bg-chart-2/10" : "bg-destructive/10"
          }`}>
            <Shield className={`w-6 h-6 ${
              overallCompliance >= 80 ? "text-chart-3" : overallCompliance >= 50 ? "text-chart-2" : "text-destructive"
            }`} />
          </div>
          <p className="text-2xl font-bold">{overallCompliance}%</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Overall Compliance</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 text-center">
          <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center bg-chart-3/10">
            <CheckCircle className="w-6 h-6 text-chart-3" />
          </div>
          <p className="text-2xl font-bold">{totalDisposed}/{totalLogs}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Disposed</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 text-center">
          <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center bg-primary/10">
            <FileSignature className="w-6 h-6 text-primary" />
          </div>
          <p className="text-2xl font-bold">{totalSigned}/{totalLogs}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Signed</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 text-center">
          <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center bg-destructive/10">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-2xl font-bold">{totalSLA}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">SLA Breaches</p>
        </div>
      </div>

      {/* Hazardous Waste Summary */}
      <div className="bg-card rounded-xl border border-border/60 p-4">
        <h4 className="font-heading text-sm font-semibold mb-3 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-destructive" /> Hazardous Material Labeling
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {categories.map(cat => {
            const count = logs.filter(l => l.category_code === cat.code && l.status !== "disposed").length;
            const isHazardous = cat.code !== "GEN";
            return (
              <div
                key={cat.id}
                className={`rounded-lg border p-3 text-center ${
                  isHazardous ? "border-destructive/30 bg-destructive/5" : "border-border/40 bg-muted/20"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span
                    className={`w-3 h-3 rounded-full inline-block ${
                      cat.color_code === "yellow" ? "bg-yellow-400" :
                      cat.color_code === "red" ? "bg-red-500" :
                      cat.color_code === "brown" ? "bg-amber-700" :
                      cat.color_code === "black" ? "bg-gray-800" : "bg-blue-500"
                    }`}
                  />
                  <span className="text-xs font-semibold">{cat.name}</span>
                </div>
                <p className="text-lg font-bold font-mono">{count}</p>
                <p className="text-[9px] text-muted-foreground">
                  {isHazardous ? "⚡ Hazardous" : "Non-hazardous"}
                  {cat.requires_incineration ? " · 🔥" : ""}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {cat.container_type || `Max ${cat.max_storage_hours}h`}
                </p>
              </div>
            );
          })}
          {categories.length === 0 && (
            <p className="col-span-full text-xs text-muted-foreground py-4 text-center">No categories defined.</p>
          )}
        </div>
      </div>

      {/* Department Compliance Table */}
      <div>
        <h4 className="font-heading text-sm font-semibold mb-3 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-chart-1" /> Staff Compliance by Department
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Department</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Logs</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Disposed</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Signed</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">SLA Breaches</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Volume</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Avg Time</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Score</th>
              </tr>
            </thead>
            <tbody>
              {complianceData.map(d => (
                <tr key={d.dept} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2 px-3 text-xs font-medium capitalize">{d.label}</td>
                  <td className="py-2 px-3 text-xs text-center font-mono">{d.total || "—"}</td>
                  <td className="py-2 px-3 text-xs text-center">{d.disposed || "—"}</td>
                  <td className="py-2 px-3 text-xs text-center">{d.signed || "—"}</td>
                  <td className="py-2 px-3 text-xs text-center">
                    {d.slaBreached > 0 ? (
                      <span className="text-destructive font-semibold">{d.slaBreached}</span>
                    ) : (
                      <span className="text-chart-3">0</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-xs text-center font-mono">{d.totalKg > 0 ? `${d.totalKg.toFixed(1)} kg` : "—"}</td>
                  <td className="py-2 px-3 text-xs text-center font-mono">{d.avgHours != null ? `${d.avgHours}h` : "—"}</td>
                  <td className="py-2 px-3 text-xs text-center">
                    {d.complianceScore != null ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.complianceScore >= 80 ? "bg-chart-3/10 text-chart-3" :
                        d.complianceScore >= 50 ? "bg-chart-2/10 text-chart-2" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        {d.complianceScore}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}