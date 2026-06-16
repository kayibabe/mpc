import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, FlaskConical, Pill, Heart, AlertTriangle, Clock, FileText, ChevronDown, ChevronUp, Wifi, X, Thermometer, Wind } from "lucide-react";

export default function BedsideNotifications({ patientId, visitId, compact = false }) {
  const [notifications, setNotifications] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [latestVitals, setLatestVitals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(new Set());
  const [expanded, setExpanded] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const unsubscribeRef = useRef(null);

  const loadData = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [notifs, labs, rx, vitals] = await Promise.all([
        base44.entities.Notification.filter(
          { patient_id: patientId, is_read: false },
          "-created_date",
          10
        ),
        base44.entities.LabResult.filter(
          { patient_id: patientId, status: { $in: ["final", "preliminary"] } },
          "-created_date",
          5
        ),
        base44.entities.Prescription.filter(
          { patient_id: patientId, status: { $in: ["pending", "partial"] } },
          "-created_date",
          5
        ),
        visitId
          ? base44.entities.VitalSigns.filter({ visit_id: visitId }, "-created_date", 1)
          : base44.entities.VitalSigns.filter({ patient_id: patientId }, "-created_date", 1),
      ]);
      setNotifications(notifs.filter(n => !dismissed.has(n.id)));
      setLabResults(labs);
      setPrescriptions(rx);
      setLatestVitals(vitals[0] || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadData();
  }, [patientId, visitId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!patientId) return;

    const unsubs = [];

    try {
      unsubs.push(
        base44.entities.Notification.subscribe((event) => {
          if (event.data?.patient_id === patientId && !event.data?.is_read && !dismissed.has(event.data.id)) {
            setNotifications(prev => [event.data, ...prev].slice(0, 10));
            setLiveCount(c => c + 1);
          }
        })
      );
    } catch (_) {}

    try {
      unsubs.push(
        base44.entities.LabResult.subscribe((event) => {
          if ((event.type === "create" || event.type === "update") && event.data?.patient_id === patientId) {
            setLabResults(prev => {
              const filtered = prev.filter(r => r.id !== event.data.id);
              return [event.data, ...filtered].slice(0, 5);
            });
            setLiveCount(c => c + 1);
          }
        })
      );
    } catch (_) {}

    try {
      unsubs.push(
        base44.entities.VitalSigns.subscribe((event) => {
          if (event.type === "create" && event.data?.patient_id === patientId) {
            setLatestVitals(event.data);
            setLiveCount(c => c + 1);
          }
        })
      );
    } catch (_) {}

    return () => unsubs.forEach(u => u());
  }, [patientId]);

  const handleDismiss = (id) => {
    setDismissed(prev => new Set([...prev, id]));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleDismissAll = () => {
    const ids = new Set(notifications.map(n => n.id));
    setDismissed(prev => new Set([...prev, ...ids]));
    setNotifications([]);
  };

  // Check for abnormal vitals
  const vitalAlerts = [];
  if (latestVitals) {
    if (latestVitals.heart_rate && (latestVitals.heart_rate < 50 || latestVitals.heart_rate > 120))
      vitalAlerts.push({ label: "HR", value: latestVitals.heart_rate, unit: "bpm", icon: Heart, color: "text-rose-500" });
    if (latestVitals.spo2 != null && latestVitals.spo2 < 92)
      vitalAlerts.push({ label: "SpO₂", value: latestVitals.spo2, unit: "%", icon: Wind, color: "text-cyan-500" });
    if (latestVitals.temperature != null && latestVitals.temperature > 38)
      vitalAlerts.push({ label: "Temp", value: latestVitals.temperature, unit: "°C", icon: Thermometer, color: "text-orange-500" });
    if (latestVitals.bp_systolic && (latestVitals.bp_systolic < 90 || latestVitals.bp_systolic > 160))
      vitalAlerts.push({ label: "BP", value: `${latestVitals.bp_systolic}/${latestVitals.bp_diastolic}`, unit: "mmHg", icon: Heart, color: "text-blue-500" });
  }

  const criticalLabs = labResults.filter(r => r.is_critical);
  const activeRx = prescriptions.filter(rx => rx.status !== "dispensed" && rx.status !== "cancelled");

  if (loading && !patientId) {
    return null;
  }

  if (compact) {
    const totalAlerts = notifications.length + vitalAlerts.length + criticalLabs.length + activeRx.length;
    if (totalAlerts === 0) return null;

    return (
      <div className="relative inline-flex">
        <button
          onClick={() => setExpanded(!expanded)}
          className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
        >
          <Bell className="w-4 h-4" />
          {totalAlerts > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {totalAlerts}
            </span>
          )}
        </button>
      </div>
    );
  }

  const totalAlerts = notifications.length + vitalAlerts.length + criticalLabs.length + activeRx.length;

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Bedside Alerts
          </h4>
          {liveCount > 0 && (
            <span className="flex items-center gap-1 text-[9px] text-chart-3">
              <Wifi className="w-2.5 h-2.5" /> {liveCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {totalAlerts > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
              {totalAlerts}
            </span>
          )}
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-muted text-muted-foreground">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="max-h-[400px] overflow-y-auto divide-y divide-border/40">
          {/* Vital Sign Alerts */}
          {vitalAlerts.map((va, i) => {
            const Icon = va.icon;
            return (
              <div key={`vital-${i}`} className="px-4 py-2.5 bg-destructive/5 border-l-2 border-destructive flex items-center gap-3">
                <Icon className={`w-4 h-4 ${va.color} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">
                    <span className="text-destructive font-bold">{va.label}: {va.value} {va.unit}</span>
                    {" — "}Out of range
                  </p>
                  <p className="text-[10px] text-muted-foreground">Latest vital sign reading is abnormal</p>
                </div>
                <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
              </div>
            );
          })}

          {/* Critical Lab Results */}
          {criticalLabs.map(lr => (
            <div key={`lab-${lr.id}`} className="px-4 py-2.5 bg-destructive/5 border-l-2 border-destructive flex items-center gap-3">
              <FlaskConical className="w-4 h-4 text-destructive flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">
                  <span className="text-destructive font-bold">CRITICAL: {lr.test_name}</span>
                </p>
                <p className="text-xs">
                  Result: <span className="font-bold">{lr.result_value} {lr.unit || ""}</span>
                  {lr.reference_range && <span className="text-[10px] text-muted-foreground"> (Ref: {lr.reference_range})</span>}
                </p>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/20 text-destructive flex-shrink-0">CRIT</span>
            </div>
          ))}

          {/* Pending Medications */}
          {activeRx.map(rx => (
            <div key={`rx-${rx.id}`} className="px-4 py-2.5 bg-chart-2/5 border-l-2 border-chart-2 flex items-center gap-3">
              <Pill className="w-4 h-4 text-chart-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Medication pending</p>
                <p className="text-[10px] text-muted-foreground">
                  {rx.prescribed_drugs || "Prescription"} — Status: {rx.status}
                </p>
              </div>
              <Clock className="w-3.5 h-3.5 text-chart-2 flex-shrink-0" />
            </div>
          ))}

          {/* Notifications */}
          {notifications.map(n => (
            <div key={n.id} className={`px-4 py-2.5 flex items-start gap-3 ${
              n.type === "alert" ? "bg-destructive/5 border-l-2 border-destructive" :
              n.type === "workflow" ? "bg-chart-1/5 border-l-2 border-chart-1" :
              "bg-muted/10 border-l-2 border-muted"
            }`}>
              <Bell className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                n.type === "alert" ? "text-destructive" : "text-primary"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{n.title}</p>
                <p className="text-[10px] text-muted-foreground">{n.message}</p>
              </div>
              <button
                onClick={() => handleDismiss(n.id)}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {totalAlerts === 0 && (
            <div className="px-4 py-6 text-center">
              <FileText className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">No alerts for this patient</p>
            </div>
          )}

          {notifications.length > 0 && (
            <div className="px-4 py-2 text-center">
              <button
                onClick={handleDismissAll}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}