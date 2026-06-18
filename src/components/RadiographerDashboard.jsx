import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Scan, Clock, CheckCircle2, AlertTriangle, FileText } from "lucide-react";

export default function RadiographerDashboard() {
  const [stats, setStats] = useState({ ordersToday: 0, completed: 0, pending: 0, urgent: 0, avgTurnaround: 0 });
  const [recentStudies, setRecentStudies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [orders, results] = await Promise.all([
          base44.entities.ImagingOrder.filter({ order_date: { $gte: today } }, "-created_date", 100),
          base44.entities.ImagingResult.filter({ created_date: { $gte: today } }, "-created_date", 50),
        ]);

        const completed = orders.filter(o => o.status === "completed" || o.status === "reported");
        const pending = orders.filter(o => o.status === "ordered" || o.status === "scheduled" || o.status === "in_progress");
        const urgent = orders.filter(o => o.priority === "urgent" || o.priority === "stat");

        // Calculate average turnaround time in minutes
        const turnaroundTimes = completed
          .map(o => {
            const orderTime = new Date(o.order_date);
            const completeTime = results.find(r => r.imaging_order_id === o.id)?.created_date;
            if (completeTime) {
              return (new Date(completeTime) - orderTime) / 60000;
            }
            return null;
          })
          .filter(t => t !== null);
        
        const avgTurnaround = turnaroundTimes.length > 0 
          ? Math.round(turnaroundTimes.reduce((a, b) => a + b) / turnaroundTimes.length)
          : 0;

        setStats({
          ordersToday: orders.length,
          completed: completed.length,
          pending: pending.length,
          urgent: urgent.length,
          avgTurnaround,
        });
        setRecentStudies(orders.slice(0, 6));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Imaging Workload</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Orders</p>
                <p className="text-2xl font-bold">{stats.ordersToday}</p>
              </div>
              <Scan className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-chart-3">{stats.completed}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-chart-3" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-chart-2">{stats.pending}</p>
              </div>
              <Clock className="w-5 h-5 text-chart-2" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Urgent</p>
                <p className="text-2xl font-bold text-destructive">{stats.urgent}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Turnaround</p>
                <p className="text-2xl font-bold">{stats.avgTurnaround}m</p>
              </div>
              <FileText className="w-5 h-5 text-chart-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="font-semibold text-sm mb-4">Today's Studies</h3>
        {recentStudies.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No imaging orders today</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-muted-foreground"><th className="text-left py-2">Study Type</th><th className="text-left py-2">Body Part</th><th className="text-left py-2">Priority</th><th className="text-left py-2">Status</th></tr></thead>
              <tbody>
                {recentStudies.map(s => (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2 font-medium capitalize">{s.study_type?.replace(/_/g, " ")}</td>
                    <td className="py-2 text-muted-foreground">{s.body_part || "—"}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        s.priority === "stat" || s.priority === "urgent" ? "bg-destructive/10 text-destructive" :
                        "bg-muted/60 text-muted-foreground"
                      }`}>{s.priority || "routine"}</span>
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        s.status === "completed" || s.status === "reported" ? "bg-chart-3/10 text-chart-3" :
                        s.status === "in_progress" ? "bg-primary/10 text-primary" :
                        "bg-muted/60 text-muted-foreground"
                      }`}>{s.status?.replace(/_/g, " ")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}