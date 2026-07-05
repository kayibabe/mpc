import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import { TrendingUp, Loader2, RefreshCw, Award, Clock, CheckCircle, AlertCircle } from "lucide-react";

const CHART_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

export default function StaffPerformanceMetrics() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [allMetrics, setAllMetrics] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.entities.User.list("", 100);
      setUsers(userData.filter(u => u.role === "user" || u.role === "admin"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const analyzeStaff = async (userId) => {
    setAnalyzing(true);
    try {
      const { data } = await base44.functions.invoke("analyzeStaffPerformance", { user_id: userId });
      setMetrics(data);
      setAllMetrics(prev => {
        const existing = prev.find(m => m.user_id === userId);
        if (existing) {
          return prev.map(m => m.user_id === userId ? { ...data, user_id: userId } : m);
        }
        return [...prev, { ...data, user_id: userId }];
      });
    } catch (e) {
      alert("Analysis failed: " + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const getUser = (id) => users.find(u => u.id === id);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border/60 p-8 shadow-sm flex justify-center">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Staff Selector */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
        <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Staff Performance Analysis
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Select Staff Member</label>
            <select
              value={selectedUser || ""}
              onChange={e => {
                setSelectedUser(e.target.value);
                if (e.target.value) analyzeStaff(e.target.value);
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Choose staff...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <button
              onClick={() => analyzeStaff(selectedUser)}
              disabled={analyzing}
              className="self-end inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {analyzing ? "Analyzing..." : "Refresh Analysis"}
            </button>
          )}
        </div>
      </div>

      {/* Performance Metrics Display */}
      {selectedUser && metrics && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Tasks Completed", value: metrics.tasks_completed || 0, icon: CheckCircle, color: "text-chart-3" },
              { label: "Avg Task Time (min)", value: Math.round(metrics.avg_task_duration_minutes || 0), icon: Clock, color: "text-chart-4" },
              { label: "Quality Score", value: `${(metrics.quality_score || 0).toFixed(1)}%`, icon: Award, color: "text-primary" },
              { label: "Issues", value: metrics.issues_logged || 0, icon: AlertCircle, color: "text-destructive" },
            ].map(card => (
              <div key={card.label} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </div>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            ))}
          </div>

          {/* Performance by Department */}
          {metrics.performance_by_department && Object.keys(metrics.performance_by_department).length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h4 className="font-heading font-semibold text-sm mb-4">Performance by Department</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={Object.entries(metrics.performance_by_department).map(([dept, score]) => ({
                  department: dept.replace(/_/g, " "),
                  score: score,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Task Completion Trend */}
          {metrics.monthly_completion && metrics.monthly_completion.length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h4 className="font-heading font-semibold text-sm mb-4">Task Completion Trend (Last 6 months)</h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={metrics.monthly_completion}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="completed" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Tasks Completed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Strengths & Areas for Improvement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {metrics.strengths && metrics.strengths.length > 0 && (
              <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
                <h4 className="font-heading font-semibold text-sm mb-3 text-chart-3">Strengths</h4>
                <ul className="space-y-2">
                  {metrics.strengths.map((strength, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-chart-3 mt-0.5 flex-shrink-0" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {metrics.improvement_areas && metrics.improvement_areas.length > 0 && (
              <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
                <h4 className="font-heading font-semibold text-sm mb-3 text-chart-4">Areas for Improvement</h4>
                <ul className="space-y-2">
                  {metrics.improvement_areas.map((area, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-chart-4 mt-0.5 flex-shrink-0" />
                      <span>{area}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Detailed Notes */}
          {metrics.summary && (
            <div className="bg-muted/30 rounded-xl border border-border/40 p-4">
              <p className="text-sm text-foreground">{metrics.summary}</p>
            </div>
          )}
        </div>
      )}

      {/* All Staff Summary Table */}
      {allMetrics.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <h4 className="font-heading font-semibold text-sm mb-4">Staff Performance Summary</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Staff</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tasks</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Quality</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Avg Time</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {allMetrics.map(m => {
                  const user = getUser(m.user_id);
                  return (
                    <tr key={m.user_id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-medium">{user?.full_name || "Unknown"}</td>
                      <td className="py-2.5 px-3">{m.tasks_completed || 0}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          (m.quality_score || 0) >= 90 ? "bg-chart-3/10 text-chart-3" :
                          (m.quality_score || 0) >= 75 ? "bg-chart-2/10 text-chart-2" :
                          "bg-destructive/10 text-destructive"
                        }`}>
                          {(m.quality_score || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{Math.round(m.avg_task_duration_minutes || 0)}m</td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => {
                            setSelectedUser(m.user_id);
                            setMetrics(m);
                          }}
                          className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}