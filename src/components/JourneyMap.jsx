import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { GitBranch, AlertTriangle, Clock, Hash, ShieldAlert } from "lucide-react";

const ALL_STAGES = [
  "RECEPTION", "TRIAGE", "CONSULTATION",
  "LAB_PENDING", "LAB_PROCESSING", "IMAGING_PENDING", "IMAGING_PROCESSING",
  "PHARMACY_PENDING", "PHARMACY_DISPENSING", "NURSING_ADMINISTRATION", "BILLING",
];

const STAGE_LABELS = {
  RECEPTION: "Reception", TRIAGE: "Triage", CONSULTATION: "Doctor",
  LAB_PENDING: "Lab Wait", LAB_PROCESSING: "Lab", IMAGING_PENDING: "Imaging Wait",
  IMAGING_PROCESSING: "Imaging", PHARMACY_PENDING: "Rx Wait", PHARMACY_DISPENSING: "Pharmacy",
  NURSING_ADMINISTRATION: "Nursing", BILLING: "Billing",
};

const STAGE_HEADER_COLORS = {
  RECEPTION: "bg-primary text-primary-foreground",
  TRIAGE: "bg-triage-semi text-white",
  CONSULTATION: "bg-chart-1 text-white",
  LAB_PENDING: "bg-chart-3/80 text-white",
  LAB_PROCESSING: "bg-chart-3 text-white",
  IMAGING_PENDING: "bg-chart-4/80 text-white",
  IMAGING_PROCESSING: "bg-chart-4 text-white",
  PHARMACY_PENDING: "bg-chart-2/80 text-white",
  PHARMACY_DISPENSING: "bg-chart-2 text-white",
  NURSING_ADMINISTRATION: "bg-chart-1/80 text-white",
  BILLING: "bg-chart-5 text-white",
};

const SLA_THRESHOLDS = {
  RECEPTION: 15, TRIAGE: 20, CONSULTATION: 45,
  LAB_PENDING: 30, LAB_PROCESSING: 60, IMAGING_PENDING: 30,
  IMAGING_PROCESSING: 60, PHARMACY_PENDING: 30, PHARMACY_DISPENSING: 45,
  NURSING_ADMINISTRATION: 60, BILLING: 30,
};

export default function JourneyMap() {
  const [journeys, setJourneys] = useState([]);
  const [patients, setPatients] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const jList = await base44.entities.PatientJourney.filter(
          { status: "active" },
          "-created_date",
          100
        );
        setJourneys(jList);

        const pids = [...new Set(jList.map(j => j.patient_id).filter(Boolean))];
        const pMap = {};
        await Promise.all(pids.map(async (pid) => {
          try {
            const p = await base44.entities.Patient.get(pid);
            if (p) pMap[pid] = `${p.first_name} ${p.last_name}`;
          } catch (_) { pMap[pid] = pid?.slice(0, 8) || "Unknown"; }
        }));
        setPatients(pMap);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getMinutesInStage = (journey) => {
    try {
      const history = journey.stage_history ? JSON.parse(journey.stage_history) : [];
      const lastEntry = history[history.length - 1];
      if (lastEntry && lastEntry.to === journey.current_stage) {
        return Math.round((Date.now() - new Date(lastEntry.timestamp).getTime()) / 60000);
      }
    } catch (_) {}
    return Math.round((Date.now() - new Date(journey.created_date).getTime()) / 60000);
  };

  // Group journeys by stage
  const grouped = {};
  ALL_STAGES.forEach(stage => { grouped[stage] = []; });
  journeys.forEach(j => {
    const stage = j.current_stage;
    if (grouped[stage]) grouped[stage].push(j);
    else grouped[stage] = [j];
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const totalJourneys = journeys.length;
  const breachedCount = journeys.filter(j => {
    const mins = getMinutesInStage(j);
    return SLA_THRESHOLDS[j.current_stage] && mins > SLA_THRESHOLDS[j.current_stage];
  }).length;

  return (
    <div>
      {/* Header Stats */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
          <GitBranch className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{totalJourneys} Active Journeys</span>
        </div>
        {breachedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">{breachedCount} SLA Breached</span>
          </div>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {Object.keys(patients).length} patients loaded
        </span>
      </div>

      {/* Kanban Board — scrollable horizontally */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-[1400px]">
          {ALL_STAGES.map(stage => {
            const cards = grouped[stage] || [];
            if (cards.length === 0) return null;

            return (
              <div key={stage} className="flex-1 min-w-[200px] bg-muted/30 rounded-xl overflow-hidden flex flex-col">
                {/* Column Header */}
                <div className={`px-3 py-2.5 ${STAGE_HEADER_COLORS[stage] || "bg-muted"}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold">{STAGE_LABELS[stage] || stage}</h4>
                    <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white/20">
                      {cards.length}
                    </span>
                  </div>
                  {SLA_THRESHOLDS[stage] && (
                    <p className="text-[10px] opacity-70 mt-0.5">SLA: {SLA_THRESHOLDS[stage]} min</p>
                  )}
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
                  {cards.map(j => {
                    const mins = getMinutesInStage(j);
                    const slaMin = SLA_THRESHOLDS[stage];
                    const isBreached = slaMin && mins > slaMin;
                    const pct = slaMin ? Math.min(100, (mins / slaMin) * 100) : 0;

                    return (
                      <Link
                        key={j.id}
                        to="/clinical"
                        className={`block p-3 rounded-lg border text-left transition-all hover:shadow-md ${
                          isBreached
                            ? "bg-destructive/5 border-destructive/30 hover:border-destructive/50"
                            : "bg-card border-border hover:border-primary/30"
                        }`}
                      >
                        {/* Patient Name */}
                        <p className="text-sm font-semibold truncate">
                          {patients[j.patient_id] || j.patient_id?.slice(0, 8) || "Unknown"}
                        </p>

                        {/* Visit ID */}
                        <div className="flex items-center gap-1 mt-1">
                          <Hash className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {j.visit_id?.slice(0, 8) || "—"}
                          </span>
                        </div>

                        {/* Assigned Role */}
                        {j.assigned_to_role && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <ShieldAlert className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground capitalize">{j.assigned_to_role}</span>
                          </div>
                        )}

                        {/* Time in Stage */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                          <div className="flex items-center gap-1">
                            <Clock className={`w-3 h-3 ${isBreached ? "text-destructive" : "text-muted-foreground"}`} />
                            <span className={`text-[11px] font-bold ${isBreached ? "text-destructive" : "text-muted-foreground"}`}>
                              {mins}m
                            </span>
                            {slaMin && (
                              <span className="text-[10px] text-muted-foreground">/ {slaMin}m</span>
                            )}
                          </div>
                          {isBreached && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                        </div>

                        {/* SLA Bar */}
                        {slaMin && (
                          <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isBreached ? "bg-destructive" : pct > 75 ? "bg-triage-semi" : "bg-primary"
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {journeys.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center">
                <GitBranch className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No active patient journeys.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Journeys appear when patients check in.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-border text-xs text-muted-foreground">
        <span>Columns = current workflow stage</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/5 border border-destructive/30" /> SLA Breached</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-card border border-border" /> Within SLA</span>
        <span>Click any card → Clinical module</span>
      </div>
    </div>
  );
}