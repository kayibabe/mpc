import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Users, Calendar, FlaskConical, BedDouble, Pill, Receipt, TrendingUp, Clock, Activity, RefreshCw, Bell, Send, Loader2, GitBranch, Megaphone, ArrowRight, AlertTriangle, FileDown, CheckSquare, Square, X, FileText, ChevronDown, ChevronUp, RefreshCcw, Download } from "lucide-react";
import PatientJourneyTimeline from "@/components/PatientJourneyTimeline";
import InventoryAlerts from "@/components/InventoryAlerts";
import LivePulse from "@/components/LivePulse";
import RealTimeVitals from "@/components/RealTimeVitals";
import TriageWidget from "@/components/TriageWidget";
import WardSummary from "@/components/WardSummary";
import WardOccupancyChart from "@/components/WardOccupancyChart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const CHART_COLORS = ["hsl(194, 65%, 42%)", "hsl(38, 92%, 50%)", "hsl(160, 60%, 40%)", "hsl(280, 50%, 50%)", "hsl(340, 65%, 50%)", "hsl(0, 72%, 51%)"];

function StatCard({ label, value, sub, color, to }) {
  const content = (
    <div className={`stat-card flex flex-col gap-2 bg-white border transition-all duration-200 group cursor-pointer ${
      color === 'critical' ? 'border-clinical-critical/20 hover:border-clinical-critical/40 hover:shadow-md hover:shadow-clinical-critical/10' :
      color === 'warning' ? 'border-triage-urgent/20 hover:border-triage-urgent/40 hover:shadow-md hover:shadow-triage-urgent/10' :
      'border-border hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
    }`}>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className={`text-3xl font-bold tracking-tight font-mono tabular-nums ${
        color === 'critical' ? 'text-clinical-critical' :
        color === 'warning' ? 'text-triage-urgent' :
        color === 'success' ? 'text-clinical-normal' :
        'text-foreground'
      }`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
  if (to) return <Link to={to}>{content}</Link>;
  return content;
}

export default function Dashboard() {
  const [stats, setStats] = useState({ patients: 0, appointments: 0, labOrders: 0, occupiedBeds: 0, drugs: 0, revenue: 0 });
  const [recentVisits, setRecentVisits] = useState([]);
  const [dailyReport, setDailyReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);
  const [occupancyData, setOccupancyData] = useState({ beds: [], wards: [], visits: [], queueSummary: {} });
  const [activeJourneys, setActiveJourneys] = useState([]);
  const [journeyPatients, setJourneyPatients] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [expandedStages, setExpandedStages] = useState({});
  const [batchModal, setBatchModal] = useState(false);
  const [batchReports, setBatchReports] = useState([]);
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [shiftSyncLoading, setShiftSyncLoading] = useState(false);
  const [shiftSyncResult, setShiftSyncResult] = useState(null);
  const [patientExportLoading, setPatientExportLoading] = useState(false);

  const refreshDailyReport = async () => {
    setReportLoading(true);
    try {
      const { data } = await base44.functions.invoke('generateDailyReport', {});
      setDailyReport(data);
    } catch (e) { /* silent */ }
    finally { setReportLoading(false); }
  };

  const sendReminders = async () => {
    setReminderSending(true);
    setReminderResult(null);
    try {
      const { data } = await base44.functions.invoke('sendAppointmentReminders', {});
      setReminderResult(data);
    } catch (e) {
      setReminderResult({ error: "Failed to send reminders" });
    } finally {
      setReminderSending(false);
    }
  };

  const toggleReport = (name) => {
    setBatchReports(prev => prev.includes(name) ? prev.filter(r => r !== name) : [...prev, name]);
  };

  const runBatchExport = async () => {
    if (batchReports.length === 0) return;
    setBatchExporting(true);
    setBatchResult(null);
    try {
      const { data } = await base44.functions.invoke('batchExportReports', { reports: batchReports });
      setBatchResult(data);
    } catch (e) {
      setBatchResult({ error: 'Batch export failed' });
    } finally {
      setBatchExporting(false);
    }
  };

  const syncShiftReports = async () => {
    setShiftSyncLoading(true);
    setShiftSyncResult(null);
    try {
      const { data } = await base44.functions.invoke('syncShiftReports', {});
      setShiftSyncResult(data);
    } catch (e) {
      setShiftSyncResult({ error: 'Shift sync failed' });
    } finally {
      setShiftSyncLoading(false);
    }
  };

  const exportPatientData = async (type) => {
    setPatientExportLoading(true);
    try {
      const { data } = await base44.functions.invoke('batchExportReports', { reports: [type] });
      if (data?.exports?.[type]?.status === 'ok') {
        // Build CSV from the export data
        const csvData = data.exports[type].data || [];
        if (csvData.length > 0) {
          const headers = Object.keys(csvData[0]);
          const csv = [headers.join(','), ...csvData.map(row => headers.map(h => JSON.stringify(row[h] || '').replace(/"/g, '""')).join(','))].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${type}_export_${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (e) { /* silent */ }
    finally { setPatientExportLoading(false); }
  };

  const loadOccupancyData = async () => {
    try {
      const [wards, beds, visits] = await Promise.all([
        base44.entities.Ward.list("", 20),
        base44.entities.Bed.list("", 200),
        base44.entities.Visit.filter({ queue_status: { $in: ["waiting", "triaged", "in_consultation", "in_lab", "in_pharmacy"] } }, "", 100),
      ]);
      const queueSummary = {};
      visits.forEach(v => {
        const s = v.queue_status || "waiting";
        queueSummary[s] = (queueSummary[s] || 0) + 1;
      });
      setOccupancyData({ wards, beds, visits, queueSummary });
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    async function load() {
      try {
        const [patients, appointments, labOrders, beds, drugs, visits, invoices] = await Promise.all([
          base44.entities.Patient.list("-created_date", 1000),
          base44.entities.Appointment.filter({ appointment_date: new Date().toISOString().slice(0, 10) }, "-appointment_date", 200),
          base44.entities.LabOrder.filter({ status: { $in: ["ordered", "in_progress"] } }, "-created_date", 1000),
          base44.entities.Bed.filter({ status: "occupied" }, "", 1000),
          base44.entities.Drug.list("", 1000),
          base44.entities.Visit.list("-created_date", 10),
          base44.entities.Invoice.filter({ status: "paid" }, "-created_date", 1000),
        ]);
        const rev = invoices.reduce((sum, inv) => sum + (inv.net_amount || inv.total_amount || 0), 0);
        setStats({
          patients: patients.length,
          appointments: appointments.length,
          labOrders: labOrders.length,
          occupiedBeds: beds.length,
          drugs: drugs.filter(d => d.quantity_in_stock <= d.reorder_level).length,
          revenue: rev,
        });
        setRecentVisits(visits);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
    refreshDailyReport();
    loadOccupancyData();
    loadWorkflowData();
  }, []);

  const loadWorkflowData = async () => {
    try {
      const [journeys, notifs] = await Promise.all([
        base44.entities.PatientJourney.filter({ status: "active" }, "-created_date", 50),
        base44.entities.Notification.filter({ is_read: false }, "-created_date", 10),
      ]);
      setActiveJourneys(journeys);
      setNotifications(notifs);

      // Fetch patient names for journeys
      const pids = [...new Set(journeys.map(j => j.patient_id).filter(Boolean))];
      const pMap = {};
      await Promise.all(pids.map(async (pid) => {
        try { const p = await base44.entities.Patient.get(pid); if (p) pMap[pid] = `${p.first_name} ${p.last_name}`; }
        catch (_) { pMap[pid] = pid?.slice(0, 8) || "Unknown"; }
      }));
      setJourneyPatients(pMap);
    } catch (e) { /* silent */ }
  };

  const markNotifRead = async (id) => {
    await base44.entities.Notification.update(id, { is_read: true });
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const visitTypeLabel = (t) => ({ outpatient: "OPD", inpatient: "IPD", emergency: "ER", anc: "ANC", postnatal: "PNC", procedure: "PROC" }[t] || t);

  const STAGE_LABELS = {
    RECEPTION: "Reception", TRIAGE: "Triage", CONSULTATION: "Doctor",
    LAB_PENDING: "Lab Wait", LAB_PROCESSING: "Lab", IMAGING_PENDING: "Imaging Wait",
    IMAGING_PROCESSING: "Imaging", PHARMACY_PENDING: "Pharmacy Wait",
    PHARMACY_DISPENSING: "Pharmacy", NURSING_ADMINISTRATION: "Nursing", BILLING: "Billing", COMPLETED: "Done",
  };
  const STAGE_COLORS = {
    RECEPTION: "border-l-primary", TRIAGE: "border-l-triage-semi", CONSULTATION: "border-l-chart-1",
    LAB_PENDING: "border-l-chart-3", LAB_PROCESSING: "border-l-chart-3", IMAGING_PENDING: "border-l-chart-4",
    IMAGING_PROCESSING: "border-l-chart-4", PHARMACY_PENDING: "border-l-chart-2", PHARMACY_DISPENSING: "border-l-chart-2",
    NURSING_ADMINISTRATION: "border-l-chart-1", BILLING: "border-l-chart-5",
  };
  const SLAS = {RECEPTION:15,TRIAGE:20,CONSULTATION:45,LAB_PENDING:30,LAB_PROCESSING:60,IMAGING_PENDING:30,IMAGING_PROCESSING:60,PHARMACY_PENDING:30,PHARMACY_DISPENSING:45,NURSING_ADMINISTRATION:60,BILLING:30};

  // Group journeys by stage
  const jornadaPorEtapa = {};
  activeJourneys.forEach(j => {
    const s = j.current_stage || "Unknown";
    if (!jornadaPorEtapa[s]) jornadaPorEtapa[s] = [];
    jornadaPorEtapa[s].push(j);
  });
  const stageOrder = Object.keys(STAGE_LABELS);
  const sortedStageKeys = Object.keys(jornadaPorEtapa).sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b));

  const toggleStage = (stage) => {
    setExpandedStages(prev => ({ ...prev, [stage]: !prev[stage] }));
  };

  const getSlaMinutes = (journey) => {
    try {
      const history = journey.stage_history ? JSON.parse(journey.stage_history) : [];
      const lastEntry = history[history.length - 1];
      if (lastEntry && lastEntry.to === journey.current_stage) {
        return Math.round((Date.now() - new Date(lastEntry.timestamp).getTime()) / 60000);
      }
    } catch(_){}
    return Math.round((Date.now() - new Date(journey.created_date).getTime()) / 60000);
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const report = dailyReport?.summary;

  return (
    <div className="page-container space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Zomba City Private Clinic — {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncShiftReports}
            disabled={shiftSyncLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${shiftSyncLoading ? 'animate-spin' : ''}`} />
            {shiftSyncLoading ? 'Syncing...' : 'Sync Shifts'}
          </button>
          <button
            onClick={() => setBatchModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
          >
            <FileDown className="w-3.5 h-3.5" /> Export
          </button>
          <button
            onClick={refreshDailyReport}
            disabled={reportLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reportLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <InventoryAlerts />

      {/* KPI Cards */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Key Performance Indicators</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
         <StatCard label="Registered Patients" value={stats.patients} to="/reception" />
         <StatCard label="Today's Appointments" value={report?.total_appointments_today ?? stats.appointments} sub={report ? `${report.appointments_completed} completed` : null} to="/appointments" />
         <StatCard label="Pending Lab Orders" value={report?.pending_lab_orders ?? stats.labOrders} to="/lab" />
         <StatCard label="Occupied Beds" value={report?.active_inpatients ?? stats.occupiedBeds} to="/inpatient" />
         <StatCard label="Low Stock Drugs" value={report?.drugs_low_stock ?? stats.drugs} color={report?.drugs_low_stock > 0 ? 'warning' : 'success'} to="/pharmacy" />
         <StatCard label="Revenue (MWK)" value={(report?.total_revenue_mwk ?? stats.revenue).toLocaleString()} to="/billing" />
       </div>
      </div>

      {report && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Operational Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {report.total_visits_today !== undefined && (
              <div className="bg-white rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold">{report.total_visits_today}</p>
                <p className="text-xs text-muted-foreground mt-1">Today's Visits</p>
              </div>
            )}
            {report.appointments_completed !== undefined && (
              <div className="bg-white rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-clinical-normal">{report.appointments_completed}</p>
                <p className="text-xs text-muted-foreground mt-1">Completed</p>
              </div>
            )}
            {report.appointments_no_show !== undefined && (
              <div className="bg-white rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-clinical-critical">{report.appointments_no_show}</p>
                <p className="text-xs text-muted-foreground mt-1">No-shows</p>
              </div>
            )}
            {report.active_inpatients !== undefined && (
              <div className="bg-white rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-chart-4">{report.active_inpatients}</p>
                <p className="text-xs text-muted-foreground mt-1">Inpatients</p>
              </div>
            )}
            {report.pending_lab_orders !== undefined && (
              <div className="bg-white rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-chart-1">{report.pending_lab_orders}</p>
                <p className="text-xs text-muted-foreground mt-1">Pending Labs</p>
              </div>
            )}
            {report.drugs_low_stock !== undefined && (
              <div className="bg-white rounded-lg border border-clinical-critical/20 p-4 text-center">
                <p className="text-2xl font-bold text-clinical-critical">{report.drugs_low_stock}</p>
                <p className="text-xs text-muted-foreground mt-1">Low Stock</p>
              </div>
            )}
          </div>
        </div>
      )}



      {/* Occupancy & Queue Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TriageWidget />

        <div className="bg-white rounded-lg border border-border p-5">
          <h3 className="font-heading text-sm font-semibold mb-4">Bed Occupancy by Ward</h3>
          {occupancyData.wards.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={occupancyData.wards.map(w => {
                const wardBeds = occupancyData.beds.filter(b => b.ward_id === w.id);
                return { name: w.name, total: wardBeds.length, occupied: wardBeds.filter(b => b.status === "occupied").length };
              }).filter(w => w.total > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="occupied" stackId="a" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} name="Occupied" />
                <Bar dataKey="total" stackId="a" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name="Available">
                  {occupancyData.wards.map((_, i) => <Cell key={i} fill="hsl(var(--muted))" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">No wards configured</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border p-5">
          <h3 className="font-heading text-sm font-semibold mb-4">Current Queue Status</h3>
          {Object.keys(occupancyData.queueSummary).length > 0 ? (
            <div className="flex items-start gap-4">
              {/* Donut Chart — Left */}
              <div className="w-[45%] flex-shrink-0">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={Object.entries(occupancyData.queueSummary).map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} label={({ name, value }) => `${name}: ${value}`}>
                      {Object.keys(occupancyData.queueSummary).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Waiting Patients List — Right */}
              <div className="flex-1 min-w-0 border-l border-border pl-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Waiting Patients</p>
                {(() => {
                  const waiting = occupancyData.visits
                    .filter(v => v.queue_status === "waiting")
                    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
                  if (waiting.length === 0) {
                    return <p className="text-xs text-muted-foreground py-4 text-center">No patients waiting</p>;
                  }
                  return (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                      {waiting.map((v, i) => (
                        <div key={v.id} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/40 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">{i + 1}</span>
                            <span className="truncate font-medium">{v.patient_id?.slice(0, 8)}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                            {(() => {
                              const mins = Math.round((Date.now() - new Date(v.created_date).getTime()) / 60000);
                              return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
                            })()}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">Queue is clear</p>
            )}
            </div>

      <RealTimeVitals />

      <WardSummary />

      <WardOccupancyChart compact />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 bg-white rounded-lg border border-border p-5">
          <h3 className="font-heading text-sm font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Recent Visits
          </h3>
          {recentVisits.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No visits recorded yet.</p>
          ) : (
            <div className="max-h-[200px] overflow-y-auto rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Patient</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Triage</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Payment</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentVisits.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3">{new Date(v.created_date).toLocaleDateString("en-GB")}</td>
                      <td className="py-2.5 px-3 font-mono text-xs">{v.patient_id?.slice(0, 8)}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{visitTypeLabel(v.visit_type)}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        {v.priority === "emergency" ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-triage-emergency/10 text-triage-emergency border border-triage-emergency/20">Emergency</span>
                        ) : v.priority === "urgent" ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-triage-urgent/10 text-triage-urgent border border-triage-urgent/20">Urgent</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Routine</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 capitalize text-xs">{v.payment_type}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          v.queue_status === "completed" ? "bg-chart-2/10 text-chart-2" :
                          v.queue_status === "waiting" ? "bg-chart-4/10 text-chart-4" :
                          "bg-muted text-muted-foreground"
                        }`}>{v.queue_status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Active Patient Journeys — Grouped by Stage */}
          <div>
            <h3 className="font-heading text-sm font-semibold mb-3 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" /> Active Journeys ({activeJourneys.length})
            </h3>
            {activeJourneys.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 bg-white rounded-lg border border-border px-4">No active patient journeys.</p>
            ) : (
              <div className="space-y-2">
                {sortedStageKeys.map(stage => {
                  const group = jornadaPorEtapa[stage];
                  const isExpanded = expandedStages[stage] !== false;
                  const breached = group.filter(j => {
                    const mins = getSlaMinutes(j);
                    return SLAS[stage] && mins > SLAS[stage];
                  }).length;
                  return (
                    <div key={stage} className="bg-white rounded-lg border border-border overflow-hidden">
                      <button
                        onClick={() => toggleStage(stage)}
                        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors border-l-[3px] ${STAGE_COLORS[stage] || "border-l-border"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{STAGE_LABELS[stage] || stage.replace(/_/g, " ")}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted/60 text-muted-foreground">{group.length}</span>
                          {breached > 0 && (
                            <span className="flex items-center gap-1 text-xs text-destructive font-medium">
                              <AlertTriangle className="w-3 h-3" /> {breached} overdue
                            </span>
                          )}
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      {isExpanded && (
                        <div className="divide-y divide-border/30">
                          {group.map(j => {
                            const mins = getSlaMinutes(j);
                            const slaMin = SLAS[stage];
                            const isBreached = slaMin && mins > slaMin;
                            const pct = slaMin ? Math.min(100, (mins / slaMin) * 100) : 0;
                            return (
                              <div key={j.id} className="px-4 py-2.5 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">
                                      {journeyPatients[j.patient_id] || j.patient_id?.slice(0, 8) || "Unknown"}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">{j.visit_id?.slice(0, 8)} · {j.assigned_to_role || "unassigned"}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right">
                                      <span className={`text-xs font-bold ${isBreached ? "text-destructive" : "text-muted-foreground"}`}>
                                        {mins}m
                                      </span>
                                      {slaMin && (
                                        <span className="text-[10px] text-muted-foreground"> / {slaMin}m</span>
                                      )}
                                    </div>
                                    {slaMin && (
                                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${isBreached ? "bg-destructive" : pct > 75 ? "bg-triage-semi" : "bg-primary"}`}
                                          style={{ width: `${Math.min(100, pct)}%` }}
                                        />
                                      </div>
                                    )}
                                    {isBreached && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions + Patient Reminders — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-lg border border-border p-5">
              <h3 className="font-heading text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Quick Actions
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Register New Patient", path: "/reception" },
                  { label: "Schedule Appointment", path: "/appointments" },
                  { label: "Start Consultation", path: "/clinical" },
                  { label: "View Lab Orders", path: "/lab" },
                  { label: "Pharmacy Inventory", path: "/pharmacy" },
                  { label: "Process Payment", path: "/billing" },
                ].map(action => (
                  <a key={action.label} href={action.path} className="block px-3 py-2 rounded border border-border hover:bg-muted/50 hover:border-primary/30 transition-all text-xs font-medium">
                    {action.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-5">
              <h3 className="font-heading text-sm font-semibold mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-chart-2" /> Patient Reminders
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Send appointment reminders for tomorrow's scheduled patients. Runs daily at 6am.
              </p>
              <button
                onClick={sendReminders}
                disabled={reminderSending}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-chart-2 text-white rounded-lg text-sm font-medium hover:bg-chart-2/90 disabled:opacity-50 shadow-sm"
              >
                {reminderSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {reminderSending ? "Sending..." : "Send Reminders Now"}
              </button>
              {reminderResult && !reminderResult.error && (
                <div className="mt-3 p-3 bg-chart-2/5 rounded-lg text-xs">
                  <p className="font-medium">Sent: {reminderResult.reminders_sent} of {reminderResult.total_appointments}</p>
                  <p className="text-muted-foreground mt-1">For {reminderResult.date} appointments</p>
                </div>
              )}
              {reminderResult?.error && (
                <div className="mt-3 p-3 bg-destructive/5 rounded-lg text-xs text-destructive">{reminderResult.error}</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
           {/* Live HIMS Pulse */}
           <LivePulse />

           {/* Notifications Panel */}
           {notifications.length > 0 && (
             <div className="bg-white rounded-lg border border-border p-5">
               <h3 className="font-heading text-sm font-semibold mb-3 flex items-center gap-2">
                 <Megaphone className="w-4 h-4 text-chart-2" /> Notifications ({notifications.length})
               </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className="p-2.5 border border-border/40 rounded-lg bg-muted/10 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                      {n.target_role && <span className="text-[10px] text-primary mt-0.5 inline-block">For: {n.target_role}</span>}
                    </div>
                    <button onClick={() => markNotifRead(n.id)} className="text-[10px] text-primary hover:underline shrink-0">Dismiss</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SLA Breach Alerts */}
          {(() => {
            const breached = activeJourneys.filter(j => {
              try {
                const history = j.stage_history ? JSON.parse(j.stage_history) : [];
                const lastEntry = history[history.length - 1];
                if (lastEntry && lastEntry.to === j.current_stage) {
                  const stageStart = new Date(lastEntry.timestamp);
                  const mins = (Date.now() - stageStart.getTime()) / 60000;
                  const SLAS = {RECEPTION:15,TRIAGE:20,CONSULTATION:45,LAB_PENDING:30,LAB_PROCESSING:60,IMAGING_PENDING:30,IMAGING_PROCESSING:60,PHARMACY_PENDING:30,PHARMACY_DISPENSING:45,NURSING_ADMINISTRATION:60,BILLING:30};
                  return SLAS[j.current_stage] ? mins > SLAS[j.current_stage] : false;
                }
              } catch(_){}
              return false;
            });
            if (breached.length === 0) return null;
            return (
              <div className="bg-clinical-critical/5 border border-clinical-critical/20 rounded-lg p-4">
                <h3 className="font-heading font-semibold text-sm mb-2 flex items-center gap-2 text-clinical-critical">
                  <AlertTriangle className="w-4 h-4" /> SLA Breaches ({breached.length})
                </h3>
                <div className="space-y-1.5">
                  {breached.map(b => (
                    <div key={b.id} className="text-xs text-destructive flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{b.current_stage?.replace(/_/g, " ")} — {b.assigned_to_role || "unassigned"}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {dailyReport?.visit_breakdown && Object.keys(dailyReport.visit_breakdown).length > 0 && (
            <div className="bg-white rounded-lg border border-border p-5">
              <h3 className="font-heading text-sm font-semibold mb-3">Visit Breakdown</h3>
              <div className="space-y-2">
                {Object.entries(dailyReport.visit_breakdown).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Batch Export Modal */}
      {batchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setBatchModal(false); setBatchResult(null); }} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-card rounded-2xl border border-border shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                <FileDown className="w-5 h-5 text-primary" /> Batch Export Reports
              </h3>
              <button onClick={() => { setBatchModal(false); setBatchResult(null); }} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!batchResult ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">Select reports to generate simultaneously:</p>
                <div className="space-y-2 mb-5">
                  {[
                    { id: "daily", label: "Daily Report", desc: "Visits, revenue, appointments summary" },
                    { id: "revenue", label: "Revenue Report", desc: "Detailed revenue by payment type & date" },
                    { id: "dhis2", label: "DHIS2 Export", desc: "Aggregate data for Ministry of Health" },
                    { id: "patients", label: "Patient List", desc: "Export all patient records as CSV" },
                    { id: "visits", label: "Visit List", desc: "Export today's visit records as CSV" },
                    { id: "reorder", label: "Reorder Requests", desc: "Low-stock drug reorder list" },
                    { id: "forecast", label: "Inventory Forecast", desc: "90-day consumption projections" },
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => toggleReport(r.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        batchReports.includes(r.id)
                          ? "border-primary/40 bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {batchReports.includes(r.id) ? (
                        <CheckSquare className="w-5 h-5 text-primary flex-shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={runBatchExport}
                  disabled={batchReports.length === 0 || batchExporting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 shadow-sm"
                >
                  {batchExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  {batchExporting ? "Generating..." : `Export ${batchReports.length} Report${batchReports.length !== 1 ? 's' : ''}`}
                </button>
              </>
            ) : (
              <>
                {batchResult.error ? (
                  <div className="p-4 bg-destructive/5 rounded-lg text-sm text-destructive mb-4">{batchResult.error}</div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      Generated {new Date(batchResult.generated_at).toLocaleTimeString("en-GB")}
                    </p>
                    <div className="space-y-2 mb-5 max-h-[300px] overflow-y-auto">
                      {Object.entries(batchResult.exports).map(([name, result]) => {
                        const hasData = result.data && Array.isArray(result.data) && result.data.length > 0;
                        return (
                        <div key={name} className={`p-3 rounded-lg border text-sm ${
                          result.status === "ok" ? "border-chart-3/20 bg-chart-3/5" :
                          result.status === "error" ? "border-destructive/20 bg-destructive/5" :
                          "border-border bg-muted/20"
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium capitalize">{name.replace(/_/g, " ")}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                result.status === "ok" ? "bg-chart-3/10 text-chart-3" : "bg-destructive/10 text-destructive"
                              }`}>{result.status}</span>
                              {hasData && (
                                <button
                                  onClick={() => {
                                    const headers = Object.keys(result.data[0]);
                                    const csv = [headers.join(','), ...result.data.map(row => headers.map(h => JSON.stringify(row[h] || '').replace(/"/g, '""')).join(','))].join('\n');
                                    const blob = new Blob([csv], { type: 'text/csv' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${name}_export_${new Date().toISOString().slice(0, 10)}.csv`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20"
                                >
                                  <Download className="w-3 h-3" /> CSV
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{result.summary}</p>
                        </div>
                      )})}
                    </div>
                  </>
                )}
                <button
                  onClick={() => { setBatchModal(false); setBatchResult(null); }}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}