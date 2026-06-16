import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, TrendingUp, Loader2 } from "lucide-react";

export default function VitalSignsChart({ patientId, visitId }) {
  const [vitalsData, setVitalsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chart, setChart] = useState("bp");

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    base44.entities.VitalSigns.filter({ patient_id: patientId }, "-created_date", 30)
      .then(list => {
        setVitalsData(list.reverse());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (vitalsData.length === 0) return <p className="text-xs text-muted-foreground py-4 text-center">No vitals history available.</p>;

  const bpData = vitalsData
    .filter(v => v.bp_systolic || v.bp_diastolic)
    .map(v => ({
      date: new Date(v.created_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      Systolic: v.bp_systolic || null,
      Diastolic: v.bp_diastolic || null,
    }));

  const vitalsTrend = vitalsData
    .filter(v => v.heart_rate || v.temperature || v.spo2)
    .map(v => ({
      date: new Date(v.created_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      HR: v.heart_rate || null,
      Temp: v.temperature || null,
      SpO2: v.spo2 || null,
    }));

  const charts = [
    { key: "bp", label: "Blood Pressure", data: bpData, lines: ["Systolic", "Diastolic"], colors: ["#ef4444", "#f97316"] },
    { key: "trend", label: "Vitals Trend", data: vitalsTrend, lines: ["HR", "Temp", "SpO2"], colors: ["#0891b2", "#eab308", "#22c55e"] },
  ];

  const active = charts.find(c => c.key === chart);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-heading font-semibold flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-chart-3" /> Vital Signs History
        </h4>
        <div className="flex gap-1">
          {charts.map(c => (
            <button
              key={c.key}
              onClick={() => setChart(c.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${chart === c.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {active && active.data.length > 0 ? (
        <div className="bg-muted/20 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={active.data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {active.lines.map((line, i) => (
                <Line key={line} type="monotone" dataKey={line} stroke={active.colors[i]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-4 text-center">No trend data available.</p>
      )}
    </div>
  );
}