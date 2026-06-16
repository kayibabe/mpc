import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Circle, Clock, ChevronRight, GitBranch } from "lucide-react";

const ALL_STAGES = [
  "RECEPTION",
  "TRIAGE",
  "CONSULTATION",
  "LAB_PENDING",
  "LAB_PROCESSING",
  "IMAGING_PENDING",
  "IMAGING_PROCESSING",
  "PHARMACY_PENDING",
  "PHARMACY_DISPENSING",
  "NURSING_ADMINISTRATION",
  "BILLING",
  "COMPLETED",
];

const STAGE_LABELS = {
  RECEPTION: "Reception",
  TRIAGE: "Triage",
  CONSULTATION: "Doctor",
  LAB_PENDING: "Lab Wait",
  LAB_PROCESSING: "Lab",
  IMAGING_PENDING: "Imaging Wait",
  IMAGING_PROCESSING: "Imaging",
  PHARMACY_PENDING: "Pharmacy Wait",
  PHARMACY_DISPENSING: "Pharmacy",
  NURSING_ADMINISTRATION: "Nursing",
  BILLING: "Billing",
  COMPLETED: "Done",
};

// SLA thresholds in minutes
const SLA_THRESHOLDS = {
  RECEPTION: 15,
  TRIAGE: 20,
  CONSULTATION: 45,
  LAB_PENDING: 30,
  LAB_PROCESSING: 60,
  IMAGING_PENDING: 30,
  IMAGING_PROCESSING: 60,
  PHARMACY_PENDING: 30,
  PHARMACY_DISPENSING: 45,
  NURSING_ADMINISTRATION: 60,
  BILLING: 30,
};

export default function PatientJourneyTimeline({ journeyId, patientId, compact = false }) {
  const [journey, setJourney] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        if (journeyId) {
          const j = await base44.entities.PatientJourney.get(journeyId);
          setJourney(j);
        } else if (patientId) {
          const journeys = await base44.entities.PatientJourney.filter(
            { patient_id: patientId, status: "active" },
            "-created_date",
            1
          );
          setJourney(journeys[0] || null);
        }
      } catch (e) {
        /* silent */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [journeyId, patientId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" />
        Loading journey...
      </div>
    );
  }

  if (!journey) return null;

  const currentIndex = ALL_STAGES.indexOf(journey.current_stage);
  const history = journey.stage_history ? JSON.parse(journey.stage_history) : [];
  const visitedStages = new Set(history.map((h) => h.to));

  // Find current stage timestamp to calculate SLA
  const lastTransition = history[history.length - 1];
  const stageStartTime = lastTransition ? new Date(lastTransition.timestamp) : new Date(journey.created_date);
  const minutesInStage = (Date.now() - stageStartTime.getTime()) / 60000;
  const slaMinutes = SLA_THRESHOLDS[journey.current_stage];
  const slaPercent = slaMinutes ? Math.min(100, (minutesInStage / slaMinutes) * 100) : 0;
  const slaBreached = slaMinutes ? minutesInStage > slaMinutes : false;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <GitBranch className="w-3 h-3 text-primary" />
        {ALL_STAGES.slice(
          Math.max(0, currentIndex - 1),
          Math.min(ALL_STAGES.length, currentIndex + 3)
        ).map((stage, i) => {
          const isCurrent = stage === journey.current_stage;
          const isPast = visitedStages.has(stage) && ALL_STAGES.indexOf(stage) < currentIndex;
          return (
            <span key={stage} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40" />}
              <span
                className={`px-1.5 py-0.5 rounded-full font-medium ${
                  isCurrent
                    ? slaBreached
                      ? "bg-triage-emergency/10 text-triage-emergency"
                      : "bg-primary/10 text-primary"
                    : isPast
                    ? "bg-clinical-normal/10 text-clinical-normal"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {STAGE_LABELS[stage]}
              </span>
            </span>
          );
        })}
        {slaBreached && (
          <span className="text-triage-emergency font-bold" title={`${Math.round(minutesInStage)}min / ${slaMinutes}min SLA`}>
            ⚠
          </span>
        )}
        {!slaBreached && slaMinutes && (
          <span className="text-muted-foreground text-[10px]">
            {Math.round(minutesInStage)}m
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm">
      <h4 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-primary" /> Patient Journey
      </h4>

      {/* SLA Progress Bar */}
      {slaMinutes && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">
              {STAGE_LABELS[journey.current_stage]} — {Math.round(minutesInStage)}m / {slaMinutes}m
            </span>
            <span className={slaBreached ? "text-triage-emergency font-semibold" : "text-muted-foreground"}>
              {slaBreached ? "⚠ Breached" : `${Math.round(slaPercent)}%`}
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                slaBreached ? "bg-triage-emergency" : slaPercent > 75 ? "bg-triage-semi" : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, slaPercent)}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1">
        {ALL_STAGES.map((stage, idx) => {
          const isCurrent = stage === journey.current_stage;
          const isPast = visitedStages.has(stage) && idx < currentIndex;
          const isFuture = idx > currentIndex;

          return (
            <div key={stage} className="flex items-center gap-2.5 text-xs">
              <div className="flex-shrink-0">
                {isCurrent ? (
                  <Clock className={`w-3.5 h-3.5 ${slaBreached ? "text-triage-emergency animate-pulse" : "text-primary"}`} />
                ) : isPast ? (
                  <CheckCircle className="w-3.5 h-3.5 text-clinical-normal" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground/30" />
                )}
              </div>
              <span
                className={`${
                  isCurrent
                    ? "font-semibold text-foreground"
                    : isPast
                    ? "text-foreground/70"
                    : "text-muted-foreground/50"
                }`}
              >
                {STAGE_LABELS[stage]}
              </span>
              {isCurrent && slaBreached && (
                <span className="text-triage-emergency font-bold text-[10px] ml-auto">SLA BREACH</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}