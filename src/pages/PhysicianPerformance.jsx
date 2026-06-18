import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Stethoscope, TrendingUp, Users, ClipboardCheck, Pill, FlaskConical, Scan,
  BedDouble, PenTool, Shield, Award, Loader2, Calendar, Clock, BarChart3
} from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar } from "recharts";
import PageHeader from "@/components/ui/PageHeader";

export default function PhysicianPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhysician, setSelectedPhysician] = useState(null);

  const emptyData = { summary: { active_physicians: 0, total_consultations: 0, total_prescriptions: 0, total_diagnoses: 0, total_lab_orders: 0, total_imaging_orders: 0, total_admissions: 0, total_discharges: 0, total_signatures: 0, avg_consultations_per_physician: 0, avg_clinic_wait_minutes: 0 }, daily_trend: [], physicians: [], top_by_efficiency: [], top_diagnoses: [] };

  useEffect(() => {
    async function load() {
      try {
        const { data: result } = await base44.functions.invoke("analyzePhysicianPerformance", {});
        setData(result || emptyData);
      } catch (e) {
        console.error(e);
        setData(emptyData);
      }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { summary, daily_trend, physicians, top_by_efficiency, top_diagnoses } = data;

  const getScoreColor = (score) => {
    if (score >= 80) return "text-clinical-normal";
    if (score >= 60) return "text-chart-2";
    return "text-destructive";
  };
  const getScoreBg = (score) => {
    if (score >= 80) return "bg-clinical-normal/10 border-clinical-normal/20";
    if (score >= 60) return "bg-chart-2/10 border-chart-2/20";
    return "bg-destructive/10 border-destructive/20";
  };

  // Radar data for top physician
  const radarData = selectedPhysician ? [
    { metric: "Consultations", value: Math.min(100, selectedPhysician.consultations.avg_per_day * 10), fullMark: 100 },
    { metric: "Signatures", value: selectedPhysician.compliance.signature_rate, fullMark: 100 },
    { metric: "Handover", value: selectedPhysician.compliance.handover_rate, fullMark: 100 },
    { metric: "Doc Thorough", value: Math.min(100, selectedPhysician.diagnoses.avg_per_consult * 30), fullMark: 100 },
    { metric: "Efficiency", value: selectedPhysician.efficiency_score, fullMark: 100 },
  ] : [];

  return (
    <div className="page-container">
      <PageHeader title="Physician Performance" subtitle="30-day clinical performance metrics for all physicians" icon={Stethoscope} className="mb-6" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Active Physicians", value: summary.active_physicians, icon: Users, color: "bg-primary" },
          { label: "Total Consultations", value: summary.total_consultations, icon: Stethoscope, color: "bg-chart-1" },
          { label: "Avg/Physician", value: summary.avg_consultations_per_physician, icon: TrendingUp, color: "bg-chart-2" },
          { label: "Avg Wait Time", value: `${summary.avg_clinic_wait_minutes}min`, icon: Clock, color: "bg-chart-3" },
          { label: "Total Signatures", value: summary.total_signatures, icon: PenTool, color: "bg-chart-4" },
        ].map(s => (
          <div key={s.label} className="stat-card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Prescriptions", value: summary.total_prescriptions, icon: Pill, color: "text-chart-2" },
          { label: "Diagnoses", value: summary.total_diagnoses, icon: ClipboardCheck, color: "text-chart-1" },
          { label: "Lab Orders", value: summary.total_lab_orders, icon: FlaskConical, color: "text-chart-3" },
          { label: "Imaging", value: summary.total_imaging_orders, icon: Scan, color: "text-chart-4" },
          { label: "Admissions", value: summary.total_admissions, icon: BedDouble, color: "text-primary" },
          { label: "Discharges", value: summary.total_discharges, icon: Shield, color: "text-chart-3" },
        ].map(s => (
          <div key={s.label} className="bg-muted/30 rounded-lg p-3 text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Daily Trend + Diagnosis Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Daily Activity (7 Days)
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={daily_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                tickFormatter={d => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="consultations" stroke="hsl(var(--primary))" name="Consults" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="prescriptions" stroke="hsl(var(--chart-2))" name="Prescriptions" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="admissions" stroke="hsl(var(--chart-4))" name="Admissions" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-chart-2" /> Top Diagnoses
          </h4>
          {top_diagnoses.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={top_diagnoses.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={75} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="Cases" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-xs text-muted-foreground">No diagnosis data yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Top by Efficiency */}
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-chart-2" /> Top Performers
          </h4>
          {top_by_efficiency.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Not enough data.</p>
          ) : (
            <div className="space-y-2">
              {top_by_efficiency.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <span className={`text-sm font-bold ${getScoreColor(p.efficiency_score)}`}>
                    {p.efficiency_score}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Physicians */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border/60 p-4">
          <h4 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> All Physicians
          </h4>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border sticky top-0 bg-card">
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Physician</th>
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Consults</th>
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Avg/Day</th>
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Rx</th>
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Wait</th>
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Sig%</th>
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Score</th>
                </tr>
              </thead>
              <tbody>
                {physicians.map(p => (
                  <tr
                    key={p.id}
                    className={`border-b border-border/40 hover:bg-muted/20 cursor-pointer transition-colors ${
                      selectedPhysician?.id === p.id ? "bg-primary/5" : ""
                    }`}
                    onClick={() => setSelectedPhysician(selectedPhysician?.id === p.id ? null : p)}
                  >
                    <td className="py-2 px-2">
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-1 text-[10px] text-muted-foreground">· {p.role}</span>
                    </td>
                    <td className="py-2 px-2 font-mono">{p.consultations.total}</td>
                    <td className="py-2 px-2 font-mono">{p.consultations.avg_per_day}</td>
                    <td className="py-2 px-2 font-mono">{p.prescriptions.total}</td>
                    <td className="py-2 px-2">
                      <span className={p.wait_time?.avg_minutes > 30 ? "text-triage-urgent font-semibold" : "text-muted-foreground"}>
                        {p.wait_time?.avg_minutes || 0}m
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={p.compliance.signature_rate < 80 ? "text-destructive font-semibold" : "text-clinical-normal"}>
                        {p.compliance.signature_rate}%
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getScoreBg(p.efficiency_score)} ${getScoreColor(p.efficiency_score)}`}>
                        {p.efficiency_score}
                      </span>
                    </td>
                  </tr>
                ))}
                {physicians.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No physician data found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Selected Physician Detail */}
      {selectedPhysician && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <div className="bg-card rounded-xl border border-border/60 p-4">
            <h4 className="font-heading font-semibold text-sm mb-3">{selectedPhysician.name} — Performance Radar</h4>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name={selectedPhysician.name} dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail Stats */}
          <div className="bg-card rounded-xl border border-border/60 p-4">
            <h4 className="font-heading font-semibold text-sm mb-3">{selectedPhysician.name} — Details</h4>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-muted/20 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">Consultations (30d)</p>
                  <p className="text-lg font-bold">{selectedPhysician.consultations.total}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedPhysician.consultations.today} today · {selectedPhysician.consultations.avg_per_day}/day avg</p>
                </div>
                <div className="p-2.5 bg-muted/20 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">Prescriptions</p>
                  <p className="text-lg font-bold">{selectedPhysician.prescriptions.total}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedPhysician.prescriptions.avg_per_consult}/consult avg</p>
                </div>
                <div className="p-2.5 bg-muted/20 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">Diagnoses</p>
                  <p className="text-lg font-bold">{selectedPhysician.diagnoses.total}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedPhysician.diagnoses.avg_per_consult}/consult avg</p>
                </div>
                <div className="p-2.5 bg-muted/20 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">Lab Orders</p>
                  <p className="text-lg font-bold">{selectedPhysician.investigations.lab_orders}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedPhysician.investigations.lab_investigation_rate}% of consults</p>
                </div>
                <div className="p-2.5 bg-muted/20 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">Imaging Orders</p>
                  <p className="text-lg font-bold">{selectedPhysician.investigations.imaging_orders}</p>
                </div>
                <div className="p-2.5 bg-muted/20 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">Admissions</p>
                  <p className="text-lg font-bold">{selectedPhysician.admissions.total}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedPhysician.admissions.active} active</p>
                </div>
                {selectedPhysician.wait_time && (
                  <>
                    <div className="p-2.5 bg-muted/20 rounded-lg">
                      <p className="text-[10px] text-muted-foreground">Avg Wait Time</p>
                      <p className={`text-lg font-bold ${selectedPhysician.wait_time.avg_minutes > 30 ? "text-triage-urgent" : "text-clinical-normal"}`}>
                        {selectedPhysician.wait_time.avg_minutes}m
                      </p>
                      <p className="text-[10px] text-muted-foreground">{selectedPhysician.wait_time.tracked_visits} visits tracked</p>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded-lg">
                      <p className="text-[10px] text-muted-foreground">Longest Wait</p>
                      <p className={`text-lg font-bold ${selectedPhysician.wait_time.longest_minutes > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                        {selectedPhysician.wait_time.longest_minutes}m
                      </p>
                    </div>
                  </>
                )}
                {!selectedPhysician.wait_time && (
                  <>
                    <div className="p-2.5 bg-muted/20 rounded-lg">
                      <p className="text-[10px] text-muted-foreground">Wait Time</p>
                      <p className="text-lg font-bold text-muted-foreground/50">—</p>
                      <p className="text-[10px] text-muted-foreground">No journey data</p>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded-lg">
                      <p className="text-[10px] text-muted-foreground">Procedures</p>
                      <p className="text-lg font-bold">{selectedPhysician.admissions.total + selectedPhysician.discharges}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Compliance */}
              <div className="border-t border-border pt-3 mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Compliance</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-muted/20 rounded-lg">
                    <p className={`text-lg font-bold ${getScoreColor(selectedPhysician.compliance.signature_rate)}`}>
                      {selectedPhysician.compliance.signature_rate}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Signatures</p>
                    {selectedPhysician.compliance.unsigned_consults > 0 && (
                      <p className="text-[10px] text-destructive">{selectedPhysician.compliance.unsigned_consults} unsigned</p>
                    )}
                  </div>
                  <div className="text-center p-2 bg-muted/20 rounded-lg">
                    <p className={`text-lg font-bold ${getScoreColor(selectedPhysician.compliance.handover_rate)}`}>
                      {selectedPhysician.compliance.handover_rate}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Handovers</p>
                  </div>
                  <div className="text-center p-2 bg-muted/20 rounded-lg">
                    <p className={`text-lg font-bold ${getScoreColor(selectedPhysician.efficiency_score)}`}>
                      {selectedPhysician.efficiency_score}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Overall</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}