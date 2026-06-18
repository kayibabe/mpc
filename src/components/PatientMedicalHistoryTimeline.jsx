import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ChevronDown, ChevronUp, Stethoscope, FlaskConical, Heart, Pill, Scan, AlertCircle } from "lucide-react";

export default function PatientMedicalHistoryTimeline({ patientId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedVisit, setExpandedVisit] = useState(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const [visits, consultations, labResults, imagingResults, vitals, prescriptions] = await Promise.all([
          base44.entities.Visit.filter({ patient_id: patientId }, "-visit_date", 100),
          base44.entities.Consultation.filter({ patient_id: patientId }, "-consultation_date", 100),
          base44.entities.LabResult.filter({ patient_id: patientId }, "-created_date", 200),
          base44.entities.ImagingResult.filter({ patient_id: patientId }, "-created_date", 100),
          base44.entities.VitalSigns.filter({ patient_id: patientId }, "-recorded_date", 200),
          base44.entities.Prescription.filter({ patient_id: patientId }, "-prescription_date", 100),
        ]);

        // Aggregate all events with timestamps
        const allEvents = [];

        // Add visits
        visits.forEach(v => {
          allEvents.push({
            type: "visit",
            timestamp: new Date(v.visit_date),
            data: v,
            visit_id: v.id,
            visit_date: v.visit_date,
          });
        });

        // Add consultations
        consultations.forEach(c => {
          allEvents.push({
            type: "consultation",
            timestamp: new Date(c.consultation_date),
            data: c,
            visit_id: c.visit_id,
            visit_date: c.consultation_date,
          });
        });

        // Add lab results
        labResults.forEach(l => {
          allEvents.push({
            type: "lab",
            timestamp: new Date(l.created_date),
            data: l,
            visit_id: l.lab_order_id,
            visit_date: l.created_date,
          });
        });

        // Add imaging results
        imagingResults.forEach(i => {
          allEvents.push({
            type: "imaging",
            timestamp: new Date(i.created_date),
            data: i,
            visit_id: i.imaging_order_id,
            visit_date: i.created_date,
          });
        });

        // Add vitals
        vitals.forEach(v => {
          allEvents.push({
            type: "vitals",
            timestamp: new Date(v.recorded_date),
            data: v,
            visit_id: v.visit_id,
            visit_date: v.recorded_date,
          });
        });

        // Add prescriptions
        prescriptions.forEach(p => {
          allEvents.push({
            type: "prescription",
            timestamp: new Date(p.prescription_date),
            data: p,
            visit_id: p.visit_id,
            visit_date: p.prescription_date,
          });
        });

        // Sort by timestamp (newest first)
        allEvents.sort((a, b) => b.timestamp - a.timestamp);

        setEvents(allEvents);
      } catch (err) {
        console.error("Error loading patient history:", err);
      } finally {
        setLoading(false);
      }
    }

    if (patientId) fetchHistory();
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Group events by month
  const groupedEvents = {};
  events.forEach((event) => {
    const monthKey = new Date(event.timestamp).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
    });
    if (!groupedEvents[monthKey]) groupedEvents[monthKey] = [];
    groupedEvents[monthKey].push(event);
  });

  const monthOrder = Object.keys(groupedEvents).sort(
    (a, b) => new Date(b) - new Date(a)
  );

  return (
    <div className="space-y-6 py-4">
      {monthOrder.map((month) => (
        <div key={month}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            {month}
          </h3>
          <div className="space-y-2">
            {groupedEvents[month].map((event, idx) => (
              <TimelineEvent
                key={`${event.type}-${event.data.id}-${idx}`}
                event={event}
                isExpanded={expandedVisit === event.data.id}
                onToggle={() =>
                  setExpandedVisit(
                    expandedVisit === event.data.id ? null : event.data.id
                  )
                }
              />
            ))}
          </div>
        </div>
      ))}

      {events.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">No medical history available.</p>
        </div>
      )}
    </div>
  );
}

function TimelineEvent({ event, isExpanded, onToggle }) {
  const iconMap = {
    visit: <Stethoscope className="w-4 h-4" />,
    consultation: <Stethoscope className="w-4 h-4" />,
    lab: <FlaskConical className="w-4 h-4" />,
    imaging: <Scan className="w-4 h-4" />,
    vitals: <Heart className="w-4 h-4" />,
    prescription: <Pill className="w-4 h-4" />,
  };

  const colorMap = {
    visit: "border-primary",
    consultation: "border-primary",
    lab: "border-chart-1",
    imaging: "border-chart-2",
    vitals: "border-chart-3",
    prescription: "border-chart-5",
  };

  const bgColorMap = {
    visit: "bg-primary/10",
    consultation: "bg-primary/10",
    lab: "bg-chart-1/10",
    imaging: "bg-chart-2/10",
    vitals: "bg-chart-3/10",
    prescription: "bg-chart-5/10",
  };

  const getEventSummary = () => {
    const { type, data } = event;
    switch (type) {
      case "visit":
        return `${data.visit_type} - ${data.department || "General"}`;
      case "consultation":
        return data.chief_complaint || "Clinical Consultation";
      case "lab":
        return `Lab: ${data.test_name}`;
      case "imaging":
        return `${data.study_type} - ${data.body_part || ""}`.trim();
      case "vitals":
        return `Vital Signs Recorded`;
      case "prescription":
        return `Prescription`;
      default:
        return "Medical Event";
    }
  };

  const getEventTime = () => {
    return new Date(event.timestamp).toLocaleDateString("en-GB", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left p-3 rounded-lg border transition-all ${colorMap[event.type]} ${isExpanded ? `${bgColorMap[event.type]} border-2` : "border bg-card hover:border-opacity-50"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-2 rounded-full ${bgColorMap[event.type]} text-foreground`}>
          {iconMap[event.type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{getEventSummary()}</p>
          <p className="text-xs text-muted-foreground">{getEventTime()}</p>
        </div>
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-2 text-sm">
          <EventDetails event={event} />
        </div>
      )}
    </button>
  );
}

function EventDetails({ event }) {
  const { type, data } = event;

  switch (type) {
    case "visit":
      return (
        <div className="space-y-1">
          <DetailRow label="Type" value={data.visit_type} />
          <DetailRow label="Department" value={data.department} />
          <DetailRow label="Status" value={data.queue_status} />
          <DetailRow label="Priority" value={data.priority} />
          {data.notes && <DetailRow label="Notes" value={data.notes} />}
        </div>
      );
    case "consultation":
      return (
        <div className="space-y-1">
          <DetailRow label="Chief Complaint" value={data.chief_complaint} />
          <DetailRow label="Assessment" value={data.assessment} />
          <DetailRow label="Status" value={data.status} />
          {data.clinical_notes && (
            <div className="text-xs">
              <p className="font-medium text-muted-foreground">Notes:</p>
              <p className="text-foreground whitespace-pre-wrap">{data.clinical_notes}</p>
            </div>
          )}
        </div>
      );
    case "lab":
      return (
        <div className="space-y-1">
          <DetailRow label="Test" value={data.test_name} />
          <DetailRow label="Result" value={data.result_value} />
          <DetailRow label="Unit" value={data.unit} />
          <DetailRow label="Reference Range" value={data.reference_range} />
          <DetailRow label="Status" value={data.status} />
          {data.is_critical && (
            <div className="flex items-center gap-1 text-clinical-critical text-xs font-medium">
              <AlertCircle className="w-3 h-3" />
              Critical Result
            </div>
          )}
        </div>
      );
    case "imaging":
      return (
        <div className="space-y-1">
          <DetailRow label="Study Type" value={data.study_type} />
          <DetailRow label="Body Part" value={data.body_part} />
          <DetailRow label="Indication" value={data.clinical_indication} />
          <DetailRow label="Status" value={data.status} />
        </div>
      );
    case "vitals":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {data.bp_systolic && (
            <DetailRow label="BP" value={`${data.bp_systolic}/${data.bp_diastolic} mmHg`} />
          )}
          {data.heart_rate && <DetailRow label="HR" value={`${data.heart_rate} bpm`} />}
          {data.temperature && <DetailRow label="Temp" value={`${data.temperature}°C`} />}
          {data.spo2 && <DetailRow label="SpO2" value={`${data.spo2}%`} />}
          {data.weight && <DetailRow label="Weight" value={`${data.weight} kg`} />}
          {data.bmi && <DetailRow label="BMI" value={data.bmi.toFixed(1)} />}
          {data.pain_score && <DetailRow label="Pain" value={data.pain_score} />}
        </div>
      );
    case "prescription":
      return (
        <div className="space-y-1">
          <DetailRow label="Status" value={data.status} />
          {data.notes && <DetailRow label="Notes" value={data.notes} />}
        </div>
      );
    default:
      return null;
  }
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="font-medium text-muted-foreground min-w-fit">{label}:</span>
      <span className="text-foreground capitalize">{value}</span>
    </div>
  );
}