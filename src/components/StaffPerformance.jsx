import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Clock, FlaskConical, Pill, ClipboardCheck, Loader2, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PIE_COLORS = ["hsl(194, 65%, 42%)", "hsl(38, 92%, 50%)", "hsl(160, 60%, 40%)", "hsl(280, 50%, 50%)", "hsl(340, 65%, 50%)", "hsl(0, 72%, 51%)"];

export default function StaffPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: result } = await base44.functions.invoke("analyzeStaffPerformance", {});
        setData(result);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm">Failed to load performance data.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Consultations", value: data.summary.total_consultations, icon: Users, color: "bg-primary" },
          { label: "Lab Tests", value: data.summary.total_lab_orders, icon: FlaskConical, color: "bg-chart-3" },
          { label: "Items Dispensed", value: data.summary.total_dispensings, icon: Pill, color: "bg-chart-2" },
          { label: "Handovers", value: data.summary.total_handovers, icon: ClipboardCheck, color: "bg-chart-4" },
        ].map(s => (
          <div key={s.label} className="stat-card flex items-center gap-3 p-3">
            <div className={`w-9 h-9 rounded-lg ${s.color} flex items-center justify-center`}>
              <s.icon className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Doctor Performance */}
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Doctor Performance
          </h4>
          {data.doctor_performance?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.doctor_performance.slice(0, 8)} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={60} />
                <Tooltip />
                <Bar dataKey="consultations" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Consultations" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No consultation data.</p>
          )}
        </div>

        {/* Department Wait Times */}
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-chart-2" /> Avg Wait by Department
          </h4>
          {data.department_wait_times?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.department_wait_times} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit=" min" />
                <YAxis type="category" dataKey="department" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={80} />
                <Tooltip formatter={(v) => `${v} min`} />
                <Bar dataKey="avg_wait_minutes" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="Avg Wait (min)">
                  {data.department_wait_times.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No journey data yet.</p>
          )}
        </div>

        {/* Lab Performance */}
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-chart-3" /> Lab Technician Performance
          </h4>
          {data.lab_performance?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Technician</th>
                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Orders</th>
                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Results</th>
                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Avg TAT</th>
                </tr></thead>
                <tbody>
                  {data.lab_performance.map((l, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-1.5 px-2 font-medium">{l.name}</td>
                      <td className="py-1.5 px-2">{l.orders}</td>
                      <td className="py-1.5 px-2">{l.results}</td>
                      <td className={`py-1.5 px-2 ${l.avg_turnaround_min && l.avg_turnaround_min > 60 ? "text-destructive font-semibold" : "text-chart-3"}`}>
                        {l.avg_turnaround_min ? `${l.avg_turnaround_min} min` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No lab data yet.</p>
          )}
        </div>

        {/* Pharmacy & Shift Compliance */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border/60 p-4">
            <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <Pill className="w-4 h-4 text-chart-2" /> Pharmacy Performance
            </h4>
            {data.pharmacy_performance?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Pharmacist</th>
                    <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Items</th>
                    <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Patients</th>
                  </tr></thead>
                  <tbody>
                    {data.pharmacy_performance.map((p, i) => (
                      <tr key={i} className="border-b border-border/40">
                        <td className="py-1.5 px-2 font-medium">{p.name}</td>
                        <td className="py-1.5 px-2">{p.items_dispensed}</td>
                        <td className="py-1.5 px-2">{p.unique_patients}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">No dispensing data.</p>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border/60 p-4">
            <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-chart-4" /> Shift Compliance
            </h4>
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-2">
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke={data.shift_compliance.compliance_rate >= 80 ? "hsl(160, 60%, 40%)" : "hsl(38, 92%, 50%)"} strokeWidth="8"
                    strokeDasharray={`${data.shift_compliance.compliance_rate * 2.14} 214`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{data.shift_compliance.compliance_rate}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {data.shift_compliance.acknowledged}/{data.shift_compliance.total_handovers} acknowledged
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}