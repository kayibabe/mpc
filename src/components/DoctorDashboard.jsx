import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FlaskConical, AlertTriangle, Stethoscope, CheckCircle2 } from "lucide-react";

export default function DoctorDashboard() {
  const [stats, setStats] = useState({ todayConsultations: 0, pendingLabs: 0, prescriptions: 0, alerts: 0 });
  const [recentConsultations, setRecentConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const user = await base44.auth.me();
        const [consultations, labs, prescriptions] = await Promise.all([
          base44.entities.Consultation.filter(
            { doctor_id: user.id, status: { $in: ["in_progress", "completed"] } },
            "-created_date",
            50
          ),
          base44.entities.LabOrder.filter({ status: { $in: ["ordered", "in_progress"] } }, "-created_date", 50),
          base44.entities.Prescription.filter({ status: { $in: ["draft", "pending"] } }, "-created_date", 30),
        ]);
        
        const today = new Date().toISOString().slice(0, 10);
        const todayConsults = consultations.filter(c => c.consultation_date?.startsWith(today));
        
        setStats({
          todayConsultations: todayConsults.length,
          pendingLabs: labs.length,
          prescriptions: prescriptions.length,
          alerts: labs.filter(l => l.priority === "urgent" || l.priority === "stat").length,
        });
        setRecentConsultations(todayConsults.slice(0, 5));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Clinical Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Consultations</p>
                <p className="text-2xl font-bold">{stats.todayConsultations}</p>
              </div>
              <Stethoscope className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Labs</p>
                <p className="text-2xl font-bold">{stats.pendingLabs}</p>
              </div>
              <FlaskConical className="w-5 h-5 text-chart-1" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Prescriptions</p>
                <p className="text-2xl font-bold">{stats.prescriptions}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-chart-3" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Urgent Labs</p>
                <p className="text-2xl font-bold text-destructive">{stats.alerts}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border p-5">
        <h3 className="font-semibold text-sm mb-4">Today's Consultations</h3>
        {recentConsultations.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No consultations scheduled</p>
        ) : (
          <div className="space-y-2">
            {recentConsultations.map(c => (
              <div key={c.id} className="flex items-start justify-between p-2.5 bg-muted/20 rounded border border-border/40">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{c.patient_id?.slice(0, 8)}</p>
                  <p className="text-[11px] text-muted-foreground">{c.chief_complaint}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ml-2 ${
                  c.status === "completed" ? "bg-chart-3/10 text-chart-3" : "bg-primary/10 text-primary"
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}