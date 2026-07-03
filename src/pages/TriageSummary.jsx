import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  ClipboardCheck, AlertTriangle, Clock, Heart, Thermometer, Activity,
  Users, Filter, RefreshCw, CheckCircle, Printer, BarChart2, TrendingUp, X
} from "lucide-react";
import BedOccupancyAlert from "@/components/BedOccupancyAlert";
import PageHeader from "@/components/ui/PageHeader";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PRIORITY_CONFIG = {
  emergency: { label: "Emergency", color: "bg-triage-emergency", text: "text-triage-emergency", bg: "bg-triage-emergency/10", border: "border-triage-emergency" },
  urgent:    { label: "Urgent",    color: "bg-triage-urgent",    text: "text-triage-urgent",    bg: "bg-triage-urgent/10",    border: "border-triage-urgent" },
  normal:    { label: "Routine",   color: "bg-triage-routine",   text: "text-triage-routine",   bg: "bg-triage-routine/10",   border: "border-triage-routine" },
};

const CHART_COLORS = { emergency: "hsl(0,65%,48%)", urgent: "hsl(22,70%,50%)", normal: "hsl(155,50%,38%)" };

export default function TriageSummary() {
  const [patients, setPatients] = useState([]);
  const [vitalsMap, setVitalsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visitTypeFilter, setVisitTypeFilter] = useState("all");
  const [waitFilter, setWaitFilter] = useState("all"); // "all" | "over30" | "over60"
  const [bulkPriority, setBulkPriority] = useState("normal");
  const [triaging, setTriaging] = useState(false);
  const [activeView, setActiveView] = useState("list"); // "list" | "dashboard"
  const [reportLoading, setReportLoading] = useState(false);
  const [dailyReport, setDailyReport] = useState(null);
  const printRef = useRef(null);

  const load = async () => {
    try {
      const [visits, patientsData, vitals] = await Promise.all([
        base44.entities.Visit.filter({ queue_status: { $in: ["waiting", "triaged"] } }, "created_date", 100),
        base44.entities.Patient.list("", 300),
        base44.entities.VitalSigns.list("-created_date", 300),
      ]);

      const patientMap = {};
      patientsData.forEach(p => { patientMap[p.id] = p; });

      const latestVitals = {};
      vitals.forEach(v => {
        if (!latestVitals[v.visit_id] || new Date(v.created_date) > new Date(latestVitals[v.visit_id].created_date)) {
          latestVitals[v.visit_id] = v;
        }
      });
      setVitalsMap(latestVitals);

      const mapped = visits.map(v => {
        const p = patientMap[v.patient_id];
        return {
          id: v.id,
          patientId: v.patient_id,
          name: p ? `${p.first_name} ${p.last_name}` : v.patient_id?.slice(0, 8) || "Unknown",
          mrn: p?.mrn || "",
          age: p?.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth)) / 31557600000) : null,
          gender: p?.gender || "",
          priority: v.priority || "normal",
          status: v.queue_status,
          waitMinutes: Math.round((Date.now() - new Date(v.created_date).getTime()) / 60000),
          paymentType: v.payment_type,
          visitType: v.visit_type,
        };
      }).sort((a, b) => {
        const prio = { emergency: 0, urgent: 1, normal: 2 };
        return ((prio[a.priority] ?? 2) - (prio[b.priority] ?? 2)) || (a.waitMinutes - b.waitMinutes);
      });

      setPatients(mapped);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const unsub = base44.entities.Visit.subscribe((event) => {
      if (event.type === "create" || event.type === "update") load();
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const filtered = patients.filter(p => {
    if (priorityFilter !== "all" && p.priority !== priorityFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (visitTypeFilter !== "all" && p.visitType !== visitTypeFilter) return false;
    if (waitFilter === "over30" && p.waitMinutes < 30) return false;
    if (waitFilter === "over60" && p.waitMinutes < 60) return false;
    return true;
  });

  const stats = {
    total: patients.length,
    emergency: patients.filter(p => p.priority === "emergency").length,
    urgent: patients.filter(p => p.priority === "urgent").length,
    normal: patients.filter(p => p.priority === "normal").length,
    avgWait: patients.length > 0 ? Math.round(patients.reduce((s, p) => s + p.waitMinutes, 0) / patients.length) : 0,
    triaged: patients.filter(p => p.status === "triaged").length,
    waiting: patients.filter(p => p.status === "waiting").length,
    over60: patients.filter(p => p.waitMinutes > 60).length,
  };

  const visitTypeBreakdown = patients.reduce((acc, p) => {
    acc[p.visitType] = (acc[p.visitType] || 0) + 1;
    return acc;
  }, {});

  const chartData = [
    { name: "Emergency", value: stats.emergency, priority: "emergency" },
    { name: "Urgent", value: stats.urgent, priority: "urgent" },
    { name: "Routine", value: stats.normal, priority: "normal" },
  ];

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const toggleAll = () => selected.length === filtered.length ? setSelected([]) : setSelected(filtered.map(p => p.id));

  const handleBulkTriage = async () => {
    if (selected.length === 0) return;
    setTriaging(true);
    try {
      const { data } = await base44.functions.invoke("bulkTriage", {
        journey_ids: selected,
        priority: bulkPriority,
        notes: `Bulk triaged as ${bulkPriority} from Triage Summary`,
      });
      if (data.success) { setSelected([]); load(); }
    } catch (e) {
      alert("Bulk triage failed: " + (e.response?.data?.error || e.message));
    } finally { setTriaging(false); }
  };

  const fetchDailyReport = async () => {
    setReportLoading(true);
    try {
      const { data } = await base44.functions.invoke("generateDailyReport", {});
      setDailyReport(data);
    } catch (_) {}
    finally { setReportLoading(false); }
  };

  const handlePrint = () => {
    const content = `
      <html><head><title>Triage Summary Report — ${new Date().toLocaleDateString("en-GB")}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; }
        h1 { font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #f0f4f8; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        .emergency { color: #dc2626; font-weight: bold; }
        .urgent { color: #ea580c; font-weight: bold; }
        .normal { color: #16a34a; }
        .stats { display: flex; gap: 16px; margin: 12px 0; }
        .stat { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { font-size: 10px; color: #64748b; }
      </style></head><body>
      <h1>🏥 Triage Summary — Zomba City Private Clinic</h1>
      <p>Generated: ${new Date().toLocaleString("en-GB")} &nbsp;|&nbsp; Total Waiting: ${stats.total} &nbsp;|&nbsp; Avg Wait: ${stats.avgWait} min</p>
      <div class="stats">
        <div class="stat"><div class="stat-value" style="color:#dc2626">${stats.emergency}</div><div class="stat-label">Emergency</div></div>
        <div class="stat"><div class="stat-value" style="color:#ea580c">${stats.urgent}</div><div class="stat-label">Urgent</div></div>
        <div class="stat"><div class="stat-value" style="color:#16a34a">${stats.normal}</div><div class="stat-label">Routine</div></div>
        <div class="stat"><div class="stat-value">${stats.triaged}</div><div class="stat-label">Triaged</div></div>
        <div class="stat"><div class="stat-value">${stats.over60}</div><div class="stat-label">Wait &gt; 1hr</div></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Patient</th><th>MRN</th><th>Age/Sex</th><th>Priority</th><th>Status</th><th>Wait</th><th>Visit Type</th><th>Payment</th></tr></thead>
        <tbody>
          ${filtered.map((p, i) => `
            <tr>
              <td>${i + 1}</td><td>${p.name}</td><td>${p.mrn || "—"}</td>
              <td>${p.age !== null ? p.age + "y" : "—"} / ${p.gender?.charAt(0)?.toUpperCase() || "—"}</td>
              <td class="${p.priority}">${PRIORITY_CONFIG[p.priority]?.label || p.priority}</td>
              <td>${p.status === "triaged" ? "Triaged" : "Waiting"}</td>
              <td>${p.waitMinutes < 60 ? p.waitMinutes + "m" : Math.floor(p.waitMinutes / 60) + "h " + (p.waitMinutes % 60) + "m"}</td>
              <td>${p.visitType?.replace(/_/g, " ") || "—"}</td>
              <td>${p.paymentType || "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      </body></html>
    `;
    const w = window.open("", "_blank");
    w.document.write(content);
    w.document.close();
    w.print();
  };

  const visitTypes = [...new Set(patients.map(p => p.visitType).filter(Boolean))];

  if (loading) return (
    <div className="page-container flex items-center justify-center py-20">
      <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <PageHeader title="Triage Summary" subtitle={`Real-time overview · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`} icon={ClipboardCheck}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
            <button onClick={() => setActiveView("list")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              <ClipboardCheck className="w-3.5 h-3.5 inline mr-1" /> List
            </button>
            <button onClick={() => setActiveView("dashboard")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === "dashboard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              <BarChart2 className="w-3.5 h-3.5 inline mr-1" /> Dashboard
            </button>
          </div>
          <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={fetchDailyReport} disabled={reportLoading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-50">
            <TrendingUp className="w-3.5 h-3.5" /> {reportLoading ? "Loading…" : "Daily Report"}
          </button>
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </PageHeader>

      {/* Bed Occupancy Alert */}
      <BedOccupancyAlert threshold={80} />

      {/* Daily Report Panel */}
      {dailyReport && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 relative">
          <button onClick={() => setDailyReport(null)} className="absolute top-3 right-3 text-blue-400 hover:text-blue-600"><X className="w-4 h-4" /></button>
          <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Daily Performance Report — {new Date().toLocaleDateString("en-GB")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Visits", value: dailyReport.summary?.total_visits_today ?? "—" },
              { label: "Appointments", value: dailyReport.summary?.total_appointments_today ?? "—" },
              { label: "Lab Orders", value: dailyReport.summary?.pending_lab_orders ?? "—" },
              { label: "Revenue (MWK)", value: (dailyReport.summary?.total_revenue_mwk ?? 0).toLocaleString() },
            ].map(item => (
              <div key={item.label} className="bg-white/70 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-blue-800">{item.value}</p>
                <p className="text-[10px] text-blue-600">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {[
          { label: "Total", value: stats.total, cls: "" },
          { label: "Emergency", value: stats.emergency, cls: "text-triage-emergency border-l-2 border-l-triage-emergency" },
          { label: "Urgent", value: stats.urgent, cls: "text-triage-urgent border-l-2 border-l-triage-urgent" },
          { label: "Routine", value: stats.normal, cls: "text-triage-routine border-l-2 border-l-triage-routine" },
          { label: "Waiting", value: stats.waiting, cls: "" },
          { label: "Triaged", value: stats.triaged, cls: "text-chart-3" },
          { label: "Avg Wait", value: `${stats.avgWait}m`, cls: "" },
          { label: "Over 1hr", value: stats.over60, cls: stats.over60 > 0 ? "text-triage-urgent" : "" },
        ].map(card => (
          <div key={card.label} className={`stat-card text-center py-3 ${card.cls}`}>
            <p className={`text-2xl font-bold font-mono ${card.cls}`}>{card.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Dashboard View */}
      {activeView === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Priority Bar Chart */}
          <div className="bg-white rounded-lg border border-border p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" /> Patients by Priority</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={48}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => <Cell key={entry.priority} fill={CHART_COLORS[entry.priority]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Visit Type Breakdown */}
          <div className="bg-white rounded-lg border border-border p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Visit Type Breakdown</h4>
            <div className="space-y-2.5">
              {Object.entries(visitTypeBreakdown).map(([type, count]) => {
                const pct = Math.round((count / Math.max(stats.total, 1)) * 100);
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="capitalize font-medium">{type.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground font-mono">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {Object.keys(visitTypeBreakdown).length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
            </div>
          </div>

          {/* Wait Time Distribution */}
          <div className="bg-white rounded-lg border border-border p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Wait Time Distribution</h4>
            {[
              { label: "< 15 min", count: patients.filter(p => p.waitMinutes < 15).length, color: "bg-chart-3" },
              { label: "15–30 min", count: patients.filter(p => p.waitMinutes >= 15 && p.waitMinutes < 30).length, color: "bg-primary" },
              { label: "30–60 min", count: patients.filter(p => p.waitMinutes >= 30 && p.waitMinutes < 60).length, color: "bg-triage-urgent" },
              { label: "> 60 min", count: patients.filter(p => p.waitMinutes >= 60).length, color: "bg-triage-emergency" },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
                <div className={`w-2.5 h-2.5 rounded-full ${row.color} flex-shrink-0`} />
                <span className="text-xs flex-1">{row.label}</span>
                <span className="text-sm font-bold font-mono">{row.count}</span>
              </div>
            ))}
          </div>

          {/* Vitals alerts */}
          <div className="bg-white rounded-lg border border-border p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-destructive" /> Abnormal Vitals Alerts</h4>
            <div className="space-y-2 max-h-[160px] overflow-y-auto">
              {patients.filter(p => {
                const v = vitalsMap[p.id];
                return v && (v.heart_rate > 100 || v.temperature > 38 || v.spo2 < 95 || v.bp_systolic > 140);
              }).map(p => {
                const v = vitalsMap[p.id];
                return (
                  <div key={p.id} className="flex items-start gap-2 p-2 bg-destructive/5 rounded-lg border border-destructive/10">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {v.heart_rate > 100 ? `HR: ${v.heart_rate} bpm · ` : ""}
                        {v.temperature > 38 ? `Temp: ${v.temperature}°C · ` : ""}
                        {v.spo2 < 95 ? `SpO₂: ${v.spo2}% · ` : ""}
                        {v.bp_systolic > 140 ? `BP: ${v.bp_systolic}/${v.bp_diastolic}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              {patients.filter(p => {
                const v = vitalsMap[p.id];
                return v && (v.heart_rate > 100 || v.temperature > 38 || v.spo2 < 95 || v.bp_systolic > 140);
              }).length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No abnormal vitals detected</p>}
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filters */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border/50">
        <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground font-medium mr-1">Filters:</span>

        {/* Priority */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-md p-0.5">
          {[{ key: "all", label: "All Priority" }, { key: "emergency", label: "Emergency" }, { key: "urgent", label: "Urgent" }, { key: "normal", label: "Routine" }].map(f => (
            <button key={f.key} onClick={() => setPriorityFilter(f.key)} className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${priorityFilter === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{f.label}</button>
          ))}
        </div>

        {/* Status */}
        <select className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="waiting">Waiting</option>
          <option value="triaged">Triaged</option>
        </select>

        {/* Visit type */}
        <select className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs" value={visitTypeFilter} onChange={e => setVisitTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          {visitTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>

        {/* Wait time */}
        <select className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs" value={waitFilter} onChange={e => setWaitFilter(e.target.value)}>
          <option value="all">Any Wait Time</option>
          <option value="over30">Waiting &gt; 30 min</option>
          <option value="over60">Waiting &gt; 60 min</option>
        </select>

        {(priorityFilter !== "all" || statusFilter !== "all" || visitTypeFilter !== "all" || waitFilter !== "all") && (
          <button onClick={() => { setPriorityFilter("all"); setStatusFilter("all"); setVisitTypeFilter("all"); setWaitFilter("all"); }} className="text-xs text-primary hover:underline ml-1">
            Clear all
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {patients.length} shown</span>

        {/* Bulk triage */}
        {selected.length > 0 && (
          <div className="flex items-center gap-2 pl-3 border-l border-border">
            <span className="text-xs text-muted-foreground">{selected.length} selected</span>
            <select className="rounded-md border border-border bg-background px-2 py-1 text-xs" value={bulkPriority} onChange={e => setBulkPriority(e.target.value)}>
              <option value="emergency">Emergency</option>
              <option value="urgent">Urgent</option>
              <option value="normal">Routine</option>
            </select>
            <button onClick={handleBulkTriage} disabled={triaging} className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
              <CheckCircle className="w-3 h-3" /> {triaging ? "Triaging…" : "Bulk Triage"}
            </button>
          </div>
        )}
      </div>

      {/* Patient List */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden" ref={printRef}>
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No patients matching filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-3 px-4"><input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded" /></th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">#</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">Patient</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">MRN</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">Age/Sex</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">Priority</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">Wait</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">Vitals</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((p, idx) => {
                  const conf = PRIORITY_CONFIG[p.priority] || PRIORITY_CONFIG.normal;
                  const vitals = vitalsMap[p.id];
                  const isSelected = selected.includes(p.id);
                  const hasAbnormalVitals = vitals && (vitals.heart_rate > 100 || vitals.temperature > 38 || vitals.spo2 < 95);

                  return (
                    <tr key={p.id} className={`hover:bg-muted/30 transition-colors border-l-[3px] ${isSelected ? "bg-primary/5 border-l-primary" : conf.border}`}>
                      <td className="py-2.5 px-4"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)} className="rounded" /></td>
                      <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{p.visitType?.replace(/_/g, " ")}</p>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{p.mrn || "—"}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{p.age !== null ? `${p.age}y` : "—"} / {p.gender?.charAt(0)?.toUpperCase() || "—"}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${conf.text} ${conf.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${conf.color}`} />{conf.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.status === "triaged" ? "bg-chart-3/10 text-chart-3" : "bg-muted text-muted-foreground"}`}>
                          {p.status === "triaged" ? "Triaged" : "Waiting"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`font-mono text-xs font-medium ${p.waitMinutes > 60 ? "text-triage-urgent" : p.waitMinutes > 30 ? "text-chart-2" : "text-muted-foreground"}`}>
                          {p.waitMinutes < 60 ? `${p.waitMinutes}m` : `${Math.floor(p.waitMinutes / 60)}h ${p.waitMinutes % 60}m`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {vitals ? (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {vitals.heart_rate && <span className={vitals.heart_rate > 100 ? "text-triage-urgent font-semibold" : "text-muted-foreground"}><Heart className="w-3 h-3 inline" /> {vitals.heart_rate}</span>}
                            {vitals.temperature && <span className={vitals.temperature > 38 ? "text-triage-urgent font-semibold" : "text-muted-foreground"}><Thermometer className="w-3 h-3 inline" /> {vitals.temperature}°</span>}
                            {vitals.spo2 && <span className={vitals.spo2 < 95 ? "text-triage-emergency font-semibold" : "text-muted-foreground"}><Activity className="w-3 h-3 inline" /> {vitals.spo2}%</span>}
                            {hasAbnormalVitals && <AlertTriangle className="w-3 h-3 text-destructive" />}
                          </div>
                        ) : <span className="text-[10px] text-muted-foreground/50">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-[10px] capitalize text-muted-foreground">{p.paymentType}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}