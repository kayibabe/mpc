import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ClipboardCheck, AlertTriangle, Clock, ChevronRight, Heart, Thermometer, Activity } from "lucide-react";

const PRIORITY_COLORS = {
  emergency: "border-l-triage-emergency bg-triage-emergency/5",
  urgent: "border-l-triage-urgent bg-triage-urgent/5",
  normal: "border-l-muted bg-muted/10",
};

const PRIORITY_BADGE = {
  emergency: "bg-triage-emergency/10 text-triage-emergency",
  urgent: "bg-triage-urgent/10 text-triage-urgent",
  normal: "bg-muted text-muted-foreground",
};

export default function TriageWidget() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [visits, patientsData, vitals] = await Promise.all([
          base44.entities.Visit.filter(
            { queue_status: { $in: ["waiting", "triaged"] } },
            "created_date",
            50
          ),
          base44.entities.Patient.list("", 200),
          base44.entities.VitalSigns.list("-created_date", 200),
        ]);

        const patientMap = {};
        patientsData.forEach(p => { patientMap[p.id] = p; });

        // Get latest vitals per visit
        const vitalsByVisit = {};
        vitals.forEach(v => {
          if (!vitalsByVisit[v.visit_id] || new Date(v.created_date) > new Date(vitalsByVisit[v.visit_id].created_date)) {
            vitalsByVisit[v.visit_id] = v;
          }
        });

        const waiting = visits
          .filter(v => v.queue_status === "waiting" || v.queue_status === "triaged")
          .map(v => {
            const patient = patientMap[v.patient_id];
            const latestVitals = vitalsByVisit[v.id];
            return {
              id: v.id,
              patientId: v.patient_id,
              name: patient ? `${patient.first_name} ${patient.last_name}` : v.patient_id?.slice(0, 8),
              mrn: patient?.mrn || "",
              priority: v.priority || "normal",
              status: v.queue_status,
              waitMinutes: Math.round((Date.now() - new Date(v.created_date).getTime()) / 60000),
              vitals: latestVitals ? {
                temp: latestVitals.temperature,
                hr: latestVitals.heart_rate,
                spo2: latestVitals.spo2,
              } : null,
            };
          })
          .sort((a, b) => {
            const prio = { emergency: 0, urgent: 1, normal: 2 };
            return (prio[a.priority] ?? 2) - (prio[b.priority] ?? 2);
          });

        setPatients(waiting);
      } catch (e) { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-8 w-full bg-muted rounded" />
          <div className="h-8 w-full bg-muted rounded" />
        </div>
      </div>
    );
  }

  const emergencyCount = patients.filter(p => p.priority === "emergency").length;
  const urgentCount = patients.filter(p => p.priority === "urgent").length;
  const normalCount = patients.filter(p => p.priority === "normal").length;

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-triage-emergency/5 via-triage-urgent/5 to-primary/5 px-4 py-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <h3 className="font-heading font-semibold text-sm">Patient Triage</h3>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            {emergencyCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-triage-emergency/10 text-triage-emergency font-bold">
                {emergencyCount} 🔴
              </span>
            )}
            {urgentCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-triage-urgent/10 text-triage-urgent font-bold">
                {urgentCount} 🟠
              </span>
            )}
            <span className="text-muted-foreground">{normalCount} routine</span>
          </div>
        </div>
      </div>

      {patients.length === 0 ? (
        <div className="p-6 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No patients waiting</p>
          <p className="text-xs text-muted-foreground mt-1">All clear — triage queue is empty</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40 max-h-[420px] overflow-y-auto">
          {patients.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors border-l-[3px] ${
                PRIORITY_COLORS[p.priority] || "border-l-muted bg-muted/10"
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                p.priority === "emergency" ? "bg-triage-emergency text-white" :
                p.priority === "urgent" ? "bg-triage-urgent text-white" :
                "bg-muted text-muted-foreground"
              }`}>
                {i + 1}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  {p.mrn && <span className="text-[10px] text-muted-foreground font-mono">{p.mrn}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${PRIORITY_BADGE[p.priority] || ""}`}>
                    {p.status === "triaged" ? "Triaged" : "Waiting"}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {p.waitMinutes < 60 ? `${p.waitMinutes}m` : `${Math.floor(p.waitMinutes / 60)}h ${p.waitMinutes % 60}m`}
                  </span>
                </div>

                {/* Vitals preview for triaged patients */}
                {p.vitals && p.status === "triaged" && (
                  <div className="flex items-center gap-3 mt-1">
                    {p.vitals.hr && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${p.vitals.hr > 100 ? "text-triage-urgent font-semibold" : "text-muted-foreground"}`}>
                        <Heart className="w-2.5 h-2.5" /> {p.vitals.hr}
                      </span>
                    )}
                    {p.vitals.temp && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${p.vitals.temp > 38 ? "text-triage-urgent font-semibold" : "text-muted-foreground"}`}>
                        <Thermometer className="w-2.5 h-2.5" /> {p.vitals.temp}°
                      </span>
                    )}
                    {p.vitals.spo2 && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${p.vitals.spo2 < 95 ? "text-triage-emergency font-semibold" : "text-muted-foreground"}`}>
                        <Activity className="w-2.5 h-2.5" /> {p.vitals.spo2}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}