import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  BedDouble, Users, DoorOpen, AlertTriangle, Clock,
  Bell, ArrowRight, GitBranch, Activity,
  RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";

const REFRESH_INTERVAL = 15000; // 15 seconds

export default function InpatientDashboard() {
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [discharges, setDischarges] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [vitalSigns, setVitalSigns] = useState({});
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [expandedWard, setExpandedWard] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [
        w, b, a, p, d, jList, notifications, vitalsToday
      ] = await Promise.all([
        base44.entities.Ward.list("", 50),
        base44.entities.Bed.list("", 200),
        base44.entities.Admission.filter({ status: "admitted" }, "-created_date", 50),
        base44.entities.Patient.list("-created_date", 200),
        base44.entities.Discharge.filter({ created_date: { $gte: today } }, "-created_date", 20),
        base44.entities.PatientJourney.filter(
          { current_stage: { $in: ["NURSING_ADMINISTRATION"] }, status: "active" },
          "-created_date",
          30
        ),
        base44.entities.Notification.filter(
          { type: { $in: ["alert", "workflow"] }, is_read: false },
          "-created_date",
          30
        ),
        base44.entities.VitalSigns.filter(
          { created_date: { $gte: today } },
          "-created_date",
          200
        ),
      ]);

      setWards(w);
      setBeds(b);
      setAdmissions(a);
      setPatients(p);
      setDischarges(d);
      setJourneys(jList.filter(j => admissions.some(adm => adm.patient_id === j.patient_id)));

      // Incoming alerts — notifications relevant to inpatient
      const inpatientAlerts = notifications.filter(n =>
        n.message?.toLowerCase().includes("bed") ||
        n.message?.toLowerCase().includes("admit") ||
        n.message?.toLowerCase().includes("discharge") ||
        n.message?.toLowerCase().includes("ward") ||
        n.message?.toLowerCase().includes("transfer") ||
        n.message?.toLowerCase().includes("inpatient") ||
        n.target_role === "nursing"
      );
      setAlerts(inpatientAlerts);

      // Map latest vitals by patient_id for admitted patients
      const vitalsByPatient = {};
      vitalsToday.forEach(v => {
        if (!vitalsByPatient[v.patient_id] || new Date(v.created_date) > new Date(vitalsByPatient[v.patient_id].created_date)) {
          vitalsByPatient[v.patient_id] = v;
        }
      });
      setVitalSigns(vitalsByPatient);

      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time subscriptions
  useEffect(() => {
    const unsubAdmission = base44.entities.Admission?.subscribe(() => loadData());
    const unsubDischarge = base44.entities.Discharge?.subscribe(() => loadData());
    const unsubVitals = base44.entities.VitalSigns?.subscribe(() => loadData());
    const unsubNotifications = base44.entities.Notification?.subscribe(() => loadData());
    return () => {
      if (unsubAdmission) unsubAdmission();
      if (unsubDischarge) unsubDischarge();
      if (unsubVitals) unsubVitals();
      if (unsubNotifications) unsubNotifications();
    };
  }, [loadData]);

  const getPatientName = (pid) => {
    const p = patients.find(pt => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : pid?.slice(0, 8) || "Unknown";
  };

  const getPatient = (pid) => patients.find(pt => pt.id === pid);

  const getWardBeds = (wid) => beds.filter(b => b.ward_id === wid);
  const getWardAdmissions = (wid) => admissions.filter(a => a.ward_id === wid);

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter(b => b.status === "occupied").length;
  const availableBeds = beds.filter(b => b.status === "available").length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const pendingDischarges = discharges.filter(d => d.status === "pending" || !d.completed);
  const todayDischarges = discharges.length;
  const pendingTransferAlerts = alerts.filter(a => a.message?.toLowerCase().includes("transfer"));
  const bedRequestAlerts = alerts.filter(a => a.message?.toLowerCase().includes("bed"));

  // Vital status helpers
  const getVitalStatus = (vitals) => {
    if (!vitals) return null;
    const issues = [];
    if (vitals.spo2 != null && vitals.spo2 < 92) issues.push({ label: "SpO₂ Low", value: `${vitals.spo2}%`, severity: "critical" });
    if (vitals.heart_rate != null && (vitals.heart_rate > 120 || vitals.heart_rate < 50)) issues.push({ label: "HR", value: `${vitals.heart_rate}`, severity: "warning" });
    if (vitals.temperature != null && vitals.temperature > 38.5) issues.push({ label: "Temp", value: `${vitals.temperature}°C`, severity: "warning" });
    if (vitals.bp_systolic != null && (vitals.bp_systolic > 160 || vitals.bp_systolic < 90)) issues.push({ label: "BP", value: `${vitals.bp_systolic}/${vitals.bp_diastolic}`, severity: "critical" });
    return issues.length > 0 ? issues : null;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between bg-card rounded-xl border border-border/60 p-3">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${occupancyRate > 90 ? "bg-destructive animate-pulse" : occupancyRate > 70 ? "bg-chart-2" : "bg-chart-3"}`} />
            <span className="font-medium">Live</span>
          </div>
          <span className="text-muted-foreground">|</span>
          <span>{occupiedBeds}/{totalBeds} beds occupied</span>
          <span className="text-muted-foreground">|</span>
          <span className={`font-semibold ${occupancyRate > 90 ? "text-destructive" : "text-foreground"}`}>{occupancyRate}% occupancy</span>
        </div>
        <button onClick={loadData} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: BedDouble, label: "Occupied Beds", value: occupiedBeds, sub: `${availableBeds} available`, color: "text-chart-1", bg: "bg-chart-1/10" },
          { icon: Users, label: "Admitted", value: admissions.length, sub: "active patients", color: "text-primary", bg: "bg-primary/10" },
          { icon: DoorOpen, label: "Today's Discharges", value: todayDischarges, sub: `${pendingDischarges.length} pending`, color: "text-chart-3", bg: "bg-chart-3/10" },
          { icon: Bell, label: "Alerts", value: alerts.length, sub: `${bedRequestAlerts.length} bed requests`, color: alerts.length > 0 ? "text-destructive" : "text-chart-3", bg: alerts.length > 0 ? "bg-destructive/10" : "bg-chart-3/10" },
          { icon: Activity, label: "Abnormal Vitals", value: Object.values(vitalSigns).filter(v => getVitalStatus(v)).length, sub: "needs review", color: "text-destructive", bg: "bg-destructive/10" },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border/50 p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              {s.sub && <p className="text-[9px] text-muted-foreground/60">{s.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bed Occupancy by Ward */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h4 className="font-heading font-semibold text-sm flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-primary" /> Bed Occupancy by Ward
            </h4>
            {lastRefresh && (
              <span className="text-[10px] text-muted-foreground">
                Updated {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </div>
          <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
            {wards.map(ward => {
              const wardBeds = getWardBeds(ward.id);
              const wardAdmissions = getWardAdmissions(ward.id);
              const occupied = wardBeds.filter(b => b.status === "occupied").length;
              const available = wardBeds.filter(b => b.status === "available").length;
              const wardTotal = wardBeds.length;
              const wardOccupancy = wardTotal > 0 ? Math.round((occupied / wardTotal) * 100) : 0;
              const isExpanded = expandedWard === ward.id;

              return (
                <div key={ward.id} className="rounded-lg border border-border/40">
                  {/* Ward header */}
                  <button
                    onClick={() => setExpandedWard(isExpanded ? null : ward.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/20 transition-colors rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        wardOccupancy > 90 ? "bg-destructive/10" : wardOccupancy > 70 ? "bg-chart-2/10" : "bg-chart-3/10"
                      }`}>
                        <BedDouble className={`w-4 h-4 ${
                          wardOccupancy > 90 ? "text-destructive" : wardOccupancy > 70 ? "text-chart-2" : "text-chart-3"
                        }`} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-sm font-semibold">{ward.name}</p>
                        <p className="text-[10px] text-muted-foreground">{ward.type} • Floor {ward.floor || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className={`text-sm font-bold font-mono ${wardOccupancy > 90 ? "text-destructive" : ""}`}>
                          {occupied}/{wardTotal}
                        </p>
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
                          <div
                            className={`h-full rounded-full transition-all ${
                              wardOccupancy > 90 ? "bg-destructive" : wardOccupancy > 70 ? "bg-chart-2" : "bg-chart-3"
                            }`}
                            style={{ width: `${Math.min(100, wardOccupancy)}%` }}
                          />
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded patients */}
                  {isExpanded && (
                    <div className="border-t border-border/40 px-4 py-3 space-y-1.5 bg-muted/10 rounded-b-lg">
                      {wardAdmissions.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">No patients in this ward</p>
                      ) : (
                        wardAdmissions.map(adm => {
                          const patient = getPatient(adm.patient_id);
                          const vitals = vitalSigns[adm.patient_id];
                          const vitalIssues = getVitalStatus(vitals);
                          const admissionTime = new Date(adm.admission_date);
                          const hoursAdmitted = Math.round((Date.now() - admissionTime.getTime()) / 3600000 * 10) / 10;

                          return (
                            <div key={adm.id} className="flex items-center justify-between bg-white/60 rounded-lg p-2.5 text-xs">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{getPatientName(adm.patient_id)}</p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <span className="font-mono">{patient?.mrn || adm.patient_id?.slice(0, 8)}</span>
                                  <span className={`px-1 py-0.5 rounded-full text-[9px] font-medium ${
                                    adm.admission_type === "emergency" ? "bg-destructive/10 text-destructive" :
                                    adm.admission_type === "maternity" ? "bg-chart-4/10 text-chart-4" :
                                    "bg-chart-1/10 text-chart-1"
                                  }`}>{adm.admission_type}</span>
                                  <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {hoursAdmitted}h</span>
                                </div>
                                {adm.diagnosis_on_admission && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{adm.diagnosis_on_admission}</p>
                                )}
                              </div>
                              {/* Vital alerts */}
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                {vitalIssues ? (
                                  vitalIssues.map((iss, i) => (
                                    <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      iss.severity === "critical" ? "bg-destructive/10 text-destructive" : "bg-chart-2/10 text-chart-2"
                                    }`}>
                                      {iss.label}: {iss.value}
                                    </span>
                                  ))
                                ) : vitals ? (
                                  <span className="text-[9px] text-chart-3 font-medium">Vitals OK</span>
                                ) : (
                                  <span className="text-[9px] text-muted-foreground">No vitals</span>
                                )}
                                {vitalIssues && vitalIssues.some(v => v.severity === "critical") && (
                                  <AlertTriangle className="w-3.5 h-3.5 text-destructive animate-pulse" />
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {wards.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No wards configured.</p>
            )}
          </div>
        </div>

        {/* Right Column: Alerts & Pending Discharges */}
        <div className="space-y-4">
          {/* Incoming Alerts */}
          <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
            <div className={`px-4 py-3 border-b border-border flex items-center justify-between ${alerts.length > 0 ? "bg-destructive/5" : ""}`}>
              <h4 className="font-heading font-semibold text-sm flex items-center gap-2">
                <Bell className={`w-4 h-4 ${alerts.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                Incoming Alerts
              </h4>
              {alerts.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">{alerts.length}</span>
              )}
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No active alerts</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {alerts.map(alert => (
                    <div key={alert.id} className={`px-4 py-2.5 text-xs ${
                      alert.type === "alert" ? "bg-destructive/5" : ""
                    }`}>
                      <p className="font-semibold leading-tight">{alert.title}</p>
                      <p className="text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pending Discharges */}
          <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h4 className="font-heading font-semibold text-sm flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-chart-3" /> Pending Discharges
              </h4>
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              {discharges.length === 0 ? (
                <div className="py-8 text-center">
                  <DoorOpen className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No discharges today</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {discharges.map(d => (
                    <div key={d.id} className="px-4 py-2.5 text-xs">
                      <p className="font-medium">{getPatientName(d.patient_id)}</p>
                      <p className="text-muted-foreground">
                        {d.discharge_date ? new Date(d.discharge_date).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                        <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                          d.discharge_type === "normal" ? "bg-chart-3/10 text-chart-3" :
                          d.discharge_type === "transfer" ? "bg-chart-4/10 text-chart-4" :
                          "bg-destructive/10 text-destructive"
                        }`}>{d.discharge_type || "pending"}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bed Request Alerts */}
          <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h4 className="font-heading font-semibold text-sm flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-chart-4" /> Incoming Transfers
              </h4>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {journeys.length === 0 && bedRequestAlerts.length === 0 ? (
                <div className="py-6 text-center">
                  <ArrowRight className="w-6 h-6 text-muted-foreground/20 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">No pending transfers</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {journeys.slice(0, 5).map(j => (
                    <div key={j.id} className="px-4 py-2.5 text-xs">
                      <p className="font-medium">{getPatientName(j.patient_id)}</p>
                      <p className="text-muted-foreground flex items-center gap-1.5">
                        <Activity className="w-3 h-3" /> Nursing → Needs bed assignment
                      </p>
                    </div>
                  ))}
                  {bedRequestAlerts.map(alert => (
                    <div key={`bed-${alert.id}`} className="px-4 py-2.5 text-xs bg-chart-4/5">
                      <p className="font-semibold">{alert.title}</p>
                      <p className="text-muted-foreground mt-0.5">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}