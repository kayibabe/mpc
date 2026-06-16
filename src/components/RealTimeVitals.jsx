import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Heart, Thermometer, Activity, Wind, Droplets, Users, Monitor, Wifi, WifiOff } from "lucide-react";

const VITAL_RANGES = {
  heart_rate: { min: 60, max: 100, critical_min: 40, critical_max: 130, unit: "bpm", label: "HR", icon: Heart, color: "text-rose-500" },
  bp_systolic: { min: 100, max: 140, critical_min: 80, critical_max: 180, unit: "mmHg", label: "SYS", icon: Activity, color: "text-blue-500" },
  bp_diastolic: { min: 60, max: 90, critical_min: 50, critical_max: 110, unit: "mmHg", label: "DIA", icon: Activity, color: "text-blue-400" },
  spo2: { min: 95, max: 100, critical_min: 88, critical_max: 100, unit: "%", label: "SpO₂", icon: Wind, color: "text-cyan-500" },
  temperature: { min: 36.1, max: 37.5, critical_min: 35, critical_max: 39.5, unit: "°C", label: "Temp", icon: Thermometer, color: "text-orange-500" },
  respiratory_rate: { min: 12, max: 20, critical_min: 8, critical_max: 28, unit: "/min", label: "RR", icon: Wind, color: "text-teal-500" },
};

function getVitalStatus(value, field) {
  const range = VITAL_RANGES[field];
  if (!range || value == null) return "normal";
  if (value <= range.critical_min || value >= range.critical_max) return "critical";
  if (value < range.min || value > range.max) return "warning";
  return "normal";
}

const STATUS_STYLES = {
  normal: { bg: "bg-chart-3/10", border: "border-chart-3/20", text: "text-chart-3", pulse: false },
  warning: { bg: "bg-chart-2/10", border: "border-chart-2/30", text: "text-chart-2", pulse: false },
  critical: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive", pulse: true },
};

function VitalCard({ patientName, vitals, connected, compact = false }) {
  if (!vitals) {
    return (
      <div className="bg-card rounded-xl border border-border/60 p-3 opacity-50">
        <p className="text-xs font-medium truncate">{patientName}</p>
        <p className="text-[10px] text-muted-foreground">No vitals recorded</p>
      </div>
    );
  }

  if (compact) {
    // Find worst status across all vitals
    let worstStatus = "normal";
    let worstField = null;
    for (const field of Object.keys(VITAL_RANGES)) {
      if (vitals[field] != null) {
        const s = getVitalStatus(vitals[field], field);
        if (s === "critical" || (s === "warning" && worstStatus !== "critical")) {
          worstStatus = s;
          worstField = field;
        }
      }
    }

    const style = STATUS_STYLES[worstStatus];
    const Icon = worstField ? VITAL_RANGES[worstField].icon : Heart;

    return (
      <div className={`bg-card rounded-xl border ${style.border} p-3 transition-all duration-300 ${style.pulse ? "animate-pulse" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold truncate flex-1">{patientName}</p>
          <Icon className={`w-3.5 h-3.5 ${style.text} ${style.pulse ? "animate-pulse" : ""}`} />
        </div>
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          {["heart_rate", "spo2", "temperature"].map(field => {
            if (vitals[field] == null) return null;
            const s = getVitalStatus(vitals[field], field);
            const r = VITAL_RANGES[field];
            return (
              <div key={field} className={`text-center px-1 py-0.5 rounded ${STATUS_STYLES[s].bg}`}>
                <span className={`font-bold ${STATUS_STYLES[s].text}`}>{vitals[field]}</span>
                <span className="text-muted-foreground ml-0.5">{r.unit}</span>
                <div className="text-[8px] text-muted-foreground">{r.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/60 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">{patientName}</p>
        <span className="text-[10px] text-muted-foreground">
          {new Date(vitals.recorded_date || vitals.created_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(VITAL_RANGES).map(([field, range]) => {
          const value = vitals[field];
          const status = value != null ? getVitalStatus(value, field) : "normal";
          const style = STATUS_STYLES[status];
          const Icon = range.icon;
          return (
            <div
              key={field}
              className={`rounded-lg border ${style.border} ${style.bg} p-2 text-center ${style.pulse ? "animate-pulse" : ""}`}
            >
              <Icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${style.text}`} />
              <p className={`text-lg font-bold ${style.text}`}>
                {value != null ? value : "—"}
              </p>
              <p className="text-[9px] text-muted-foreground">{range.label} ({range.unit})</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RealTimeVitals({ compact = false, maxPatients = 8 }) {
  const [vitalData, setVitalData] = useState({});
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const unsubscribeRef = useRef(null);

  const fetchLatest = useCallback(async () => {
    try {
      // Get active visits
      const activeVisits = await base44.entities.Visit.filter(
        { queue_status: { $in: ["triaged", "in_consultation", "in_lab", "in_pharmacy", "admitted"] } },
        "-created_date",
        20
      );

      const visitIds = activeVisits.map(v => v.id);
      const patientIds = [...new Set(activeVisits.map(v => v.patient_id))];

      // Fetch patients
      const patientList = [];
      for (const pid of patientIds.slice(0, maxPatients)) {
        try {
          const p = await base44.entities.Patient.get(pid);
          if (p) patientList.push(p);
        } catch (_) {}
      }
      setPatients(patientList);

      // Fetch latest vitals for active visits
      const newVitalData = {};
      for (const vid of visitIds.slice(0, maxPatients)) {
        try {
          const vitals = await base44.entities.VitalSigns.filter(
            { visit_id: vid },
            "-created_date",
            1
          );
          if (vitals.length > 0) {
            const visit = activeVisits.find(v => v.id === vid);
            const patient = patientList.find(p => p.id === visit?.patient_id);
            newVitalData[vid] = {
              ...vitals[0],
              patientName: patient ? `${patient.first_name} ${patient.last_name}` : visit?.patient_id?.slice(0, 8) || "Unknown",
              patientId: visit?.patient_id,
            };
          }
        } catch (_) {}
      }
      setVitalData(newVitalData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [maxPatients]);

  useEffect(() => {
    fetchLatest();

    // Subscribe to real-time VitalSigns changes
    try {
      unsubscribeRef.current = base44.entities.VitalSigns.subscribe((event) => {
        setConnected(true);
        setUpdateCount(c => c + 1);
        if (event.type === "create" || event.type === "update") {
          const vital = event.data || event;
          const vid = vital.visit_id;
          if (vid && vitalData[vid]) {
            setVitalData(prev => ({
              ...prev,
              [vid]: { ...vital, patientName: prev[vid]?.patientName || "Patient", patientId: prev[vid]?.patientId },
            }));
          } else if (vid) {
            // New vitals for a visit we should show - refresh
            fetchLatest();
          }
        }
      });
    } catch (e) {
      setConnected(false);
    }

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const entries = Object.entries(vitalData);

  if (compact) {
    return (
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Vitals</h4>
            {connected && (
              <span className="flex items-center gap-1 text-[9px] text-chart-3">
                <Wifi className="w-2.5 h-2.5" /> Live
              </span>
            )}
          </div>
          {updateCount > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {updateCount} update{updateCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {entries.length === 0 ? (
          <div className="p-4 text-center">
            <Monitor className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No active vitals to display.</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Vitals will appear as patients are monitored.</p>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
            {entries.map(([vid, data]) => (
              <VitalCard key={vid} patientName={data.patientName} vitals={data} connected={connected} compact />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-gradient-to-r from-rose-500/5 via-transparent to-cyan-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Heart className="w-5 h-5 text-rose-500 animate-pulse" style={{ animationDuration: "1.5s" }} />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-chart-3 border-2 border-card" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold">Real-Time Vitals Monitor</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {connected ? (
                  <span className="flex items-center gap-1 text-[10px] text-chart-3 font-medium">
                    <Wifi className="w-3 h-3" /> Connected — Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <WifiOff className="w-3 h-3" /> Polling mode
                  </span>
                )}
                {updateCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">• {updateCount} real-time update{updateCount !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-chart-3/60" /> Normal</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-chart-2/60" /> Warning</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive/60" /> Critical</span>
          </div>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="p-10 text-center">
          <Monitor className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No active patients being monitored.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Record vital signs in Clinical → Vitals tab for patients in active visits.
          </p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto">
          {entries.map(([vid, data]) => (
            <VitalCard key={vid} patientName={data.patientName} vitals={data} connected={connected} />
          ))}
        </div>
      )}
    </div>
  );
}