import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  Heart, Thermometer, Activity, Wind, Stethoscope, Pill, Syringe,
  ClipboardCheck, GitBranch, ArrowRight, Loader2, CheckCircle,
  Clock, AlertTriangle, FileText, Search, Users, Plus, Save, Brain,
  BarChart3, ChevronDown, ChevronUp, RefreshCw, FlaskConical, Bell, Trash2, Square, CheckSquare, Zap,
  ClipboardList
} from "lucide-react";
import DepartmentDashboard from "@/components/DepartmentDashboard";
import PatientJourneyTimeline from "@/components/PatientJourneyTimeline";
import RealTimeVitals from "@/components/RealTimeVitals";
import NurseTasklist from "@/components/NurseTasklist";
import PageHeader from "@/components/ui/PageHeader";

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

  // Waste logging
  const [showWasteLog, setShowWasteLog] = useState(false);
  const [wasteForm, setWasteForm] = useState({ waste_category_id: "", quantity_kg: "", container_count: "1", notes: "" });
  const [wasteCategories, setWasteCategories] = useState([]);

  // Nursing notes
  const [notes, setNotes] = useState("");
  const [notesList, setNotesList] = useState([]);
  const [noteSaved, setNoteSaved] = useState(false);

  // Care plans
  const [carePlans, setCarePlans] = useState([]);
  const [showCarePlan, setShowCarePlan] = useState(false);
  const [carePlanForm, setCarePlanForm] = useState({
    patient_id: "", visit_id: "", nursing_diagnosis: "", goals: "", interventions: "",
    evaluation: "", positioning_schedule: "q4h", diet_plan: "", fluid_balance_target_ml: "",
    pain_management_plan: "", wound_care_plan: "", mobility_assistance: "independent",
    fall_risk: "low", pressure_ulcer_risk: "low", notes: "",
  });

  // Medication admin
  const [pendingMeds, setPendingMeds] = useState([]);
  const [medicationResult, setMedicationResult] = useState(null);

  // Overview dashboard data
  const [overviewStats, setOverviewStats] = useState({ triage: 0, nurses: 0, vitals: 0, meds: 0 });
  const [recentLabs, setRecentLabs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [overviewSearch, setOverviewSearch] = useState("");
  const [overviewSelected, setOverviewSelected] = useState(null);

  // Triage auto-assessment
  const [assessments, setAssessments] = useState({});
  const [assessing, setAssessing] = useState({});
  const [expandedAssess, setExpandedAssess] = useState({});

  // Unified workflow — merged triage + active patients sorted by priority
  const [expandedPatient, setExpandedPatient] = useState(null);
  const [bulkSelect, setBulkSelect] = useState(new Set());
  const [bulkTriagePriority, setBulkTriagePriority] = useState("urgent");
  const [bulkTriageNotes, setBulkTriageNotes] = useState("");
  const [bulkTriageOpen, setBulkTriageOpen] = useState(false);
  const [bulkTriageing, setBulkTriageing] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const unifiedQueue = useMemo(() => {
    const all = [...triageQueue, ...activePatients];
    const priorityOrder = { emergency: 0, urgent: 1, normal: 2 };
    return all.sort((a, b) => {
      const va = getVisit(a.visit_id);
      const vb = getVisit(b.visit_id);
      return (priorityOrder[va?.priority] ?? 3) - (priorityOrder[vb?.priority] ?? 3);
    });
  }, [triageQueue, activePatients, visits]);

  const suggestedColor = (assess) =>
    assess?.suggested_priority === "emergency"
      ? "border-destructive/40 bg-destructive/5"
      : assess?.suggested_priority === "urgent"
      ? "border-chart-2/40 bg-chart-2/5"
      : "border-border/40";

  useEffect(() => {
    loadData();
    base44.entities.WasteCategory.list("", 20).then(setWasteCategories).catch(() => {});
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [triaged, adminJ, p, v, disp, labs, vitalsToday] = await Promise.all([
        base44.entities.PatientJourney.filter(
          { current_stage: "TRIAGE", status: "active" }, "-created_date", 30
        ),
        base44.entities.PatientJourney.filter(
          { current_stage: "NURSING_ADMINISTRATION", status: "active" }, "-created_date", 30
        ),
        base44.entities.Patient.list("-created_date", 200),
        base44.entities.Visit.list("-created_date", 100),
        base44.entities.PharmacyDispensing.list("-created_date", 50),
        base44.entities.LabResult.filter(
          { status: { $in: ["final", "preliminary"] } }, "-created_date", 20
        ),
        base44.entities.VitalSigns.filter(
          { created_date: { $gte: today } }, "-created_date", 100
        ),
      ]);
      setTriageQueue(triaged);
      setActivePatients(adminJ);
      setPatients(p);
      setVisits(v);
      setPendingMeds(
        disp.filter(d => !d.notes || !d.notes.includes("administered")).slice(0, 20)
      );
      setOverviewStats({
        triage: triaged.length,
        nurses: adminJ.length,
        vitals: vitalsToday.length,
        meds: disp.filter(d => !d.notes?.includes("administered")).length,
      });
      setRecentLabs(labs);
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
      const { data } = await base44.functions.invoke("formalizeTriageWorkflow", {
        journey_id: journey.id,
        triage_priority: priority,
        notes: `Triaged as ${priority} — sent to consultation`,
      });
      setAssessments(prev => { const n = { ...prev }; delete n[journey.id]; return n; });
      setExpandedAssess(prev => { const n = { ...prev }; delete n[journey.id]; return n; });
      loadData();
    } catch (e) {
      alert("Triage failed: " + (e.response?.data?.error || e.message));
    } finally {
      setTransitioning(false);
    }
  };

  const toggleBulkSelect = (journeyId) => {
    setBulkSelect(prev => {
      const n = new Set(prev);
      n.has(journeyId) ? n.delete(journeyId) : n.add(journeyId);
      return n;
    });
  };

  const selectAllTriage = () => {
    if (bulkSelect.size === triageQueue.length) {
      setBulkSelect(new Set());
    } else {
      setBulkSelect(new Set(triageQueue.map(j => j.id)));
    }
  };

  const handleBulkTriage = async () => {
    if (bulkSelect.size === 0) return;
    setBulkTriageing(true);
    setBulkResult(null);
    try {
      const { data } = await base44.functions.invoke("bulkTriage", {
        journey_ids: [...bulkSelect],
        priority: bulkTriagePriority,
        notes: bulkTriageNotes || `Bulk triaged as ${bulkTriagePriority}`,
      });
      setBulkResult(data);
      setBulkSelect(new Set());
      loadData();
    } catch (e) {
      alert("Bulk triage failed: " + (e.response?.data?.error || e.message));
    } finally {
      setBulkTriageing(false);
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

  const handleLogWaste = async (e) => {
    e.preventDefault();
    const cat = wasteCategories.find(c => c.id === wasteForm.waste_category_id);
    await base44.entities.WasteLog.create({
      ...wasteForm,
      category_code: cat?.code || "",
      origin_department: "nursing",
      quantity_kg: Number(wasteForm.quantity_kg),
      container_count: Number(wasteForm.container_count),
      generated_at: new Date().toISOString(),
      generated_by: "nursing_staff",
      status: "generated",
      sla_deadline: new Date(Date.now() + (cat?.max_storage_hours || 24) * 3600000).toISOString(),
    });
    setShowWasteLog(false);
    setWasteForm({ waste_category_id: "", quantity_kg: "", container_count: "1", notes: "" });
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
      <PageHeader title="Nursing Station" subtitle="Overview, triage, vital signs, medication & notes" icon={Stethoscope} className="mb-4" />

      {/* Quick-Action Bar — always visible */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm p-3 mb-4 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mr-2">Quick Actions</span>
        <button onClick={() => setActiveTab("overview")} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" /> Overview
        </button>
        <button onClick={() => setActiveTab("workflow")} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-chart-1/10 text-chart-1 hover:bg-chart-1/20 border border-chart-1/20 flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5" /> Workflow ({unifiedQueue.length})
        </button>
        <button onClick={() => { setActiveTab("triage"); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Triage ({triageQueue.length})
        </button>
        <button onClick={() => { setActiveTab("vitals"); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-chart-3/10 text-chart-3 hover:bg-chart-3/20 border border-chart-3/20 flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5" /> Vitals
        </button>
        <button onClick={() => setActiveTab("medication")} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 border border-chart-2/20 flex items-center gap-1.5">
          <Syringe className="w-3.5 h-3.5" /> Meds ({pendingMeds.length})
        </button>
        <button onClick={() => setActiveTab("notes")} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-chart-4/10 text-chart-4 hover:bg-chart-4/20 border border-chart-4/20 flex items-center gap-1.5">
          <ClipboardCheck className="w-3.5 h-3.5" /> Notes
        </button>
        <button onClick={() => setActiveTab("careplan")} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-chart-1/10 text-chart-1 hover:bg-chart-1/20 border border-chart-1/20 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Care Plans
        </button>
        <button onClick={() => setActiveTab("tasklist")} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-chart-3/10 text-chart-3 hover:bg-chart-3/20 border border-chart-3/20 flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> Tasks
        </button>
        <button onClick={() => setShowWasteLog(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5" /> Log Waste
        </button>
        <button onClick={loadData} disabled={loading} className="ml-auto px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <DepartmentDashboard department="nursing" />

      <RealTimeVitals compact />

      <div className="bg-card rounded-xl border border-border/60 shadow-sm mt-6">
        <div className="border-b border-border flex">
          {[
            { key: "overview", label: "Overview", icon: Bell },
            { key: "workflow", label: "Workflow", icon: GitBranch, count: unifiedQueue.length },
            { key: "triage", label: "Triage", icon: AlertTriangle, count: triageQueue.length },
            { key: "vitals", label: "Vitals", icon: Heart },
            { key: "medication", label: "Meds", icon: Syringe, count: pendingMeds.length },
            { key: "notes", label: "Notes", icon: ClipboardCheck },
            { key: "careplan", label: "Care Plans", icon: FileText },
            { key: "tasklist", label: "Tasks", icon: ClipboardList },
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
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { icon: AlertTriangle, label: "Triage Waiting", value: overviewStats.triage, sub: "Needs assessment", color: "text-destructive", bg: "bg-destructive/10" },
                  { icon: Users, label: "Under Care", value: overviewStats.nurses, sub: "Active nursing", color: "text-chart-1", bg: "bg-chart-1/10" },
                  { icon: Heart, label: "Vitals Today", value: overviewStats.vitals, sub: "Recorded", color: "text-chart-3", bg: "bg-chart-3/10" },
                  { icon: Pill, label: "Pending Meds", value: overviewStats.meds, sub: "To administer", color: "text-chart-2", bg: "bg-chart-2/10" },
                ].map(s => (
                  <div key={s.label} className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                    <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                      <s.icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">{s.label}</p>
                      <p className="text-xl font-bold">{s.value}</p>
                      {s.sub && <p className="text-[10px] text-muted-foreground">{s.sub}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Quick Patient Lists */}
                <div className="space-y-4">
                  {/* Triage summary */}
                  <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-destructive/5 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-destructive flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Triage ({triageQueue.length})
                      </h4>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto divide-y divide-border/40">
                      {triageQueue.length === 0 ? (
                        <p className="p-4 text-xs text-muted-foreground text-center">Queue is clear</p>
                      ) : (
                        triageQueue.slice(0, 6).map(j => (
                          <button key={j.id} onClick={() => { setActiveTab("triage"); }} className="w-full text-left p-2.5 hover:bg-muted/30 text-xs flex items-center justify-between">
                            <span className="font-medium truncate">{getPatientName(j.patient_id)}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Nursing patients summary */}
                  <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-chart-1/5 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-chart-1 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Under Care ({activePatients.length})
                      </h4>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto divide-y divide-border/40">
                      {activePatients.length === 0 ? (
                        <p className="p-4 text-xs text-muted-foreground text-center">No patients under nursing care</p>
                      ) : (
                        activePatients.slice(0, 6).map(j => (
                          <button key={j.id} onClick={() => { setActiveTab("workflow"); }} className="w-full text-left p-2.5 hover:bg-muted/30 text-xs flex items-center justify-between">
                            <span className="font-medium truncate">{getPatientName(j.patient_id)}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Labs */}
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-chart-3/5 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-chart-3 flex items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5" /> Recent Labs ({recentLabs.length})
                    </h4>
                  </div>
                  <div className="max-h-[410px] overflow-y-auto">
                    {recentLabs.length === 0 ? (
                      <p className="p-4 text-xs text-muted-foreground text-center">No recent results</p>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {recentLabs.slice(0, 8).map(lr => (
                          <div key={lr.id} className="px-4 py-2.5 text-xs">
                            <p className="font-medium">{getPatientName(lr.patient_id)} — {lr.test_name}</p>
                            <p>
                              <span className="font-mono font-semibold">{lr.result_value} {lr.unit || ""}</span>
                              {lr.reference_range && <span className="text-muted-foreground ml-1">({lr.reference_range})</span>}
                            </p>
                            {lr.is_critical && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-bold">CRITICAL</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* WORKFLOW TAB — unified triage + active patients */}
          {activeTab === "workflow" && (
            <div>
              <h4 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" /> Nursing Workflow ({unifiedQueue.length})
              </h4>
              {unifiedQueue.length === 0 ? (
                <div className="py-12 text-center">
                  <GitBranch className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No patients in nursing workflow.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Patients appear here from triage and active care.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {unifiedQueue.map(j => {
                    const patient = getPatient(j.patient_id);
                    const visit = getVisit(j.visit_id);
                    const isTriage = j.current_stage === "TRIAGE";
                    const isActive = j.current_stage === "NURSING_ADMINISTRATION";
                    const assess = assessments[j.id];
                    const isOpen = expandedPatient === j.id;
                    const priorityColors = {
                      emergency: "border-l-[4px] border-l-destructive",
                      urgent: "border-l-[4px] border-l-chart-2",
                      normal: "border-l-[4px] border-l-chart-3",
                    };
                    return (
                      <div key={j.id} className={`bg-muted/20 rounded-xl border border-border/40 overflow-hidden ${priorityColors[visit?.priority] || ""}`}>
                        {/* Patient Row Header */}
                        <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedPatient(isOpen ? null : j.id)}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isTriage ? "bg-destructive/10 text-destructive" : "bg-chart-1/10 text-chart-1"
                            }`}>
                              {isTriage ? "T" : "A"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{getPatientName(j.patient_id)}</p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="font-mono">{patient?.mrn || j.patient_id?.slice(0, 8)}</span>
                                {visit && <span className={`px-1 py-0.5 rounded-full text-[9px] font-medium ${
                                  visit.priority === "emergency" ? "bg-destructive/10 text-destructive" :
                                  visit.priority === "urgent" ? "bg-chart-2/10 text-chart-2" : "bg-muted text-muted-foreground"
                                }`}>{visit.priority}</span>}
                                <span>{isTriage ? "Triage Queue" : "Under Care"}</span>
                              </div>
                            </div>
                            {assess && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                assess.suggested_priority === "emergency" ? "bg-destructive/10 text-destructive" :
                                assess.suggested_priority === "urgent" ? "bg-chart-2/10 text-chart-2" : "bg-chart-3/10 text-chart-3"
                              }`}>MEWS: {assess.mews_score}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isTriage && (
                              <button onClick={(e) => { e.stopPropagation(); handleAutoAssess(j); }} disabled={assessing[j.id]}
                                className="px-2 py-1 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1 disabled:opacity-50">
                                {assessing[j.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                                {assess ? "Re-assess" : "Assess"}
                              </button>
                            )}
                            {isActive && (
                              <button onClick={(e) => { e.stopPropagation(); selectPatientForVitals(j); setActiveTab("vitals"); }}
                                className="px-2 py-1 rounded text-[10px] font-medium bg-chart-3/10 text-chart-3 hover:bg-chart-3/20 flex items-center gap-1">
                                <Heart className="w-3 h-3" /> Vitals
                              </button>
                            )}
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </div>
                        </div>

                        {/* Expanded Actions */}
                        {isOpen && (
                          <div className="border-t border-border px-4 py-3 bg-muted/10 space-y-3">
                            <PatientJourneyTimeline journeyId={j.id} compact />

                            {/* Quick-Action Buttons Row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {isTriage && assess && (
                                <div className="flex items-center gap-1.5">
                                  {TRIAGE_CATEGORIES.map(cat => (
                                    <button key={cat.value} onClick={(e) => { e.stopPropagation(); handleTriageTransition(j, cat.value); }}
                                      disabled={transitioning}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${cat.color} hover:opacity-80 transition-opacity disabled:opacity-50 ${
                                        assess?.suggested_priority === cat.value ? "ring-2 ring-offset-1 ring-current" : ""
                                      }`}>
                                      {cat.label} {assess?.suggested_priority === cat.value && "✓"}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {isActive && (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); handleNursingTransition(j, "COMPLETED"); }}
                                    disabled={transitioning}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-chart-3/10 text-chart-3 hover:bg-chart-3/20 border border-chart-3/20 flex items-center gap-1 disabled:opacity-50">
                                    <CheckCircle className="w-3 h-3" /> Discharge
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleNursingTransition(j, "BILLING"); }}
                                    disabled={transitioning}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 flex items-center gap-1 disabled:opacity-50">
                                    <ArrowRight className="w-3 h-3" /> To Billing
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleNursingTransition(j, "PHARMACY_DISPENSING"); }}
                                    disabled={transitioning}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 border border-chart-2/20 flex items-center gap-1 disabled:opacity-50">
                                    <Pill className="w-3 h-3" /> Pharmacy
                                  </button>
                                </>
                              )}
                              {isTriage && (
                                <button onClick={(e) => { e.stopPropagation(); selectPatientForVitals(j); setActiveTab("vitals"); }}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-chart-3/10 text-chart-3 hover:bg-chart-3/20 border border-chart-3/20 flex items-center gap-1">
                                  <Heart className="w-3 h-3" /> Record Vitals
                                </button>
                              )}
                            </div>

                            {/* Assessment Details (Triage) */}
                            {isTriage && assess && (
                              <div className={`p-3 rounded-lg border ${suggestedColor(assess)}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold flex items-center gap-1.5">
                                    <BarChart3 className="w-3.5 h-3.5 text-primary" />
                                    MEWS Score: {assess.mews_score} — {assess.suggested_priority?.toUpperCase()}
                                    {!assess.vitals_available && (
                                      <span className="text-[10px] text-muted-foreground font-normal">(no vitals yet)</span>
                                    )}
                                  </p>
                                </div>
                                {assess.breakdown?.length > 0 && (
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mb-2">
                                    {assess.breakdown.map((b, i) => (
                                      <div key={i} className="flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded bg-white/50">
                                        <span>{b.parameter}</span>
                                        <span className="font-mono">{b.value} <span className={b.score > 0 ? "text-destructive font-bold" : "text-muted-foreground"}>(+{b.score})</span></span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <p className="text-[10px] font-medium">{assess.assessment}</p>
                                {assess.red_flags?.length > 0 && assess.red_flags.map((rf, i) => (
                                  <p key={i} className="text-[10px] text-destructive font-medium flex items-center gap-1 mt-1">
                                    <AlertTriangle className="w-3 h-3" /> {rf}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TRIAGE TAB */}
          {activeTab === "triage" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-heading font-semibold flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" /> Triage Queue ({triageQueue.length})
                </h4>
                {triageQueue.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button onClick={selectAllTriage} className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted">
                      {bulkSelect.size === triageQueue.length ? "Deselect All" : "Select All"}
                    </button>
                    <button onClick={() => setBulkTriageOpen(true)} disabled={bulkSelect.size === 0}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 border border-primary/20">
                      <Zap className="w-3 h-3" /> Bulk Triage ({bulkSelect.size})
                    </button>
                  </div>
                )}
              </div>

              {bulkTriageOpen && (
                <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Bulk Triage — {bulkSelect.size} patient{bulkSelect.size !== 1 ? 's' : ''}</p>
                    <button onClick={() => setBulkTriageOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                  {bulkResult ? (
                    <div className={`p-3 rounded-lg ${bulkResult.failed > 0 ? 'bg-chart-2/10 border border-chart-2/20' : 'bg-chart-3/10 border border-chart-3/20'}`}>
                      <p className="text-xs font-semibold">Triaged: {bulkResult.triaged}{bulkResult.failed > 0 ? ` — Failed: ${bulkResult.failed}` : ''}</p>
                      <button onClick={() => { setBulkResult(null); setBulkTriageOpen(false); }} className="text-[10px] text-primary mt-1 hover:underline">Dismiss</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        {[{ v: "emergency", label: "Emergency" }, { v: "urgent", label: "Urgent" }, { v: "normal", label: "Routine" }].map(cat => (
                          <button key={cat.v} onClick={() => setBulkTriagePriority(cat.v)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                              bulkTriagePriority === cat.v
                                ? cat.v === "emergency" ? "bg-destructive/10 text-destructive border-destructive/30 ring-2 ring-destructive/20"
                                : cat.v === "urgent" ? "bg-chart-2/10 text-chart-2 border-chart-2/30 ring-2 ring-chart-2/20"
                                : "bg-chart-3/10 text-chart-3 border-chart-3/30 ring-2 ring-chart-3/20"
                                : "border-border hover:bg-muted"
                            }`}>{cat.label}</button>
                        ))}
                      </div>
                      <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs resize-none h-16" value={bulkTriageNotes}
                        onChange={e => setBulkTriageNotes(e.target.value)} placeholder="Optional triage notes for all selected patients..." />
                      <button onClick={handleBulkTriage} disabled={bulkTriageing}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                        {bulkTriageing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {bulkTriageing ? "Triaging..." : `Confirm Bulk Triage as ${bulkTriagePriority}`}
                      </button>
                    </div>
                  )}
                </div>
              )}
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
                    const waitMins = Math.round((Date.now() - new Date(j.created_date).getTime()) / 60000);
                    const waitDisplay = waitMins < 60 ? `${waitMins}m` : `${Math.floor(waitMins / 60)}h ${waitMins % 60}m`;
                    const priorityBorder = assess?.suggested_priority === "emergency" ? "border-l-[4px] border-l-destructive" :
                      assess?.suggested_priority === "urgent" ? "border-l-[4px] border-l-chart-2" : "";
                    const priorityBg = assess?.suggested_priority === "emergency" ? "bg-destructive/5 border-destructive/20" :
                      assess?.suggested_priority === "urgent" ? "bg-chart-2/5 border-chart-2/20" : "";
                    const isSelected = bulkSelect.has(j.id);
                    return (
                      <div key={j.id} className={`rounded-xl overflow-hidden border ${assess ? `${priorityBg} ${priorityBorder}` : "border-border/40 bg-muted/20"} ${isSelected ? "ring-2 ring-primary/30" : ""} transition-all duration-200`}>
                        <div className="flex items-start gap-3">
                          <button onClick={() => toggleBulkSelect(j.id)} className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-primary">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm">
                                {patient ? `${patient.first_name} ${patient.last_name}` : j.patient_id?.slice(0, 8)}
                              </p>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />{waitDisplay}
                              </span>
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
                            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                              {patient?.mrn && <span className="font-mono text-xs">{patient.mrn}</span>}
                              {patient?.mrn && visit && <span className="text-border">•</span>}
                              {visit && <span className="capitalize">{visit.visit_type}</span>}
                              {visit && <span className="text-border">•</span>}
                              {visit && <span className={`font-medium ${visit.priority === "emergency" ? "text-destructive" : visit.priority === "urgent" ? "text-chart-2" : ""}`}>{visit.priority}</span>}
                              {patient?.blood_group && <><span className="text-border">•</span><span className="font-mono font-semibold text-xs">{patient.blood_group}</span></>}
                            </div>
                            {visit?.notes && (
                              <p className="text-xs text-muted-foreground mt-2 italic bg-muted/30 rounded-lg px-2.5 py-1.5">{visit.notes}</p>
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
          {/* CARE PLANS TAB */}
          {activeTab === "tasklist" && (
            <NurseTasklist />
          )}

          {activeTab === "careplan" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-heading font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-chart-1" /> Nursing Care Plans ({carePlans.length})
                </h4>
                <button onClick={() => setShowCarePlan(true)} className="px-3 py-1.5 bg-chart-1/10 text-chart-1 rounded-lg text-xs font-medium hover:bg-chart-1/20 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> New Care Plan
                </button>
              </div>
              {carePlans.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No care plans created.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {carePlans.map(cp => (
                    <div key={cp.id} className="p-4 bg-muted/10 rounded-xl border border-border/40">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold">{cp.nursing_diagnosis}</p>
                          <p className="text-xs text-muted-foreground">{getPatientName(cp.patient_id)} · {new Date(cp.plan_date || cp.created_date).toLocaleDateString("en-GB")}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          cp.status === "active" ? "bg-chart-3/10 text-chart-3" :
                          cp.status === "reviewed" ? "bg-chart-1/10 text-chart-1" : "bg-muted text-muted-foreground"
                        }`}>{cp.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {cp.goals && <p><strong>Goals:</strong> {cp.goals}</p>}
                        {cp.interventions && <p><strong>Interventions:</strong> {cp.interventions}</p>}
                        {cp.fall_risk && <p><strong>Fall Risk:</strong> <span className={cp.fall_risk === "high" ? "text-destructive font-bold" : "text-muted-foreground"}>{cp.fall_risk}</span></p>}
                        {cp.pressure_ulcer_risk && <p><strong>PU Risk:</strong> <span className={cp.pressure_ulcer_risk === "high" ? "text-destructive font-bold" : "text-muted-foreground"}>{cp.pressure_ulcer_risk}</span></p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showCarePlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setShowCarePlan(false)} />
                  <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
                    <h3 className="font-heading text-lg font-semibold mb-4">New Nursing Care Plan</h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!carePlanForm.patient_id || !carePlanForm.nursing_diagnosis) return;
                      await base44.entities.NursingCarePlan.create({
                        ...carePlanForm,
                        plan_date: new Date().toISOString(),
                        fluid_balance_target_ml: Number(carePlanForm.fluid_balance_target_ml) || 0,
                        status: "active",
                      });
                      const plans = await base44.entities.NursingCarePlan.filter({ status: "active" }, "-created_date", 30);
                      setCarePlans(plans);
                      setShowCarePlan(false);
                    }} className="space-y-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Patient *</label>
                        <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={carePlanForm.patient_id} onChange={e => setCarePlanForm({...carePlanForm, patient_id: e.target.value})}>
                          <option value="">Select patient</option>
                          {[...triageQueue, ...activePatients].map(j => (
                            <option key={j.patient_id} value={j.patient_id}>{getPatientName(j.patient_id)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Nursing Diagnosis (NANDA-I) *</label>
                        <input required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={carePlanForm.nursing_diagnosis} onChange={e => setCarePlanForm({...carePlanForm, nursing_diagnosis: e.target.value})} placeholder="e.g. Impaired Mobility, Risk for Infection" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Goals / Expected Outcomes</label>
                          <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} value={carePlanForm.goals} onChange={e => setCarePlanForm({...carePlanForm, goals: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Nursing Interventions (NIC)</label>
                          <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} value={carePlanForm.interventions} onChange={e => setCarePlanForm({...carePlanForm, interventions: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Fall Risk</label>
                          <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={carePlanForm.fall_risk} onChange={e => setCarePlanForm({...carePlanForm, fall_risk: e.target.value})}>
                            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Pressure Ulcer Risk</label>
                          <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={carePlanForm.pressure_ulcer_risk} onChange={e => setCarePlanForm({...carePlanForm, pressure_ulcer_risk: e.target.value})}>
                            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Mobility</label>
                          <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={carePlanForm.mobility_assistance} onChange={e => setCarePlanForm({...carePlanForm, mobility_assistance: e.target.value})}>
                            <option value="independent">Independent</option><option value="assisted">Assisted</option><option value="bed_rest">Bed Rest</option><option value="wheelchair">Wheelchair</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Positioning Schedule</label>
                          <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={carePlanForm.positioning_schedule} onChange={e => setCarePlanForm({...carePlanForm, positioning_schedule: e.target.value})}>
                            <option value="q2h">Every 2 hours</option><option value="q4h">Every 4 hours</option><option value="q8h">Every 8 hours</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Diet Plan</label>
                          <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={carePlanForm.diet_plan} onChange={e => setCarePlanForm({...carePlanForm, diet_plan: e.target.value})} placeholder="e.g. Low salt, diabetic" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Fluid Target (mL)</label>
                          <input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={carePlanForm.fluid_balance_target_ml} onChange={e => setCarePlanForm({...carePlanForm, fluid_balance_target_ml: e.target.value})} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Pain Management</label>
                        <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={carePlanForm.pain_management_plan} onChange={e => setCarePlanForm({...carePlanForm, pain_management_plan: e.target.value})} />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="submit" className="flex-1 px-4 py-2.5 bg-chart-1 text-white rounded-lg text-sm font-medium"><Save className="w-3.5 h-3.5 inline mr-1" /> Create Plan</button>
                        <button type="button" onClick={() => setShowCarePlan(false)} className="px-4 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Waste Log Modal */}
      {showWasteLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowWasteLog(false)} />
          <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-sm mx-4">
            <h3 className="font-heading text-lg font-semibold mb-4">Log Waste (Nursing)</h3>
            <form onSubmit={handleLogWaste} className="space-y-3">
              <div><label className="block text-xs text-muted-foreground mb-1">Category *</label>
                <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={wasteForm.waste_category_id} onChange={e => setWasteForm({...wasteForm, waste_category_id: e.target.value})}>
                  <option value="">Select</option>
                  {wasteCategories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">Weight (kg)</label><input type="number" step="0.1" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={wasteForm.quantity_kg} onChange={e => setWasteForm({...wasteForm, quantity_kg: e.target.value})} /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">Containers</label><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={wasteForm.container_count} onChange={e => setWasteForm({...wasteForm, container_count: e.target.value})} /></div>
              </div>
              <div><label className="block text-xs text-muted-foreground mb-1">Notes</label><textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} value={wasteForm.notes} onChange={e => setWasteForm({...wasteForm, notes: e.target.value})} /></div>
              <div className="flex gap-3 pt-2"><button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Save className="w-3 h-3 inline mr-1" /> Save</button><button type="button" onClick={() => setShowWasteLog(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}