import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Heart, Thermometer, Activity, Wind, Stethoscope, Pill, Syringe,
  ClipboardCheck, GitBranch, ArrowRight, Loader2, CheckCircle,
  Clock, AlertTriangle, FileText, Search, Users, Plus, Save, Brain,
  BarChart3, ChevronDown, ChevronUp
} from "lucide-react";
import DepartmentDashboard from "@/components/DepartmentDashboard";
import PatientJourneyTimeline from "@/components/PatientJourneyTimeline";
import RealTimeVitals from "@/components/RealTimeVitals";

const VITAL_FIELDS = [
  { key: "bp_systolic", label: "BP Systolic", suffix: "mmHg", icon: Activity, min: 60, max: 220 },
  { key: "bp_diastolic", label: "BP Diastolic", suffix: "mmHg", icon: Activity, min: 40, max: 140 },
  { key: "heart_rate", label: "Heart Rate", suffix: "bpm", icon: Heart, min: 30, max: 200 },
  { key: "respiratory_rate", label: "Respiratory Rate", suffix: "/min", icon: Wind, min: 8, max: 40 },
  { key: "temperature", label: "Temperature", suffix: "°C", icon: Thermometer, min: 34, max: 42 },
  { key: "spo2", label: "SpO₂", suffix: "%", icon: Wind, min: 70, max: 100 },
  { key: "weight", label: "Weight", suffix: "kg", icon: Activity, min: 1, max: 250 },
  { key: "glucose", label: "Glucose", suffix: "mmol/L", icon: Activity, min: 1, max: 40 },
  { key: "pain_score", label: "Pain Score", suffix: "/10", icon: AlertTriangle, min: 0, max: 10, step: 1 },
  { key: "gcs", label: "GCS", suffix: "/15", icon: Activity, min: 3, max: 15, step: 1 },
];

const TRIAGE_CATEGORIES = [
  { value: "normal", label: "Normal", color: "bg-chart-3/10 text-chart-3 border-chart-3/20" },
  { value: "urgent", label: "Urgent", color: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
  { value: "emergency", label: "Emergency", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

export default function Nursing() {
  const [activeTab, setActiveTab] = useState("triage");
  const [loading, setLoading] = useState(true);
  const [triageQueue, setTriageQueue] = useState([]);
  const [activePatients, setActivePatients] = useState([]);
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Vitals form
  const [vitalsForm, setVitalsForm] = useState({
    visit_id: "", patient_id: "",
    bp_systolic: "", bp_diastolic: "", heart_rate: "", respiratory_rate: "",
    temperature: "", spo2: "", weight: "", glucose: "", pain_score: "", gcs: "",
    notes: "",
  });

  // Nursing notes
  const [notes, setNotes] = useState("");
  const [notesList, setNotesList] = useState([]);
  const [noteSaved, setNoteSaved] = useState(false);

  // Medication admin
  const [pendingMeds, setPendingMeds] = useState([]);
  const [medicationResult, setMedicationResult] = useState(null);

  // Triage auto-assessment
  const [assessments, setAssessments] = useState({});
  const [assessing, setAssessing] = useState({});
  const [expandedAssess, setExpandedAssess] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [triaged, adminJ, p, v, disp] = await Promise.all([
        base44.entities.PatientJourney.filter(
          { current_stage: "TRIAGE", status: "active" }, "-created_date", 30
        ),
        base44.entities.PatientJourney.filter(
          { current_stage: "NURSING_ADMINISTRATION", status: "active" }, "-created_date", 30
        ),
        base44.entities.Patient.list("-created_date", 200),
        base44.entities.Visit.list("-created_date", 100),
        base44.entities.PharmacyDispensing.list("-created_date", 50),
      ]);
      setTriageQueue(triaged);
      setActivePatients(adminJ);
      setPatients(p);
      setVisits(v);
      setPendingMeds(
        disp.filter(d => !d.notes || !d.notes.includes("administered")).slice(0, 20)
      );
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getPatientName = (pid) => {
    const p = patients.find(pt => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : pid?.slice(0, 8) || "Unknown";
  };

  const getPatient = (pid) => patients.find(pt => pt.id === pid);
  const getVisit = (vid) => visits.find(v => v.id === vid);

  const handleAutoAssess = async (journey) => {
    setAssessing(prev => ({ ...prev, [journey.id]: true }));
    try {
      const { data } = await base44.functions.invoke("calculateTriageScore", {
        journey_id: journey.id,
        patient_id: journey.patient_id,
        visit_id: journey.visit_id,
      });
      setAssessments(prev => ({ ...prev, [journey.id]: data }));
      setExpandedAssess(prev => ({ ...prev, [journey.id]: true }));
    } catch (e) {
      alert("Assessment failed: " + (e.response?.data?.error || e.message));
    } finally {
      setAssessing(prev => ({ ...prev, [journey.id]: false }));
    }
  };

  const handleTriageTransition = async (journey, priority) => {
    setTransitioning(true);
    try {
      const visit = getVisit(journey.visit_id);
      if (visit) {
        await base44.entities.Visit.update(visit.id, { priority, queue_status: "triaged" });
      }
      await base44.functions.invoke("handleWorkflowStageChange", {
        journey_id: journey.id,
        next_stage: "CONSULTATION",
        notes: `Triaged as ${priority} — sent to consultation`,
      });
      setAssessments(prev => { const n = { ...prev }; delete n[journey.id]; return n; });
      setExpandedAssess(prev => { const n = { ...prev }; delete n[journey.id]; return n; });
      loadData();
    } catch (e) {
      alert("Transition failed: " + (e.response?.data?.error || e.message));
    } finally {
      setTransitioning(false);
    }
  };

  const handleSaveVitals = async (e) => {
    e.preventDefault();
    if (!vitalsForm.visit_id || !vitalsForm.patient_id) {
      alert("Please select a patient first");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        visit_id: vitalsForm.visit_id,
        patient_id: vitalsForm.patient_id,
        recorded_date: new Date().toISOString(),
      };
      VITAL_FIELDS.forEach(f => {
        if (vitalsForm[f.key] !== "" && vitalsForm[f.key] !== null) {
          payload[f.key] = Number(vitalsForm[f.key]);
        }
      });
      payload.notes = vitalsForm.notes || undefined;

      await base44.entities.VitalSigns.create(payload);

      if (vitalsForm.bmi == null && payload.weight && payload.height) {
        // BMI would be calculated here if height was available
      }

      // Reset form
      setVitalsForm({
        visit_id: "", patient_id: "",
        bp_systolic: "", bp_diastolic: "", heart_rate: "", respiratory_rate: "",
        temperature: "", spo2: "", weight: "", glucose: "", pain_score: "", gcs: "",
        notes: "",
      });
      setSelectedPatient(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const selectPatientForVitals = (journey) => {
    const visit = getVisit(journey.visit_id);
    setSelectedPatient(journey);
    setVitalsForm({
      ...vitalsForm,
      visit_id: journey.visit_id,
      patient_id: journey.patient_id,
    });
  };

  const handleAdministerMed = async (dispensing) => {
    try {
      await base44.entities.PharmacyDispensing.update(dispensing.id, {
        notes: (dispensing.notes || "") + " [Administered " + new Date().toISOString() + "]",
      });
      setMedicationResult(`Medication administered: ${dispensing.drug_name}`);
      setTimeout(() => setMedicationResult(null), 3000);
      setPendingMeds(pendingMeds.filter(m => m.id !== dispensing.id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveNote = async () => {
    if (!notes.trim()) return;
    // Add note to journey or visit
    setNotesList([...notesList, { text: notes, time: new Date().toISOString() }]);
    setNotes("");
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  const handleNursingTransition = async (journey, nextStage) => {
    setTransitioning(true);
    try {
      await base44.functions.invoke("handleWorkflowStageChange", {
        journey_id: journey.id,
        next_stage: nextStage,
        notes: `Nursing administration complete — sent to ${nextStage}`,
      });
      loadData();
    } catch (e) {
      alert("Transition failed: " + (e.response?.data?.error || e.message));
    } finally {
      setTransitioning(false);
    }
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
          <h2 className="section-title">Nursing Station</h2>
          <p className="text-sm text-muted-foreground mt-1">Triage, vital signs, medication administration & nursing notes</p>
        </div>
      </div>

      <DepartmentDashboard department="nursing" />

      <RealTimeVitals compact />

      <div className="bg-card rounded-xl border border-border/60 shadow-sm mt-6">
        <div className="border-b border-border flex">
          {[
            { key: "triage", label: "Triage", icon: AlertTriangle, count: triageQueue.length },
            { key: "vitals", label: "Vital Signs", icon: Heart },
            { key: "medication", label: "Medication", icon: Syringe, count: pendingMeds.length },
            { key: "active", label: "Active Patients", icon: Users, count: activePatients.length },
            { key: "notes", label: "Nursing Notes", icon: ClipboardCheck },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-1.5 ${
                activeTab === t.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  t.count > 5 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* TRIAGE TAB */}
          {activeTab === "triage" && (
            <div>
              <h4 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" /> Triage Queue ({triageQueue.length})
              </h4>
              {triageQueue.length === 0 ? (
                <div className="py-12 text-center">
                  <AlertTriangle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No patients waiting for triage.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Patients will appear here when checked in from reception.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {triageQueue.map(j => {
                    const patient = getPatient(j.patient_id);
                    const visit = getVisit(j.visit_id);
                    const assess = assessments[j.id];
                    const isAssessExpanded = expandedAssess[j.id];
                    const suggestedColor = assess?.suggested_priority === "emergency"
                      ? "border-destructive/40 bg-destructive/5"
                      : assess?.suggested_priority === "urgent"
                      ? "border-chart-2/40 bg-chart-2/5"
                      : "";
                    return (
                      <div key={j.id} className={`rounded-xl p-4 border ${assess ? suggestedColor || "border-border/40" : "border-border/40"} ${assess ? "bg-muted/20" : "bg-muted/20"}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">
                                {patient ? `${patient.first_name} ${patient.last_name}` : j.patient_id?.slice(0, 8)}
                              </p>
                              {assess && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  assess.suggested_priority === "emergency"
                                    ? "bg-destructive/10 text-destructive"
                                    : assess.suggested_priority === "urgent"
                                    ? "bg-chart-2/10 text-chart-2"
                                    : "bg-chart-3/10 text-chart-3"
                                }`}>
                                  MEWS: {assess.mews_score} — {assess.suggested_priority.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="font-mono">{patient?.mrn || "—"}</span>
                              {visit && <span>• {visit.visit_type}</span>}
                              {visit && <span>• {visit.priority}</span>}
                            </div>
                            {visit?.notes && (
                              <p className="text-xs text-muted-foreground mt-1.5 italic">{visit.notes}</p>
                            )}
                            <PatientJourneyTimeline journeyId={j.id} compact />

                            {/* Assessment breakdown */}
                            {assess && isAssessExpanded && (
                              <div className={`mt-3 p-3 rounded-lg border ${suggestedColor || "border-border/40"}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold flex items-center gap-1.5">
                                    <BarChart3 className="w-3.5 h-3.5 text-primary" />
                                    MEWS Score: {assess.mews_score}
                                    {!assess.vitals_available && (
                                      <span className="text-[10px] text-muted-foreground font-normal">— No vitals recorded yet</span>
                                    )}
                                  </p>
                                  <button
                                    onClick={() => setExpandedAssess(prev => ({ ...prev, [j.id]: false }))}
                                    className="text-[10px] text-muted-foreground hover:text-foreground"
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                </div>
                                {assess.breakdown.length > 0 && (
                                  <div className="grid grid-cols-2 gap-1 mb-2">
                                    {assess.breakdown.map((b, i) => (
                                      <div key={i} className="flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded bg-white/50">
                                        <span>{b.parameter}</span>
                                        <span className="font-mono">
                                          {b.value} <span className={`${b.score > 0 ? "text-destructive font-bold" : "text-muted-foreground"}`}>(+{b.score})</span>
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <p className={`text-[10px] font-medium ${assess.suggested_priority === "emergency" ? "text-destructive" : assess.suggested_priority === "urgent" ? "text-chart-2" : "text-chart-3"}`}>
                                  {assess.assessment}
                                </p>
                                {assess.red_flags.length > 0 && (
                                  <div className="mt-1.5 space-y-0.5">
                                    {assess.red_flags.map((rf, i) => (
                                      <p key={i} className="text-[10px] text-destructive font-medium flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> {rf}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 shrink-0 items-end">
                            <button
                              onClick={() => handleAutoAssess(j)}
                              disabled={assessing[j.id]}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${
                                assess
                                  ? "bg-muted/60 text-muted-foreground border-border"
                                  : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 hover:border-primary/30"
                              } disabled:opacity-50`}
                            >
                              {assessing[j.id] ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Brain className="w-3 h-3" />
                              )}
                              {assess ? "Re-assess" : "Auto-Assess"}
                            </button>
                            {assess && !isAssessExpanded && (
                              <button
                                onClick={() => setExpandedAssess(prev => ({ ...prev, [j.id]: true }))}
                                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                              >
                                <ChevronDown className="w-3 h-3" /> Details
                              </button>
                            )}
                            <div className="flex items-center gap-1.5">
                              {TRIAGE_CATEGORIES.map(cat => (
                                <button
                                  key={cat.value}
                                  onClick={() => handleTriageTransition(j, cat.value)}
                                  disabled={transitioning}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${cat.color} hover:opacity-80 transition-opacity disabled:opacity-50 ${
                                    assess?.suggested_priority === cat.value ? "ring-2 ring-offset-1 ring-current" : ""
                                  }`}
                                >
                                  {cat.label}
                                  {assess?.suggested_priority === cat.value && " ✓"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VITALS TAB */}
          {activeTab === "vitals" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Patient Queue */}
              <div className="lg:col-span-1 border border-border/60 rounded-xl overflow-hidden">
                <div className="p-3 bg-muted/30 border-b border-border flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <h4 className="font-heading text-sm font-semibold">Select Patient</h4>
                </div>
                <div className="max-h-[500px] overflow-y-auto divide-y divide-border">
                  {[ ...triageQueue, ...activePatients ].length === 0 && (
                    <p className="p-6 text-xs text-muted-foreground text-center">No patients available.</p>
                  )}
                  {[ ...triageQueue, ...activePatients ].map(j => (
                    <button
                      key={j.id}
                      onClick={() => selectPatientForVitals(j)}
                      className={`w-full text-left p-3 hover:bg-muted/30 transition-colors ${
                        selectedPatient?.id === j.id ? "bg-primary/5 border-l-2 border-primary" : ""
                      }`}
                    >
                      <p className="text-sm font-medium">{getPatientName(j.patient_id)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{j.patient_id?.slice(0, 8)}</p>
                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        j.current_stage === "TRIAGE" ? "bg-chart-2/10 text-chart-2" : "bg-chart-1/10 text-chart-1"
                      }`}>
                        {j.current_stage?.replace(/_/g, " ")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vitals Form */}
              <div className="lg:col-span-2 border border-border/60 rounded-xl p-5">
                <h4 className="font-heading font-semibold mb-4 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-destructive" /> Record Vital Signs
                </h4>

                {!selectedPatient ? (
                  <div className="py-12 text-center">
                    <Stethoscope className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Select a patient from the queue to record vitals.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSaveVitals} className="space-y-4">
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg mb-3">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{getPatientName(selectedPatient.patient_id)}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {VITAL_FIELDS.map(f => (
                        <div key={f.key}>
                          <label className="block text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <f.icon className="w-3 h-3" /> {f.label} ({f.suffix})
                          </label>
                          <input
                            type="number"
                            step={f.step || 0.1}
                            min={f.min}
                            max={f.max}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            value={vitalsForm[f.key]}
                            onChange={e => setVitalsForm({ ...vitalsForm, [f.key]: e.target.value })}
                            placeholder={f.label}
                          />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Notes</label>
                      <textarea
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none"
                        value={vitalsForm.notes}
                        onChange={e => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
                        placeholder="Additional observations..."
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 shadow-sm"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {saving ? "Saving..." : "Save Vital Signs"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* MEDICATION ADMINISTRATION TAB */}
          {activeTab === "medication" && (
            <div>
              <h4 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <Syringe className="w-4 h-4 text-primary" /> Medication Administration
              </h4>
              {medicationResult && (
                <div className="mb-3 p-3 bg-chart-3/10 border border-chart-3/20 rounded-lg flex items-center gap-2 text-xs text-chart-3">
                  <CheckCircle className="w-3.5 h-3.5" /> {medicationResult}
                </div>
              )}
              {pendingMeds.length === 0 ? (
                <div className="py-12 text-center">
                  <Pill className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No pending medications to administer.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Medications will appear here once dispensed from pharmacy.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Patient</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Drug</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Qty</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Dispensed</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingMeds.map(m => (
                        <tr key={m.id} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-medium">{getPatientName(m.patient_id)}</td>
                          <td className="py-2.5 px-3">{m.drug_name}</td>
                          <td className="py-2.5 px-3">{m.quantity_dispensed}</td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            {new Date(m.dispensing_date).toLocaleDateString("en-GB")}
                          </td>
                          <td className="py-2.5 px-3">
                            <button
                              onClick={() => handleAdministerMed(m)}
                              className="px-2 py-1 bg-chart-3/10 text-chart-3 rounded text-xs font-medium hover:bg-chart-3/20 flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" /> Administer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ACTIVE PATIENTS TAB */}
          {activeTab === "active" && (
            <div>
              <h4 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Active Patients ({activePatients.length})
              </h4>
              {activePatients.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No patients currently under nursing care.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activePatients.map(j => (
                    <div key={j.id} className="bg-muted/20 rounded-xl p-4 border border-border/40">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{getPatientName(j.patient_id)}</p>
                          <p className="text-xs text-muted-foreground font-mono mb-1">{j.patient_id?.slice(0, 8)}</p>
                          <PatientJourneyTimeline journeyId={j.id} compact />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleNursingTransition(j, "COMPLETED")}
                            disabled={transitioning}
                            className="px-3 py-1.5 bg-chart-3/10 text-chart-3 rounded-lg text-xs font-medium border border-chart-3/20 hover:bg-chart-3/20 disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" /> Discharge
                          </button>
                          <button
                            onClick={() => handleNursingTransition(j, "BILLING")}
                            disabled={transitioning}
                            className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium border border-primary/20 hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1"
                          >
                            <ArrowRight className="w-3 h-3" /> To Billing
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NURSING NOTES TAB */}
          {activeTab === "notes" && (
            <div>
              <h4 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-primary" /> Nursing Notes
              </h4>
              <div className="flex gap-2 mb-4">
                <textarea
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Enter nursing observation or handover note..."
                />
              </div>
              <button
                onClick={handleSaveNote}
                disabled={!notes.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 mb-4"
              >
                <Save className="w-3.5 h-3.5 inline mr-1" /> Save Note
              </button>
              {noteSaved && (
                <span className="ml-3 text-xs text-chart-3"><CheckCircle className="w-3 h-3 inline mr-1" /> Note saved</span>
              )}
              {notesList.length > 0 && (
                <div className="space-y-2 mt-4">
                  {notesList.map((n, i) => (
                    <div key={i} className="bg-muted/20 rounded-lg p-3 border border-border/40">
                      <p className="text-sm">{n.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {notesList.length === 0 && (
                <div className="py-12 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No nursing notes yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}