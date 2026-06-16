import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Heart, Pill, Syringe, FlaskConical, AlertTriangle, Users,
  ClipboardCheck, Clock, ArrowRight, Search, Calendar, Bell,
  Wifi, Activity, BedDouble, Loader2, ChevronRight, RefreshCw
} from "lucide-react";
import BedsideNotifications from "@/components/BedsideNotifications";
import RealTimeVitals from "@/components/RealTimeVitals";

function StatTile({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div className="bg-card rounded-xl border border-border/60 p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function NursePortal() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Stats
  const [stats, setStats] = useState({
    triage: 0, nurses: 0, vitals: 0, meds: 0,
  });

  // Lists
  const [triageQueue, setTriageQueue] = useState([]);
  const [nursingPatients, setNursingPatients] = useState([]);
  const [pendingMeds, setPendingMeds] = useState([]);
  const [recentLabs, setRecentLabs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [patientVitals, setPatientVitals] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [triaged, nurses, meds, labs, patList, vList, vitalsToday] = await Promise.all([
        base44.entities.PatientJourney.filter(
          { current_stage: "TRIAGE", status: "active" }, "-created_date", 30
        ),
        base44.entities.PatientJourney.filter(
          { current_stage: "NURSING_ADMINISTRATION", status: "active" }, "-created_date", 30
        ),
        base44.entities.PharmacyDispensing.list("-created_date", 30),
        base44.entities.LabResult.filter(
          { status: { $in: ["final", "preliminary"] } }, "-created_date", 20
        ),
        base44.entities.Patient.list("-created_date", 200),
        base44.entities.Visit.list("-created_date", 100),
        base44.entities.VitalSigns.filter(
          { created_date: { $gte: today } }, "-created_date", 100
        ),
      ]);

      setStats({
        triage: triaged.length,
        nurses: nurses.length,
        vitals: vitalsToday.length,
        meds: meds.filter(m => !m.notes?.includes("administered")).length,
      });
      setTriageQueue(triaged);
      setNursingPatients(nurses);
      setPendingMeds(meds.filter(m => !m.notes?.includes("administered")).slice(0, 20));
      setRecentLabs(labs);
      setPatients(patList);
      setVisits(vList);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getPatientName = (pid) => {
    const p = patients.find(pt => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : pid?.slice(0, 8) || "—";
  };

  const getPatient = (pid) => patients.find(pt => pt.id === pid);

  const getPatientLabs = (pid) => recentLabs.filter(l => l.patient_id === pid);

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    p.mrn?.toLowerCase().includes(search.toLowerCase())
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Nurse Portal</h2>
          <p className="text-sm text-muted-foreground mt-1">Your shift overview, bedside alerts & quick actions</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile icon={AlertTriangle} label="Triage Waiting" value={stats.triage} sub="Needs assessment" color="text-destructive" bg="bg-destructive/10" />
        <StatTile icon={Users} label="Under Care" value={stats.nurses} sub="Active nursing" color="text-chart-1" bg="bg-chart-1/10" />
        <StatTile icon={Heart} label="Vitals Today" value={stats.vitals} sub="Recorded today" color="text-chart-3" bg="bg-chart-3/10" />
        <StatTile icon={Pill} label="Pending Meds" value={stats.meds} sub="To administer" color="text-chart-2" bg="bg-chart-2/10" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Patient Search & Quick List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search */}
          <div className="bg-card rounded-xl border border-border/60 shadow-sm p-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Search patients..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Triage Queue */}
          <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-destructive/5 flex items-center justify-between">
              <h4 className="text-xs font-bold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Triage Queue ({triageQueue.length})
              </h4>
              {triageQueue.length > 0 && (
                <span className="text-[10px] text-destructive animate-pulse">● Needs attention</span>
              )}
            </div>
            <div className="max-h-[250px] overflow-y-auto divide-y divide-border/40">
              {triageQueue.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">Triage queue is clear</p>
              ) : (
                triageQueue.map(j => (
                  <button
                    key={j.id}
                    onClick={() => setSelectedPatient(j)}
                    className={`w-full text-left p-3 hover:bg-muted/30 transition-colors flex items-center justify-between ${
                      selectedPatient?.id === j.id ? "bg-destructive/5 border-l-2 border-destructive" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{getPatientName(j.patient_id)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{j.patient_id?.slice(0, 8)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Active Nursing Patients */}
          <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-chart-1/5 flex items-center justify-between">
              <h4 className="text-xs font-bold text-chart-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Under Nursing Care ({nursingPatients.length})
              </h4>
            </div>
            <div className="max-h-[250px] overflow-y-auto divide-y divide-border/40">
              {nursingPatients.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">No patients under nursing care</p>
              ) : (
                nursingPatients.map(j => (
                  <button
                    key={j.id}
                    onClick={() => setSelectedPatient(j)}
                    className={`w-full text-left p-3 hover:bg-muted/30 transition-colors flex items-center justify-between ${
                      selectedPatient?.id === j.id ? "bg-chart-1/5 border-l-2 border-chart-1" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{getPatientName(j.patient_id)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{j.patient_id?.slice(0, 8)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Quick Nav */}
          <div className="space-y-1.5">
            {[
              { label: "Go to Nursing Station", path: "/nursing", icon: ClipboardCheck, color: "text-primary" },
              { label: "View Triage", path: "/nursing", icon: AlertTriangle, color: "text-destructive" },
            ].map(link => (
              <a key={link.label} href={link.path} className="flex items-center justify-between px-4 py-2.5 bg-card rounded-lg border border-border/60 text-sm font-medium hover:bg-muted transition-colors">
                <span className="flex items-center gap-2">
                  <link.icon className={`w-4 h-4 ${link.color}`} /> {link.label}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>

        {/* Right Column - Patient Detail / Dashboard */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedPatient ? (
            /* Overview dashboard when no patient selected */
            <div className="space-y-4">
              <RealTimeVitals compact />

              {/* Pending Medications */}
              <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-chart-2/5 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-chart-2 flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5" /> Pending Medications ({pendingMeds.length})
                  </h4>
                </div>
                <div className="max-h-[250px] overflow-y-auto">
                  {pendingMeds.length === 0 ? (
                    <p className="p-4 text-xs text-muted-foreground text-center">No pending medications</p>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {pendingMeds.slice(0, 8).map(m => (
                        <div key={m.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-medium">{getPatientName(m.patient_id)}</p>
                            <p className="text-[10px] text-muted-foreground">{m.drug_name} × {m.quantity_dispensed}</p>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-chart-2/10 text-chart-2 text-[10px] font-medium flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> Due
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Labs */}
              <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-chart-3/5 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-chart-3 flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5" /> Recent Lab Results ({recentLabs.length})
                  </h4>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {recentLabs.length === 0 ? (
                    <p className="p-4 text-xs text-muted-foreground text-center">No recent lab results</p>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {recentLabs.slice(0, 6).map(lr => (
                        <div key={lr.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-medium">{getPatientName(lr.patient_id)} — {lr.test_name}</p>
                            <p className="text-[10px]">
                              <span className="font-mono font-semibold">{lr.result_value} {lr.unit || ""}</span>
                              {lr.reference_range && <span className="text-muted-foreground ml-1">({lr.reference_range})</span>}
                            </p>
                          </div>
                          {lr.is_critical ? (
                            <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-bold">CRIT</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-chart-3/10 text-chart-3 text-[10px] font-medium">{lr.status}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Patient Detail View */
            <div className="space-y-4">
              {/* Patient header */}
              <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {(() => {
                        const p = getPatient(selectedPatient.patient_id);
                        return p ? `${p.first_name?.[0] || ""}${p.last_name?.[0] || ""}` : "P";
                      })()}
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold">{getPatientName(selectedPatient.patient_id)}</h3>
                      <p className="text-xs text-muted-foreground font-mono">
                        {(() => {
                          const p = getPatient(selectedPatient.patient_id);
                          return p?.mrn || selectedPatient.patient_id?.slice(0, 8);
                        })()}
                        {" • "}{selectedPatient.current_stage?.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  <BedsideNotifications
                    patientId={selectedPatient.patient_id}
                    visitId={selectedPatient.visit_id}
                    compact
                  />
                </div>
              </div>

              {/* Bedside full alerts */}
              <BedsideNotifications
                patientId={selectedPatient.patient_id}
                visitId={selectedPatient.visit_id}
              />

              {/* Patient Labs */}
              {(() => {
                const labs = getPatientLabs(selectedPatient.patient_id);
                if (labs.length === 0) return null;
                return (
                  <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-chart-3/5">
                      <h4 className="text-xs font-bold text-chart-3 flex items-center gap-1.5">
                        <FlaskConical className="w-3.5 h-3.5" /> Lab Results
                      </h4>
                    </div>
                    <div className="divide-y divide-border/40 max-h-[200px] overflow-y-auto">
                      {labs.map(lr => (
                        <div key={lr.id} className="px-4 py-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{lr.test_name}</p>
                            {lr.is_critical && (
                              <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-bold">CRITICAL</span>
                            )}
                          </div>
                          <p className="mt-0.5">
                            <span className="font-mono font-semibold">{lr.result_value} {lr.unit || ""}</span>
                            {lr.reference_range && <span className="text-muted-foreground ml-1">Ref: {lr.reference_range}</span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {lr.status} • {lr.created_date ? new Date(lr.created_date).toLocaleString("en-GB") : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Record Vitals", path: "/nursing", icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10" },
                  { label: "Full Nursing", path: "/nursing", icon: ClipboardCheck, color: "text-primary", bg: "bg-primary/10" },
                ].map(action => (
                  <a
                    key={action.label}
                    href={action.path}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border/60 ${action.bg} hover:opacity-80 transition-opacity text-sm font-medium ${action.color}`}
                  >
                    <action.icon className="w-4 h-4" /> {action.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}