import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, TrendingUp, Clock } from "lucide-react";

export default function DailyIntakeSummary() {
  const [stats, setStats] = useState({ total: 0, emergency: 0, outpatient: 0, inpatient: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIntake() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const todayStart = `${today}T00:00:00`;
        const visits = await base44.entities.Visit.filter(
          { created_date: { $gte: todayStart } },
          "-created_date",
          500
        );
        
        const stats = {
          total: visits.length,
          emergency: visits.filter(v => v.visit_type === "emergency").length,
          outpatient: visits.filter(v => v.visit_type === "outpatient").length,
          inpatient: visits.filter(v => v.visit_type === "inpatient").length,
        };
        setStats(stats);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchIntake();
  }, []);

  if (loading) return <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="stat-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="clinical-label">Total Intake</p>
            <p className="clinical-value text-primary">{stats.total}</p>
          </div>
          <Users className="w-8 h-8 text-primary/20" />
        </div>
      </div>
      <div className="stat-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="clinical-label">Emergency</p>
            <p className="clinical-value text-destructive">{stats.emergency}</p>
          </div>
          <TrendingUp className="w-8 h-8 text-destructive/20" />
        </div>
      </div>
      <div className="stat-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="clinical-label">Outpatient</p>
            <p className="clinical-value text-chart-2">{stats.outpatient}</p>
          </div>
          <Clock className="w-8 h-8 text-chart-2/20" />
        </div>
      </div>
      <div className="stat-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="clinical-label">Inpatient</p>
            <p className="clinical-value text-chart-4">{stats.inpatient}</p>
          </div>
          <Users className="w-8 h-8 text-chart-4/20" />
        </div>
      </div>
    </div>
  );
}