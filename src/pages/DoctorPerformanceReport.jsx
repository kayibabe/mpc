import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import { TrendingUp, Download, Loader2, RefreshCw, Award, Users, Clock } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function DoctorPerformanceReport() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [allReports, setAllReports] = useState([]);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      const users = await base44.entities.User.filter(
        { role: { $in: ["admin", "user"] } },
        "",
        100
      );
      const consultations = await base44.entities.Consultation.list("-created_date", 500);
      const visits = await base44.entities.Visit.list("-created_date", 500);
      
      const doctorIds = [...new Set([
        ...consultations.map(c => c.doctor_id).filter(Boolean),
        ...visits.map(v => v.doctor_id).filter(Boolean),
      ])];
      
      const activeDoctors = users.filter(u => doctorIds.includes(u.id));
      setDoctors(activeDoctors);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const analyzeDoctor = async (doctorId) => {
    setAnalyzing(true);
    try {
      const { data } = await base44.functions.invoke("analyzePhysicianPerformance", {
        doctor_id: doctorId,
      });
      setMetrics(data);
      const doctor = doctors.find(d => d.id === doctorId);
      setAllReports(prev => {
        const existing = prev.find(r => r.doctor_id === doctorId);
        if (existing) {
          return prev.map(r => r.doctor_id === doctorId ? { ...data, doctor_id: doctorId, doctor_name: doctor?.full_name } : r);
        }
        return [...prev, { ...data, doctor_id: doctorId, doctor_name: doctor?.full_name }];
      });
    } catch (e) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const exportReport = () => {
    if (!metrics) return;
    const csv = [
      ["Doctor Performance Report"],
      ["Generated", new Date().toISOString()],
      [],
      ["Metric", "Value"],
      ["Consultations", metrics.total_consultations || 0],
      ["Avg Consultation Time (min)", Math.round(metrics.avg_consultation_time_minutes || 0)],
      ["Patient Satisfaction", `${(metrics.patient_satisfaction_score || 0).toFixed(1)}%`],
      ["Diagnostic Accuracy", `${(metrics.diagnostic_accuracy || 0).toFixed(1)}%`],
      ["Treatment Success Rate", `${(metrics.treatment_success_rate || 0).toFixed(1)}%`],
      ["Referral Rate", `${(metrics.referral_rate || 0).toFixed(1)}%`],
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doctor_performance_${selectedDoctor}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Doctor Performance Report" subtitle="Consultation metrics, satisfaction, and clinical outcomes" icon={TrendingUp} className="mb-6">
        <button onClick={loadDoctors} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </PageHeader>

      {/* Doctor Selector */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Select Doctor</label>
            <select
              value={selectedDoctor || ""}
              onChange={e => {
                setSelectedDoctor(e.target.value);
                if (e.target.value) analyzeDoctor(e.target.value);
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Choose doctor...</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>

          {selectedDoctor && (
            <>
              <button
                onClick={() => analyzeDoctor(selectedDoctor)}
                disabled={analyzing}
                className="self-end inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {analyzing ? "Analyzing..." : "Analyze"}
              </button>

              <button
                onClick={exportReport}
                disabled={!metrics}
                className="self-end inline-flex items-center gap-2 px-4 py-2 bg-chart-2 text-white rounded-lg text-sm font-medium hover:bg-chart-2/90 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </>
          )}
        </div>
      </div>

      {selectedDoctor && metrics && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Consultations", value: metrics.total_consultations || 0, icon: Users },
              { label: "Avg Time (min)", value: Math.round(metrics.avg_consultation_time_minutes || 0), icon: Clock },
              { label: "Patient Satisfaction", value: `${(metrics.patient_satisfaction_score || 0).toFixed(1)}%`, icon: Award },
              { label: "Success Rate", value: `${(metrics.treatment_success_rate || 0).toFixed(1)}%`, icon: TrendingUp },
            ].map(kpi => (
              <div key={kpi.label} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                    <p className="text-2xl font-bold">{kpi.value}</p>
                  </div>
                  <kpi.icon className="w-5 h-5 text-primary" />
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          {metrics.consultation_trend && metrics.consultation_trend.length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h4 className="font-heading font-semibold text-sm mb-4">Consultation Trend (Last 6 months)</h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={metrics.consultation_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Consultations" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Performance Comparison */}
          {metrics.performance_indicators && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h4 className="font-heading font-semibold text-sm mb-4">Performance Indicators</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Diagnostic Accuracy</span>
                    <span className="font-semibold">{(metrics.diagnostic_accuracy || 0).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, metrics.diagnostic_accuracy || 0)}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Referral Rate</span>
                    <span className="font-semibold">{(metrics.referral_rate || 0).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-chart-2" style={{ width: `${Math.min(100, metrics.referral_rate || 0)}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Patient Satisfaction</span>
                    <span className="font-semibold">{(metrics.patient_satisfaction_score || 0).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-chart-3" style={{ width: `${Math.min(100, metrics.patient_satisfaction_score || 0)}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Treatment Success</span>
                    <span className="font-semibold">{(metrics.treatment_success_rate || 0).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-chart-1" style={{ width: `${Math.min(100, metrics.treatment_success_rate || 0)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {metrics.summary && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-sm text-foreground">{metrics.summary}</p>
            </div>
          )}
        </div>
      )}

      {/* All Reports Table */}
      {allReports.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm mt-6">
          <h4 className="font-heading font-semibold text-sm mb-4">All Doctor Reports</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Doctor</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Consultations</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Satisfaction</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {allReports.map(r => (
                  <tr key={r.doctor_id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2.5 px-3 font-medium">{r.doctor_name}</td>
                    <td className="py-2.5 px-3">{r.total_consultations || 0}</td>
                    <td className="py-2.5 px-3">{(r.patient_satisfaction_score || 0).toFixed(1)}%</td>
                    <td className="py-2.5 px-3">{(r.treatment_success_rate || 0).toFixed(1)}%</td>
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