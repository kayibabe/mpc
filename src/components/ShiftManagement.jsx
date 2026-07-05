import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ClipboardList, Plus, Check, Clock, ArrowRightLeft, TrendingUp, Loader2, DollarSign, Shield } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const SHIFT_TYPES = ["reception", "nursing", "pharmacy", "lab", "clinical", "admin", "billing"];
const PIE_COLORS = ["hsl(194, 65%, 42%)", "hsl(38, 92%, 50%)", "hsl(160, 60%, 40%)"];

export default function ShiftManagement() {
  const [tab, setTab] = useState("handover");
  const [handovers, setHandovers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    shift_type: "nursing",
    handover_to_user_id: "",
    critical_notes: "",
    outstanding_tasks: "",
    pending_lab_results: "",
    pending_imaging: "",
    ward_updates: "",
    pharmacy_requests: "",
    incidents_reported: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [h, u] = await Promise.all([
          base44.entities.ShiftHandoverLog.list("-created_date", 50),
          base44.entities.User.list("", 50),
        ]);
        setHandovers(h);
        setUsers(u);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const { data } = await base44.functions.invoke("analyzeShiftPerformance", {});
      setAnalytics(data);
    } catch (e) { console.error(e); }
    finally { setAnalyticsLoading(false); }
  };

  const submitHandover = async (e) => {
    e.preventDefault();
    try {
      await base44.entities.ShiftHandoverLog.create({
        ...form,
        handover_date: new Date().toISOString(),
      });
      const h = await base44.entities.ShiftHandoverLog.list("-created_date", 50);
      setHandovers(h);
      setShowForm(false);
      setForm({
        shift_type: "nursing", handover_to_user_id: "", critical_notes: "",
        outstanding_tasks: "", pending_lab_results: "", pending_imaging: "",
        ward_updates: "", pharmacy_requests: "", incidents_reported: "",
      });
    } catch (e) { console.error(e); }
  };

  const acknowledgeHandover = async (id) => {
    await base44.entities.ShiftHandoverLog.update(id, {
      acknowledged: true,
      acknowledged_by: "user",
      acknowledged_date: new Date().toISOString(),
    });
    setHandovers(handovers.map(h => h.id === id ? { ...h, acknowledged: true } : h));
  };

  const getUserName = (id) => {
    const u = users.find(u => u.id === id);
    return u ? (u.full_name || u.email) : id?.slice(0, 8) || "Unknown";
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {[
          { key: "handover", label: "Handover Logs", icon: ClipboardList },
          { key: "analytics", label: "Shift Analytics", icon: TrendingUp },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key === "analytics" && !analytics) loadAnalytics(); }}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "handover" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Shift Handover Logs</h4>
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" /> New Handover
            </button>
          </div>

          {showForm && (
            <form onSubmit={submitHandover} className="mb-4 p-4 bg-muted/30 rounded-xl space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">Shift Type</label>
                  <select className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" value={form.shift_type} onChange={e => setForm({...form, shift_type: e.target.value})}>
                    {SHIFT_TYPES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">Handover To</label>
                  <select className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" value={form.handover_to_user_id} onChange={e => setForm({...form, handover_to_user_id: e.target.value})}>
                    <option value="">Select staff</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                  </select>
                </div>
              </div>
              {[
                { key: "critical_notes", label: "Critical Notes" },
                { key: "outstanding_tasks", label: "Outstanding Tasks" },
                { key: "pending_lab_results", label: "Pending Lab Results" },
                { key: "pending_imaging", label: "Pending Imaging" },
                { key: "ward_updates", label: "Ward Updates" },
                { key: "pharmacy_requests", label: "Pharmacy Requests" },
                { key: "incidents_reported", label: "Incidents Reported" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-muted-foreground mb-0.5">{f.label}</label>
                  <textarea className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" rows={2} value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})} />
                </div>
              ))}
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium">Submit Handover</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 border border-border rounded-lg text-xs hover:bg-muted">Cancel</button>
              </div>
            </form>
          )}

          {handovers.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No handover logs yet.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {handovers.map(h => (
                <div key={h.id} className={`p-3 border rounded-lg ${h.acknowledged ? "bg-chart-3/5 border-chart-3/20" : "bg-amber-500/5 border-amber-500/20"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium capitalize">{h.shift_type} shift</span>
                      <span className="text-xs text-muted-foreground">→ {getUserName(h.handover_to_user_id)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{new Date(h.handover_date).toLocaleString("en-GB")}</span>
                      {!h.acknowledged ? (
                        <button onClick={() => acknowledgeHandover(h.id)} className="inline-flex items-center gap-1 px-2 py-0.5 bg-chart-3/10 text-chart-3 rounded text-[10px] font-medium hover:bg-chart-3/20">
                          <Check className="w-3 h-3" /> Acknowledge
                        </button>
                      ) : (
                        <span className="text-[10px] text-chart-3 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Acknowledged
                        </span>
                      )}
                    </div>
                  </div>
                  {h.critical_notes && <p className="text-xs text-destructive mb-1">⚠ {h.critical_notes}</p>}
                  {h.outstanding_tasks && <p className="text-xs text-muted-foreground">Tasks: {h.outstanding_tasks}</p>}
                  {h.pending_lab_results && <p className="text-xs text-muted-foreground">Labs: {h.pending_lab_results}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "analytics" && (
        <div>
          {analyticsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : analytics ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Shifts (30d)", value: analytics.summary.total_shifts, icon: Clock, color: "bg-primary" },
                  { label: "Total Revenue", value: `MWK ${(analytics.summary.total_collected_mwk || 0).toLocaleString()}`, icon: DollarSign, color: "bg-chart-3" },
                  { label: "Avg / Shift", value: `MWK ${(analytics.summary.avg_shift_revenue_mwk || 0).toLocaleString()}`, icon: TrendingUp, color: "bg-chart-2" },
                  { label: "Insurance Claims", value: `MWK ${(analytics.summary.total_insurance_claims || 0).toLocaleString()}`, icon: Shield, color: "bg-chart-4" },
                ].map(s => (
                  <div key={s.label} className="stat-card flex items-center gap-2 p-3">
                    <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center`}><s.icon className="w-4 h-4 text-white" /></div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className="text-sm font-bold">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card rounded-xl border border-border/60 p-4">
                  <h4 className="text-xs font-semibold mb-3">Payment Method Split</h4>
                  {analytics.payment_breakdown?.length > 0 && analytics.summary.total_collected_mwk > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={analytics.payment_breakdown} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={70} innerRadius={40} label={({ method, percentage }) => `${method}: ${percentage}%`}>
                          {analytics.payment_breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => `MWK ${value.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-8 text-center text-xs text-muted-foreground">No payment data yet.</p>
                  )}
                </div>

                <div className="bg-card rounded-xl border border-border/60 p-4">
                  <h4 className="text-xs font-semibold mb-3">Revenue by Cashier</h4>
                  {analytics.cashier_breakdown?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.cashier_breakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="cashier" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value) => `MWK ${value.toLocaleString()}`} />
                        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-8 text-center text-xs text-muted-foreground">No cashier data yet.</p>
                  )}
                </div>
              </div>

              {analytics.recent_shifts?.length > 0 && (
                <div className="bg-card rounded-xl border border-border/60 p-4">
                  <h4 className="text-xs font-semibold mb-2">Recent Shifts</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Cashier</th>
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Duration</th>
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Cash</th>
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Card</th>
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Mobile</th>
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Total</th>
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Variance</th>
                      </tr></thead>
                      <tbody>
                        {analytics.recent_shifts.slice(0, 10).map((s, i) => (
                          <tr key={i} className="border-b border-border/40">
                            <td className="py-1.5 px-2">{s.cashier}</td>
                            <td className="py-1.5 px-2">{s.duration_hours ? `${s.duration_hours}h` : "—"}</td>
                            <td className="py-1.5 px-2">{s.cash.toLocaleString()}</td>
                            <td className="py-1.5 px-2">{s.card.toLocaleString()}</td>
                            <td className="py-1.5 px-2">{s.mobile.toLocaleString()}</td>
                            <td className="py-1.5 px-2 font-semibold">{s.total_collected.toLocaleString()}</td>
                            <td className={`py-1.5 px-2 font-mono ${Math.abs(s.variance) > 1000 ? "text-destructive" : "text-chart-3"}`}>
                              {s.variance >= 0 ? "+" : ""}{s.variance.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">Failed to load analytics.</p>
          )}
        </div>
      )}
    </div>
  );
}