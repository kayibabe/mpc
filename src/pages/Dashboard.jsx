import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Calendar, FlaskConical, BedDouble, Pill, Receipt, TrendingUp, Clock, Activity, RefreshCw, FileText } from "lucide-react";
import InventoryAlerts from "@/components/InventoryAlerts";

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="stat-card flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ patients: 0, appointments: 0, labOrders: 0, occupiedBeds: 0, drugs: 0, revenue: 0 });
  const [recentVisits, setRecentVisits] = useState([]);
  const [dailyReport, setDailyReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshDailyReport = async () => {
    setReportLoading(true);
    try {
      const { data } = await base44.functions.invoke('generateDailyReport', {});
      setDailyReport(data);
    } catch (e) { /* silent */ }
    finally { setReportLoading(false); }
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
  }, []);

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
        <StatCard icon={Users} label="Registered Patients" value={stats.patients} color="bg-primary" />
        <StatCard icon={Calendar} label="Today's Appts" value={report?.total_appointments_today ?? stats.appointments} color="bg-chart-2" sub={report ? `${report.appointments_completed} completed` : null} />
        <StatCard icon={FlaskConical} label="Pending Lab Orders" value={report?.pending_lab_orders ?? stats.labOrders} color="bg-chart-3" />
        <StatCard icon={BedDouble} label="Occupied Beds" value={report?.active_inpatients ?? stats.occupiedBeds} color="bg-chart-4" />
        <StatCard icon={Pill} label="Drugs Low Stock" value={report?.drugs_low_stock ?? stats.drugs} color="bg-destructive" />
        <StatCard icon={Receipt} label="Revenue (MWK)" value={(report?.total_revenue_mwk ?? stats.revenue).toLocaleString()} color="bg-chart-5" />
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

      {dailyReport?.low_stock_drugs?.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 mb-8">
          <h3 className="font-heading font-semibold flex items-center gap-2 text-destructive mb-3">
            <FileText className="w-4 h-4" /> Low Stock Alerts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {dailyReport.low_stock_drugs.map((d, i) => (
              <div key={i} className="bg-card rounded-lg p-3 border border-border">
                <p className="text-sm font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  Stock: <span className="text-destructive font-medium">{d.stock}</span> / Reorder: {d.reorder_level}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
    </div>
  );
}