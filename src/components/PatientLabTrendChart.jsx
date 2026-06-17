import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Search, TrendingUp, AlertCircle } from "lucide-react";

export default function PatientLabTrendChart() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [labResults, setLabResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedTest, setSelectedTest] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const p = await base44.entities.Patient.list("-created_date", 200);
        setPatients(p);
      } catch (e) { /* silent */ }
    }
    load();
  }, []);

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchInput.toLowerCase()) ||
    (p.mrn || "").toLowerCase().includes(searchInput.toLowerCase())
  );

  const loadPatientResults = async (patientId) => {
    setLoading(true);
    try {
      const results = await base44.entities.LabResult.filter(
        { patient_id: patientId, status: { $in: ["final", "verified", "preliminary"] } },
        "-created_date",
        100
      );
      setLabResults(results);
      setSelectedPatient(patients.find(p => p.id === patientId));
    } catch (e) { /* silent */ }
    finally { setLoading(false); }
  };

  // Get unique test names
  const testNames = [...new Set(labResults.map(r => r.test_name))];

  // Build chart data: group results by test, sorted by date
  const chartData = selectedTest
    ? labResults
        .filter(r => r.test_name === selectedTest)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
        .map(r => ({
          date: new Date(r.created_date).toLocaleDateString("en-GB"),
          value: parseFloat(r.result_value) || 0,
          unit: r.unit || "",
          refRange: r.reference_range || "",
          full_date: r.created_date,
        }))
    : [];

  // Detect trends
  const detectTrend = () => {
    if (chartData.length < 2) return null;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    const change = last - first;
    const pctChange = ((change / first) * 100).toFixed(1);
    
    if (change === 0) return { direction: "stable", pct: "0%" };
    if (change > 0) return { direction: "up", pct: `+${pctChange}%` };
    return { direction: "down", pct: `${pctChange}%` };
  };

  const trend = detectTrend();

  return (
    <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
      <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" /> Patient Lab Trends
      </h3>

      {!selectedPatient ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search patient by name or MRN..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {filteredPatients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No patients found</p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto border border-border/40 rounded-lg">
              {filteredPatients.slice(0, 50).map(p => (
                <button
                  key={p.id}
                  onClick={() => loadPatientResults(p.id)}
                  className="w-full text-left p-3 border-b border-border/20 hover:bg-muted/30 transition-colors text-sm"
                >
                  <div className="font-medium">{p.first_name} {p.last_name}</div>
                  <div className="text-xs text-muted-foreground">{p.mrn || "No MRN"}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Patient Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <p className="font-semibold text-sm">{selectedPatient.first_name} {selectedPatient.last_name}</p>
              <p className="text-xs text-muted-foreground">MRN: {selectedPatient.mrn || "—"}</p>
            </div>
            <button
              onClick={() => {
                setSelectedPatient(null);
                setLabResults([]);
                setSelectedTest("");
                setSearchInput("");
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80"
            >
              Change Patient
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : labResults.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No lab results found for this patient</p>
          ) : (
            <>
              {/* Test Selector */}
              <div>
                <label className="block text-xs text-muted-foreground font-medium mb-2">Select Test to View Trend</label>
                <select
                  value={selectedTest}
                  onChange={e => setSelectedTest(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Choose a test...</option>
                  {testNames.map(test => (
                    <option key={test} value={test}>{test}</option>
                  ))}
                </select>
              </div>

              {/* Chart */}
              {selectedTest && chartData.length > 0 && (
                <>
                  {/* Trend Summary */}
                  {trend && (
                    <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                      trend.direction === "down" ? "bg-chart-3/5 border-chart-3/20" :
                      trend.direction === "up" ? "bg-destructive/5 border-destructive/20" :
                      "bg-chart-2/5 border-chart-2/20"
                    }`}>
                      <AlertCircle className={`w-4 h-4 ${
                        trend.direction === "down" ? "text-chart-3" :
                        trend.direction === "up" ? "text-destructive" :
                        "text-chart-2"
                      }`} />
                      <div className="text-sm">
                        <span className="font-semibold">
                          Trend: {trend.direction === "down" ? "Improving ↓" : trend.direction === "up" ? "Worsening ↑" : "Stable →"}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          {chartData[0].value} → {chartData[chartData.length - 1].value} ({trend.pct})
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Line Chart */}
                  <div className="border border-border/40 rounded-lg bg-muted/20 p-3">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--muted-foreground))"
                          label={{ value: chartData[0].unit, angle: -90, position: "insideLeft" }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(val) => [val, selectedTest]}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          dot={{ fill: "hsl(var(--primary))", r: 4 }}
                          activeDot={{ r: 6 }}
                          strokeWidth={2}
                          name={selectedTest}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Reference Range Note */}
                  {chartData[0].refRange && (
                    <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      <strong>Reference Range:</strong> {chartData[0].refRange}
                    </div>
                  )}

                  {/* Results Table */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Historical Results</p>
                    <div className="max-h-[150px] overflow-y-auto border border-border/40 rounded divide-y divide-border/40">
                      {chartData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between p-2 text-xs hover:bg-muted/20">
                          <span className="text-muted-foreground">{d.date}</span>
                          <span className="font-mono font-semibold">{d.value} {d.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}