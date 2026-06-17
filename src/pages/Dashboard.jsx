import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Users, Calendar, FlaskConical, BedDouble, Pill, Receipt, TrendingUp, Clock, Activity, RefreshCw, Bell, Send, Loader2, GitBranch, Megaphone, ArrowRight, AlertTriangle, FileDown, CheckSquare, Square, X, FileText } from "lucide-react";
import PatientJourneyTimeline from "@/components/PatientJourneyTimeline";
import InventoryAlerts from "@/components/InventoryAlerts";
import LivePulse from "@/components/LivePulse";
import RealTimeVitals from "@/components/RealTimeVitals";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const CHART_COLORS = ["hsl(194, 65%, 42%)", "hsl(38, 92%, 50%)", "hsl(160, 60%, 40%)", "hsl(280, 50%, 50%)", "hsl(340, 65%, 50%)", "hsl(0, 72%, 51%)"];

function StatCard({ icon: Icon, label, value, sub, color, to }) {
  const content = (
    <div className="stat-card flex items-start gap-4 group cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{label}</p>
        <p className="text-2xl font-bold tracking-tight mt-0.5 font-mono tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-all flex-shrink-0" />
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
  const [notifications, setNotifications] = useState([]);
  const [batchModal, setBatchModal] = useState(false);
  const [batchReports, setBatchReports] = useState([]);
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

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
        base44.entities.PatientJourney.filter({ status: "active" }, "-created_date", 20),
        base44.entities.Notification.filter({ is_read: false }, "-created_date", 10),
      ]);
      setActiveJourneys(journeys);
      setNotifications(notifs);
    } catch (e) { /* silent */ }
  };

  const markNotifRead = async (id) => {
    await base44.entities.Notification.update(id, { is_read: true });
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const visitTypeLabel = (t) => ({ outpatient: "OPD", inpatient: "IPD", emergency: "ER", anc: "ANC", postnatal: "PNC", procedure: "PROC" }[t] || t);

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const report = dailyReport?.summary;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Zomba City Private Clinic — Today's Overview</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBatchModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5" /> Batch Export
          </button>
          <button
            onClick={refreshDailyReport}
            disabled={reportLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reportLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
      </div>

      <InventoryAlerts />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard icon={Users} label="Registered Patients" value={stats.patients} color="bg-primary" to="/reception" />
        <StatCard icon={Calendar} label="Today's Appts" value={report?.total_appointments_today ?? stats.appointments} color="bg-triage-semi" sub={report ? `${report.appointments_completed} completed` : null} to="/appointments" />
        <StatCard icon={FlaskConical} label="Pending Lab Orders" value={report?.pending_lab_orders ?? stats.labOrders} color="bg-chart-3" to="/lab" />
        <StatCard icon={BedDouble} label="Occupied Beds" value={report?.active_inpatients ?? stats.occupiedBeds} color="bg-chart-4" to="/inpatient" />
        <StatCard icon={Pill} label="Drugs Low Stock" value={report?.drugs_low_stock ?? stats.drugs} color="bg-destructive" to="/pharmacy" />
        <StatCard icon={Receipt} label="Revenue (MWK)" value={(report?.total_revenue_mwk ?? stats.revenue).toLocaleString()} color="bg-chart-5" to="/billing" />
      </div>

      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          {report.total_visits_today !== undefined && (
            <div className="bg-card rounded-lg border border-border/60 p-3 text-center">
              <p className="text-2xl font-bold">{report.total_visits_today}</p>
              <p className="text-xs text-muted-foreground">Today's Visits</p>
            </div>
          )}
          {report.appointments_completed !== undefined && (
            <div className="bg-card rounded-lg border border-border/60 p-3 text-center">
              <p className="text-2xl font-bold text-chart-3">{report.appointments_completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          )}
          {report.appointments_no_show !== undefined && (
            <div className="bg-card rounded-lg border border-border/60 p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{report.appointments_no_show}</p>
              <p className="text-xs text-muted-foreground">No-shows</p>
            </div>
          )}
          {report.active_inpatients !== undefined && (
            <div className="bg-card rounded-lg border border-border/60 p-3 text-center">
              <p className="text-2xl font-bold text-chart-4">{report.active_inpatients}</p>
              <p className="text-xs text-muted-foreground">Inpatients</p>
            </div>
          )}
          {report.pending_lab_orders !== undefined && (
            <div className="bg-card rounded-lg border border-border/60 p-3 text-center">
              <p className="text-2xl font-bold text-chart-1">{report.pending_lab_orders}</p>
              <p className="text-xs text-muted-foreground">Pending Labs</p>
            </div>
          )}
          {report.drugs_low_stock !== undefined && (
            <div className="bg-card rounded-lg border border-border/60 p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{report.drugs_low_stock}</p>
              <p className="text-xs text-muted-foreground">Low Stock</p>
            </div>
          )}
        </div>
      )}



      {/* Occupancy Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <h3 className="font-heading text-lg font-semibold mb-4">Bed Occupancy by Ward</h3>
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

        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <h3 className="font-heading text-lg font-semibold mb-4">Current Queue Status</h3>
          {Object.keys(occupancyData.queueSummary).length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={Object.entries(occupancyData.queueSummary).map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} label={({ name, value }) => `${name}: ${value}`}>
                  {Object.keys(occupancyData.queueSummary).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">Queue is clear</p>
          )}
        </div>
      </div>

      <RealTimeVitals />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Recent Visits
          </h3>
          {recentVisits.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No visits recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Patient ID</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Payment</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisits.map((v) => (
                    <tr key={v.id} className="border-b border-border/40 hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3">{new Date(v.created_date).toLocaleDateString("en-GB")}</td>
                      <td className="py-2.5 px-3 font-mono text-xs">{v.patient_id?.slice(0, 8)}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{visitTypeLabel(v.visit_type)}</span>
                      </td>
                      <td className="py-2.5 px-3 capitalize">{v.payment_type}</td>
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
        </div>

        <div className="space-y-4">
          {/* Live HIMS Pulse */}
          <LivePulse />

          {/* Notifications Panel */}
          {notifications.length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h3 className="font-heading text-lg font-semibold mb-3 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-chart-2" /> Notifications ({notifications.length})
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

          {/* Active Patient Journeys */}
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
            <h3 className="font-heading text-lg font-semibold mb-3 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-primary" /> Active Journeys ({activeJourneys.length})
            </h3>
            {activeJourneys.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No active patient journeys.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {activeJourneys.slice(0, 5).map(j => {
                  // Calculate SLA status
                  let slaBreached = false;
                  let minutesInStage = 0;
                  try {
                    const history = j.stage_history ? JSON.parse(j.stage_history) : [];
                    const lastEntry = history[history.length - 1];
                    if (lastEntry && lastEntry.to === j.current_stage) {
                      const stageStart = new Date(lastEntry.timestamp);
                      minutesInStage = (Date.now() - stageStart.getTime()) / 60000;
                      const SLAS = {RECEPTION:15,TRIAGE:20,CONSULTATION:45,LAB_PENDING:30,LAB_PROCESSING:60,IMAGING_PENDING:30,IMAGING_PROCESSING:60,PHARMACY_PENDING:30,PHARMACY_DISPENSING:45,NURSING_ADMINISTRATION:60,BILLING:30};
                      slaBreached = SLAS[j.current_stage] ? minutesInStage > SLAS[j.current_stage] : false;
                    }
                  } catch(_){}
                  return (
                    <div key={j.id} className={`flex items-center justify-between p-2.5 border rounded-lg ${slaBreached ? "border-destructive/30 bg-destructive/5" : "border-border/40 bg-muted/10"}`}>
                      <div className="min-w-0 flex-1">
                        <PatientJourneyTimeline journeyId={j.id} compact />
                      </div>
                    </div>
                  );
                })}
                {activeJourneys.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+{activeJourneys.length - 5} more active</p>
                )}
              </div>
            )}
          </div>

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
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 shadow-sm">
                <h3 className="font-heading font-semibold text-sm mb-2 flex items-center gap-2 text-destructive">
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

          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
            <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Quick Actions
            </h3>
            <div className="space-y-2">
              {[
                { label: "Register New Patient", path: "/reception" },
                { label: "Schedule Appointment", path: "/appointments" },
                { label: "Start Consultation", path: "/clinical" },
                { label: "View Lab Orders", path: "/lab" },
                { label: "Pharmacy Inventory", path: "/pharmacy" },
                { label: "Process Payment", path: "/billing" },
              ].map((action) => (
                <a key={action.label} href={action.path} className="block px-4 py-3 rounded-lg border border-border hover:bg-muted hover:border-primary/30 transition-all text-sm font-medium">
                  {action.label}
                </a>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
            <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-chart-2" /> Patient Reminders
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Send appointment reminders for tomorrow's scheduled patients via email. Automatically runs daily at 6am.
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

          {dailyReport?.visit_breakdown && Object.keys(dailyReport.visit_breakdown).length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h3 className="font-heading text-lg font-semibold mb-3">Visit Breakdown</h3>
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
                      {Object.entries(batchResult.exports).map(([name, result]) => (
                        <div key={name} className={`p-3 rounded-lg border text-sm ${
                          result.status === "ok" ? "border-chart-3/20 bg-chart-3/5" :
                          result.status === "error" ? "border-destructive/20 bg-destructive/5" :
                          "border-border bg-muted/20"
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium capitalize">{name.replace(/_/g, " ")}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              result.status === "ok" ? "bg-chart-3/10 text-chart-3" : "bg-destructive/10 text-destructive"
                            }`}>{result.status}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{result.summary}</p>
                        </div>
                      ))}
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