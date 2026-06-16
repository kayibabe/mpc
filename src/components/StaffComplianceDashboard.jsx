import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, CheckCircle, AlertTriangle, XCircle, TrendingUp, Users, ClipboardCheck, PenTool, Loader2, ArrowUpRight } from "lucide-react";

const STATUS_COLORS = {
  compliant: "bg-clinical-normal/10 text-clinical-normal border-clinical-normal/30",
  warning: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  non_compliant: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function StaffComplianceDashboard({ compact = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: result } = await base44.functions.invoke("analyzeStaffCompliance", {});
        setData(result);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground text-sm">
        <XCircle className="w-4 h-4" /> Failed to load compliance data.
      </div>
    );
  }

  const { overview } = data;

  const getScoreColor = (score) => {
    if (score >= 80) return "text-clinical-normal";
    if (score >= 50) return "text-chart-2";
    return "text-destructive";
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3">
        <div className={`text-2xl font-bold ${getScoreColor(overview.overall_compliance_score)}`}>
          {overview.overall_compliance_score}%
        </div>
        <div className="text-xs text-muted-foreground">
          <p>Handover: {overview.avg_handover_rate}%</p>
          <p>Signature: {overview.avg_signature_rate}%</p>
        </div>
        {overview.total_sla_breaches > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive">
            {overview.total_sla_breaches} SLA
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overall Score */}
      <div className="bg-card rounded-xl border border-border/60 p-5 text-center">
        <div className="relative w-24 h-24 mx-auto mb-3">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
            <circle cx="48" cy="48" r="40" fill="none"
              stroke={overview.overall_compliance_score >= 80 ? "hsl(160, 60%, 40%)" : overview.overall_compliance_score >= 50 ? "hsl(38, 92%, 50%)" : "hsl(0, 72%, 51%)"}
              strokeWidth="10"
              strokeDasharray={`${overview.overall_compliance_score * 2.51} 251`}
              strokeLinecap="round"
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${getScoreColor(overview.overall_compliance_score)}`}>
            {overview.overall_compliance_score}%
          </span>
        </div>
        <h3 className="font-heading font-semibold text-sm">Staff Compliance Score</h3>
        <p className="text-xs text-muted-foreground mt-1">{overview.total_staff_tracked} staff tracked · 30 days</p>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Handover</span>
          </div>
          <p className={`text-lg font-bold ${getScoreColor(overview.avg_handover_rate)}`}>{overview.avg_handover_rate}%</p>
        </div>
        <div className="stat-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <PenTool className="w-4 h-4 text-chart-1" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Signatures</span>
          </div>
          <p className={`text-lg font-bold ${getScoreColor(overview.avg_signature_rate)}`}>{overview.avg_signature_rate}%</p>
        </div>
        <div className="stat-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-chart-2" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">SLA</span>
          </div>
          <p className={`text-lg font-bold ${overview.total_sla_breaches > 0 ? "text-destructive" : "text-clinical-normal"}`}>
            {overview.total_sla_breaches}
          </p>
        </div>
        <div className="stat-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-chart-3" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Waste</span>
          </div>
          <p className={`text-lg font-bold ${getScoreColor(overview.waste_disposal_rate)}`}>{overview.waste_disposal_rate}%</p>
        </div>
      </div>

      {/* Non-Compliant Staff */}
      {data.handover_compliance?.filter(h => h.status !== "compliant").length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Handover Compliance Issues
          </h4>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {data.handover_compliance.filter(h => h.status !== "compliant").slice(0, 10).map((h, i) => (
              <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${STATUS_COLORS[h.status]}`}>
                <div className="flex items-center gap-2">
                  {h.status === "non_compliant" ? <XCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  <span className="font-medium">{h.staff_name}</span>
                  <span className="text-[10px] opacity-70">· {h.role}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono">{h.acknowledged}/{h.total_handovers} ack'd</span>
                  <span className="font-bold">{h.compliance_rate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signature Compliance */}
      {data.signature_compliance?.filter(s => s.status !== "compliant").length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <PenTool className="w-4 h-4 text-destructive" /> Missing Digital Signatures
          </h4>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {data.signature_compliance.filter(s => s.status !== "compliant").map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border bg-destructive/5 border-destructive/20 text-xs">
                <div className="flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                  <span className="font-medium">{s.staff_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>{s.consultations_done} consults, {s.documents_unsigned} unsigned</span>
                  <span className="font-bold text-destructive">{s.compliance_rate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SLA Breaches */}
      {data.sla_compliance?.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-chart-2" /> SLA Breaches by Department
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Department</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Breaches (30d)</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {data.sla_compliance.map((s, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="py-1.5 px-2 font-medium">{s.department}</td>
                    <td className="py-1.5 px-2 font-mono">{s.breaches}</td>
                    <td className="py-1.5 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[s.status]}`}>
                        {s.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}