import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { FileBarChart, Download, Loader2, Users, FlaskConical, BedDouble, Baby, TrendingUp, Calendar, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import PageHeader from "@/components/ui/PageHeader";

const COLORS = ["hsl(194, 65%, 42%)", "hsl(38, 92%, 50%)", "hsl(160, 60%, 40%)", "hsl(280, 50%, 50%)", "hsl(340, 65%, 50%)"];

export default function MoHReports() {
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    loadExports();
  }, []);

  const loadExports = async () => {
    try {
      const e = await base44.entities.DHIS2Export.list("-created_date", 20);
      setExports(e);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const generateReport = async () => {
    setExporting(true);
    try {
      const { data } = await base44.functions.invoke("generateDHIS2Report", {
        period: currentMonth,
        report_type: "aggregate_monthly",
      });
      setReportData(data.data || data);
      loadExports();
    } catch (err) {
      toast({ title: "Export failed", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const loadFromExport = (exp) => {
    try {
      const parsed = typeof exp.data === "string" ? JSON.parse(exp.data) : exp.data;
      setReportData(parsed);
    } catch {
      setReportData(null);
    }
  };

  const downloadExport = (exp, format = 'json') => {
    try {
      const data = typeof exp.data === "string" ? JSON.parse(exp.data) : exp.data;
      let content, filename, type;

      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        filename = `dhis2_export_${exp.period}.json`;
        type = 'application/json';
      } else if (format === 'csv') {
        // Flatten aggregates to CSV
        const rows = [
          ['Facility', 'Period', 'Report Type', 'Metric', 'Value'],
          [data.facility?.name || 'Zomba City Private Clinic', exp.period, exp.report_type, 'Total Visits', data.aggregates?.total_visits || 0],
          ['', '', '', 'OPD Visits', data.aggregates?.opd_visits || 0],
          ['', '', '', 'Emergency Visits', data.aggregates?.emergency_visits || 0],
          ['', '', '', 'Inpatient Admissions', data.aggregates?.inpatient_admissions || 0],
          ['', '', '', 'Lab Tests', data.aggregates?.total_lab_tests || 0],
          ['', '', '', 'Deliveries', data.maternal_child_health?.deliveries || 0],
          ['', '', '', 'Live Births', data.maternal_child_health?.live_births || 0],
          ['', '', '', 'Neonatal Deaths', data.maternal_child_health?.neonatal_deaths || 0],
          ['', '', '', 'Maternal Deaths', data.maternal_child_health?.maternal_deaths || 0],
        ];

        // Add KPIs
        if (data.kpis) {
          Object.entries(data.kpis).forEach(([key, value]) => {
            rows.push(['', '', '', key.replace(/_/g, ' '), value]);
          });
        }

        content = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        filename = `dhis2_export_${exp.period}.csv`;
        type = 'text/csv';
      }

      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    }
  };

  const aggregates = reportData?.aggregates || {};

  const aggChartData = [
    { name: "OPD", value: aggregates.opd_visits || 0 },
    { name: "ER", value: aggregates.emergency_visits || 0 },
    { name: "IPD", value: aggregates.inpatient_admissions || 0 },
    { name: "ANC", value: aggregates.anc_first_visits || 0 },
    { name: "Deliveries", value: aggregates.deliveries || 0 },
  ];

  const maternalData = [
    { name: "Deliveries", value: aggregates.deliveries || 0 },
    { name: "Live Births", value: aggregates.live_births || 0 },
    { name: "Still Births", value: aggregates.still_births || 0 },
    { name: "Neonatal Deaths", value: aggregates.neonatal_deaths || 0 },
    { name: "Postnatal", value: aggregates.postnatal_visits || 0 },
  ];

  const pieData = [
    { name: "OPD", value: aggregates.opd_visits || 0 },
    { name: "ER", value: aggregates.emergency_visits || 0 },
    { name: "IPD", value: aggregates.inpatient_admissions || 0 },
    { name: "ANC", value: aggregates.anc_first_visits || 0 },
    { name: "Other", value: Math.max(0, (aggregates.total_visits || 0) - (aggregates.opd_visits || 0) - (aggregates.emergency_visits || 0) - (aggregates.inpatient_admissions || 0) - (aggregates.anc_first_visits || 0)) },
  ].filter(d => d.value > 0);

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container">
      <PageHeader title="MoH & DHIS2 Reporting" subtitle="Ministry of Health aggregate data and export history" icon={FileBarChart} className="mb-6">
        <input
          type="month"
          value={currentMonth}
          onChange={e => setCurrentMonth(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={generateReport}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Generating..." : "Generate Report"}
        </button>
      </PageHeader>

      {reportData ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[
              { label: "Total Visits", value: aggregates.total_visits || 0, icon: Users, color: "bg-primary" },
              { label: "OPD", value: aggregates.opd_visits || 0, icon: Activity, color: "bg-chart-1" },
              { label: "Inpatient", value: aggregates.inpatient_admissions || 0, icon: BedDouble, color: "bg-chart-4" },
              { label: "Lab Tests", value: aggregates.total_lab_tests || 0, icon: FlaskConical, color: "bg-chart-3" },
              { label: "Deliveries", value: aggregates.deliveries || 0, icon: Baby, color: "bg-chart-5" },
              { label: "ANC 1st Visit", value: aggregates.anc_first_visits || 0, icon: TrendingUp, color: "bg-chart-2" },
            ].map(stat => (
              <div key={stat.label} className="stat-card text-center py-4">
                <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center mx-auto mb-2`}>
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h3 className="font-heading font-semibold mb-4 text-sm">Visit Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={aggChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {aggChartData.map((_, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h3 className="font-heading font-semibold mb-4 text-sm">Case Mix</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-12 text-center">No data to display</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {maternalData.some(d => d.value > 0) && (
              <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
                <h3 className="font-heading font-semibold mb-4 text-sm flex items-center gap-2"><Baby className="w-4 h-4 text-chart-5" /> Maternal & Neonatal Indicators</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={maternalData.filter(d => d.value > 0)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(340, 65%, 50%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {reportData?.disease_counts && Object.keys(reportData.disease_counts).length > 0 && (
              <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
                <h3 className="font-heading font-semibold mb-4 text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-destructive" /> Disease Burden</h3>
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {Object.entries(reportData.disease_counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between py-1.5 px-3 bg-muted/30 rounded-lg text-sm">
                      <span className="truncate">{name}</span>
                      <span className="font-semibold ml-2">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
            <h3 className="font-heading font-semibold mb-4 text-sm flex items-center gap-2"><FileBarChart className="w-4 h-4 text-primary" /> Report Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><span className="text-muted-foreground">Facility:</span> <span className="font-medium">{reportData.facility}</span></div>
              <div><span className="text-muted-foreground">Period:</span> <span className="font-medium">{reportData.period}</span></div>
              <div><span className="text-muted-foreground">Generated:</span> <span className="font-medium">{new Date(reportData.generated_date).toLocaleDateString("en-GB", { dateStyle: "long" })}</span></div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm text-center py-16">
          <FileBarChart className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">No report generated yet</p>
          <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
            Generate a DHIS2-compatible aggregate report for the Ministry of Health. Select a month above and click "Generate Report".
          </p>
        </div>
      )}

      <div className="mt-8">
        <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" /> Recent Exports
        </h3>
        <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/30"><th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th><th className="text-left py-3 px-4 font-medium text-muted-foreground">Period</th><th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th><th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th><th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th></tr></thead>
              <tbody>
                {exports.map(e => (
                  <tr key={e.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-3 px-4">{new Date(e.export_date).toLocaleDateString("en-GB")}</td>
                    <td className="py-3 px-4 font-medium">{e.period}</td>
                    <td className="py-3 px-4 capitalize">{e.report_type?.replace(/_/g, " ")}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.status === "generated" || e.status === "submitted" ? "bg-chart-3/10 text-chart-3" :
                        e.status === "confirmed" ? "bg-chart-2/10 text-chart-2" :
                        e.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                      }`}>{e.status}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => loadFromExport(e)} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20">View</button>
                        <button onClick={() => downloadExport(e, 'json')} className="px-2 py-1 bg-chart-3/10 text-chart-3 rounded text-xs font-medium hover:bg-chart-3/20" title="Download JSON">JSON</button>
                        <button onClick={() => downloadExport(e, 'csv')} className="px-2 py-1 bg-chart-2/10 text-chart-2 rounded text-xs font-medium hover:bg-chart-2/20" title="Download CSV">CSV</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {exports.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No exports yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}