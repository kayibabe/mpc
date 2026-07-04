import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Stethoscope, Heart, FileText, Pill, Plus, Save, AlertTriangle, ShieldAlert, FlaskConical, ArrowRight, CheckCircle, GitBranch, PenTool, ArrowRightLeft, Clock, FileBadge, FileWarning, Zap, Scissors, Beaker } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import TemplateSelector from "@/components/TemplateSelector";
import VitalSignsChart from "@/components/VitalSignsChart";
import PatientJourneyTimeline from "@/components/PatientJourneyTimeline";
import DepartmentDashboard from "@/components/DepartmentDashboard";
import RealTimeVitals from "@/components/RealTimeVitals";
import SignaturePad from "@/components/SignaturePad";
import SignatureStatus from "@/components/SignatureStatus";
import ClinicalQuickNav from "@/components/ClinicalQuickNav";
import ClinicalQuickActions from "@/components/ClinicalQuickActions";
import DischargeSummaryTemplate from "@/components/DischargeSummaryTemplate";
import PageHeader from "@/components/ui/PageHeader";

export default function Clinical() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [vitals, setVitals] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [vitalForm, setVitalForm] = useState({ bp_systolic: "", bp_diastolic: "", heart_rate: "", respiratory_rate: "", temperature: "", spo2: "", weight: "", height: "", glucose: "", pain_score: "" });
  const [consultForm, setConsultForm] = useState({ chief_complaint: "", history_present_illness: "", physical_examination: "", assessment: "", plan: "", clinical_notes: "" });
  const [diagnosisForm, setDiagnosisForm] = useState({ diagnosis_name: "", icd10_code: "", type: "primary" });
  const [prescForm, setPrescForm] = useState({ items: [{ drug_name: "", dosage: "", frequency: "", duration: "", route: "", quantity: "", instructions: "" }] });
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vitals");
  const [cdsWarnings, setCdsWarnings] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
  const [journey, setJourney] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [handovers, setHandovers] = useState([]);
  const [deathCerts, setDeathCerts] = useState([]);
  const [deathForm, setDeathForm] = useState({
    date_of_death: "", time_of_death: "", cause_of_death_immediate: "",
    cause_of_death_underlying: "", cause_of_death_contributing: "", icd10_code: "",
    manner_of_death: "natural", place_of_death: "ward", maternal_death: false,
    neonatal_death: false, autopsy_requested: false, notes: "",
  });
  const [showDeathForm, setShowDeathForm] = useState(false);
  const [showDischargeSummary, setShowDischargeSummary] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null); // { name, category }

  // Signature state
  const [signingDoc, setSigningDoc] = useState(null); // { document_type, document_id }
  const [savingSignature, setSavingSignature] = useState(false);
  const [lastSavedDocId, setLastSavedDocId] = useState(null);

  // Consultation overwrite confirmation
  const [consultConfirmOpen, setConsultConfirmOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [v, p] = await Promise.all([
          base44.entities.Visit.list("-created_date", 100),
          base44.entities.Patient.list("-created_date", 200),
        ]);
        setVisits(v);
        setPatients(p);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const selectVisit = async (visit) => {
    setSelectedVisit(visit);
    setCdsWarnings([]);
    try {
      // First batch: visit-specific data (3 calls)
      const [vList, cList, pList] = await Promise.all([
        base44.entities.VitalSigns.filter({ visit_id: visit.id }, "-created_date", 10),
        base44.entities.Consultation.filter({ visit_id: visit.id }, "-created_date", 10),
        base44.entities.Prescription.filter({ visit_id: visit.id }, "-created_date", 10),
      ]);
      setVitals(vList[0] || null);
      setConsultations(cList);
      setPrescriptions(pList);

      // Second batch: patient-wide data (2 calls)
      const [dList, lList] = await Promise.all([
        base44.entities.Diagnosis.filter({ visit_id: visit.id }, "-created_date", 20),
        base44.entities.LabOrder.filter({ patient_id: visit.patient_id }, "-created_date", 30),
      ]);
      setDiagnoses(dList);
      setLabOrders(lList);

      // Third batch: journey and handovers (2 calls)
      const [jList] = await Promise.all([
        base44.entities.PatientJourney.filter({ visit_id: visit.id, status: "active" }, "-created_date", 1),
        loadPatientHandovers(visit.patient_id),
      ]);
      setJourney(jList[0] || null);

      // Load death certificates separately
      const dcs = await base44.entities.DeathCertificate.filter({ patient_id: visit.patient_id }, "-created_date", 10);
      setDeathCerts(dcs);

      // Run CDS checks
      runCdsChecks(visit, dList, lList);
    } catch (e) {
      console.error("Error loading visit data:", e);
    }
  };

  const getPatientName = (pid) => {
    const p = patients.find(pt => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const saveVitals = async () => {
    if (!selectedVisit) return;
    const data = {
      visit_id: selectedVisit.id, patient_id: selectedVisit.patient_id,
      bp_systolic: Number(vitalForm.bp_systolic) || 0, bp_diastolic: Number(vitalForm.bp_diastolic) || 0,
      heart_rate: Number(vitalForm.heart_rate) || 0, respiratory_rate: Number(vitalForm.respiratory_rate) || 0,
      temperature: Number(vitalForm.temperature) || 0, spo2: Number(vitalForm.spo2) || 0,
      weight: Number(vitalForm.weight) || 0, height: Number(vitalForm.height) || 0,
      glucose: Number(vitalForm.glucose) || 0, pain_score: Number(vitalForm.pain_score) || 0,
      recorded_date: new Date().toISOString(),
    };
    if (vitals) {
      await base44.entities.VitalSigns.update(vitals.id, data);
    } else {
      await base44.entities.VitalSigns.create(data);
    }
    const v = await base44.entities.VitalSigns.filter({ visit_id: selectedVisit.id }, "-created_date", 10);
    setVitals(v[0] || null);
  };

  const saveConsultation = async () => {
    if (!selectedVisit) return;

    // Enforce single active consultation per visit
    const existingDrafts = consultations.filter(c => c.is_draft === true || c.status === "in_progress");
    if (existingDrafts.length > 0) {
      setConsultConfirmOpen(true);
      return;
    }
    await doSaveConsultation();
  };

  const doSaveConsultation = async () => {
    if (!selectedVisit) return;

    const consultation = await base44.entities.Consultation.create({
      visit_id: selectedVisit.id, patient_id: selectedVisit.patient_id,
      ...consultForm, consultation_date: new Date().toISOString(), is_draft: true,
    });
    // Save diagnosis if name provided
    if (diagnosisForm.diagnosis_name.trim()) {
      await base44.entities.Diagnosis.create({
        consultation_id: consultation.id,
        visit_id: selectedVisit.id,
        patient_id: selectedVisit.patient_id,
        diagnosis_name: diagnosisForm.diagnosis_name,
        icd10_code: diagnosisForm.icd10_code,
        type: diagnosisForm.type,
        diagnosis_date: new Date().toISOString(),
      });
      setDiagnosisForm({ diagnosis_name: "", icd10_code: "", type: "primary" });
    }
    setConsultForm({ chief_complaint: "", history_present_illness: "", physical_examination: "", assessment: "", plan: "", clinical_notes: "" });
    const [c, d] = await Promise.all([
      base44.entities.Consultation.filter({ visit_id: selectedVisit.id }, "-created_date", 10),
      base44.entities.Diagnosis.filter({ visit_id: selectedVisit.id }, "-created_date", 20),
    ]);
    setConsultations(c);
    setDiagnoses(d);
    // Update queue status
    await base44.entities.Visit.update(selectedVisit.id, { queue_status: "in_consultation" });
    // Mark previous drafts as completed when new one created
    for (const draft of c.filter(con => con.is_draft && con.id !== consultation.id)) {
      await base44.entities.Consultation.update(draft.id, { is_draft: false, status: "completed" });
    }
    // Trigger signature capture
    setSigningDoc({ document_type: "consultation", document_id: consultation.id });
  };

  const loadPatientHandovers = async (patientId) => {
    try {
      const allHandovers = await base44.entities.DoctorHandover.list("-created_date", 100);
      const relevant = allHandovers.filter(h => {
        if (!h.linked_patient_ids) return false;
        try {
          const ids = JSON.parse(h.linked_patient_ids);
          return ids.includes(patientId);
        } catch { return false; }
      });
      // Also check active_patients JSON for older records
      const fromLegacy = allHandovers.filter(h => {
        if (h.linked_patient_ids) return false; // already caught above
        try {
          const ap = JSON.parse(h.active_patients || "[]");
          return ap.some(p => p.patient_id === patientId);
        } catch { return false; }
      });
      setHandovers([...relevant, ...fromLegacy]);
    } catch { setHandovers([]); }
  };

  const transitionWorkflow = async (nextStage, notes = "") => {
    if (!journey) return;
    setTransitioning(true);
    try {
      await base44.functions.invoke('handleWorkflowStageChange', {
        journey_id: journey.id,
        next_stage: nextStage,
        notes: notes,
      });
      const updated = await base44.entities.PatientJourney.get(journey.id);
      setJourney(updated);
      // Refresh visit queue status
      const v = await base44.entities.Visit.get(selectedVisit.id);
      setSelectedVisit(v);
    } catch (e) {
      console.error(e);
      alert("Workflow transition failed: " + (e.response?.data?.error || e.message));
    } finally {
      setTransitioning(false);
    }
  };

  // ── Clinical Decision Support Engine ──
  const runCdsChecks = (visit, diags, labs) => {
    const warnings = [];
    const allDiagnoses = diags.map(d => d.diagnosis_name?.toLowerCase() || "");

    // Malaria CDS: Check for malaria diagnosis without positive lab confirmation
    const hasMalariaDiagnosis = allDiagnoses.some(d => d.includes("malaria"));
    if (hasMalariaDiagnosis) {
      const malariaLabOrders = labs.filter(l => {
        const tests = (l.tests || "").toLowerCase();
        return tests.includes("malaria") || tests.includes("rdt") || tests.includes("microscopy") || tests.includes("mps") || tests.includes("blood slide");
      });
      // Same positive-result predicate as the save-time gate below (audit N11):
      // a completed-but-negative test must NOT satisfy the malaria protocol.
      const positiveLab = malariaLabOrders.find(l =>
        (l.status === "completed" || l.status === "verified") &&
        (l.result?.toLowerCase()?.includes("positive") || l.result_value?.includes("+") || l.result?.toLowerCase()?.includes("+"))
      );

      if (!positiveLab) {
        warnings.push({
          type: "malaria_lab",
          severity: "error",
          message: "MoH Protocol: Malaria diagnosis requires parasitological confirmation (RDT or Microscopy). Order lab test before prescribing antimalarials.",
        });
      }
    }

    // Severe malaria alert
    const hasSevereDiagnosis = allDiagnoses.some(d => d.includes("severe") && d.includes("malaria"));
    if (hasSevereDiagnosis) {
      warnings.push({
        type: "severe_malaria",
        severity: "error",
        message: "Severe Malaria Protocol: IV Artesunate required. Consider immediate referral if ICU not available. Per Malawi NMCP — do not use oral ACT.",
      });
    }

    // Pregnancy + malaria safety
    if (hasMalariaDiagnosis && visit?.visit_type === "anc") {
      warnings.push({
        type: "pregnancy_malaria",
        severity: "warning",
        message: "ANC Patient: Quinine in 1st trimester. Artemether-Lumefantrine (AL) safe in 2nd/3rd trimester per Malawi MSTG.",
      });
    }

    setCdsWarnings(warnings);
  };

  // CDS-aware prescription save
  const savePrescription = async () => {
  if (!selectedVisit) return;

  // ── Drug Safety Check (Check allergies first) ──
  try {
    // Check patient allergies
    const allergies = await base44.entities.PatientAllergy.filter({ patient_id: selectedVisit.patient_id }, "", 50);
    const allergyNames = allergies.map(a => a.allergen?.toLowerCase() || "");
    const allergyConflicts = prescForm.items.filter(item => {
      const drugName = item.drug_name?.toLowerCase() || "";
      return allergyNames.some(a => drugName.includes(a) || a.includes(drugName.split(" ")[0]));
    });
    if (allergyConflicts.length > 0) {
      alert(`⚠️ ALLERGY ALERT\n\nPatient has known allergies to:\n${allergies.map(a => `• ${a.allergen}`).join("\n")}\n\nCannot prescribe: ${allergyConflicts.map(a => a.drug_name).join(", ")}`);
      return;
    }

    const { data: safety } = await base44.functions.invoke("checkDrugSafety", {
      patient_id: selectedVisit.patient_id,
      drugs: prescForm.items.map(i => ({ drug_name: i.drug_name, generic_name: i.drug_name, category: "" })),
    });
    if (!safety.safe) {
      const criticalWarnings = safety.warnings.filter(w => w.severity === "contraindicated");
      if (criticalWarnings.length > 0) {
        alert(`⚠️ CANNOT PROCEED — CONTRAINDICATED COMBINATIONS\n\nThese drug combinations violate safety protocols and CANNOT be prescribed:\n\n${criticalWarnings.map(w => w.message).join("\n\n")}\n\nPlease adjust your prescription.`);
        return; // Hard stop - do not proceed
      }
      const majorWarnings = safety.warnings.filter(w => w.severity === "major");
      if (majorWarnings.length > 0) {
        const proceed = confirm(`⚠️ DRUG SAFETY — MAJOR INTERACTIONS\n\n${majorWarnings.map(w => w.message).join("\n\n")}\n\nPrescribe anyway with caution?`);
        if (!proceed) return;
      }
    }
  } catch (e) {
    console.error("Drug safety check failed:", e);
    const proceed = confirm("⚠️ DRUG SAFETY CHECK UNAVAILABLE\n\nThe drug safety check service is unavailable. Prescribing without safety verification is NOT recommended.\n\nProceed anyway?");
    if (!proceed) return;
  }

    { // Always run malaria CDS check for any prescription
      const [diags, labs] = await Promise.all([
        base44.entities.Diagnosis.filter({ visit_id: selectedVisit.id }, "-created_date", 20),
        base44.entities.LabOrder.filter({ patient_id: selectedVisit.patient_id }, "-created_date", 30),
      ]);
      const allDiagnoses = diags.map(d => d.diagnosis_name?.toLowerCase() || "");
      const hasMalariaDiagnosis = allDiagnoses.some(d => d.includes("malaria"));
      if (hasMalariaDiagnosis) {
        const malariaLabOrders = labs.filter(l => {
          const tests = (l.tests || "").toLowerCase();
          return tests.includes("malaria") || tests.includes("rdt") || tests.includes("microscopy") || tests.includes("mps") || tests.includes("blood slide");
        });
        const positiveLab = malariaLabOrders.find(l =>
          (l.status === "completed" || l.status === "verified") &&
          (l.result?.toLowerCase()?.includes("positive") || l.result_value?.includes("+") || l.result?.toLowerCase()?.includes("+"))
        );
        if (!positiveLab) {
          alert("⚠️ MoH Clinical Decision Support\n\nCannot prescribe antimalarials without a positive malaria test (RDT/Microscopy).\n\nPlease order a Malaria test from the Lab module first.\n\nThis follows the Malawi Test-Treat-Track protocol.");
          return;
        }
      }
    }

    const presc = await base44.entities.Prescription.create({
      visit_id: selectedVisit.id, patient_id: selectedVisit.patient_id,
      status: "pending", prescription_date: new Date().toISOString(),
    });
    for (const item of prescForm.items) {
      if (item.drug_name && item.quantity) {
        await base44.entities.PrescriptionItem.create({ prescription_id: presc.id, ...item, quantity: Number(item.quantity) });
      }
    }
    setPrescForm({ items: [{ drug_name: "", dosage: "", frequency: "", duration: "", route: "", quantity: "", instructions: "" }] });
    const p = await base44.entities.Prescription.filter({ visit_id: selectedVisit.id }, "-created_date", 10);
    setPrescriptions(p);
    // Trigger signature capture
    setSigningDoc({ document_type: "prescription", document_id: presc.id });
  };

  const addPrescItem = () => setPrescForm({ items: [...prescForm.items, { drug_name: "", dosage: "", frequency: "", duration: "", route: "", quantity: "", instructions: "" }] });

  // ── Digital Signature ──
  const handleSaveSignature = async (file) => {
    if (!signingDoc) return;
    setSavingSignature(true);
    try {
      // Upload the signature image first
      const { data: uploadData } = await base44.integrations.Core.UploadFile({ file });
      // Create the signature record
      await base44.functions.invoke("saveSignature", {
        file_url: uploadData.file_url,
        document_type: signingDoc.document_type,
        document_id: signingDoc.document_id,
        patient_id: selectedVisit?.patient_id || '',
        visit_id: selectedVisit?.id || '',
      });
      setLastSavedDocId(signingDoc.document_id);
      setSigningDoc(null);
    } catch (e) {
      console.error('Signature save failed:', e);
    } finally {
      setSavingSignature(false);
    }
  };

  const applyTemplate = ({ consultData, prescriptions, diagnosis, icd10, treatmentPlan }) => {
    setActiveTemplate({ name: diagnosis || "Template Applied", category: "general" });
    setConsultForm(consultData);
    if (diagnosis) setDiagnosisForm({ diagnosis_name: diagnosis, icd10_code: icd10 || "", type: "primary" });
    if (prescriptions && prescriptions.length > 0) {
      setPrescForm({ items: prescriptions.map(p => ({
        drug_name: p.drug_name || "",
        dosage: p.dosage || "",
        frequency: p.frequency || "",
        duration: p.duration || "",
        route: p.route || "",
        quantity: String(p.quantity || ""),
        instructions: p.instructions || "",
      }))});
    }
    setActiveTab("consultation");
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Clinical" subtitle="Consultations, vitals, prescriptions & decision support" icon={Stethoscope} />
      <div className="mb-6">
        <DepartmentDashboard department="clinical" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visit List */}
        <div className="bg-white rounded-lg border border-border">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold">Patient Queue</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{visits.length}</span>
          </div>
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {visits.map(v => {
              const priority = v.priority;
              return (
                <button key={v.id} onClick={() => selectVisit(v)} className={`w-full text-left p-3 hover:bg-muted/40 transition-colors border-l-2 ${selectedVisit?.id === v.id ? "bg-primary/5 border-l-primary" : priority === "emergency" ? "border-l-triage-emergency" : priority === "urgent" ? "border-l-triage-urgent" : "border-l-transparent"}`}>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium truncate">{getPatientName(v.patient_id)}</p>
                    {priority === "emergency" && <span className="text-[9px] font-bold text-triage-emergency bg-triage-emergency/10 px-1 rounded flex-shrink-0">EMRG</span>}
                    {priority === "urgent" && <span className="text-[9px] font-bold text-triage-urgent bg-triage-urgent/10 px-1 rounded flex-shrink-0">URG</span>}
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">{v.visit_type} · {v.queue_status?.replace(/_/g, " ")}</p>
                </button>
              );
            })}
            {visits.length === 0 && <p className="p-4 text-sm text-muted-foreground">No visits.</p>}
          </div>
        </div>

        {/* Clinical Workspace */}
        <div className="lg:col-span-2">
          {!selectedVisit ? (
            <div className="bg-card rounded-xl border border-border/60 shadow-sm p-12 text-center">
              <Stethoscope className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Select a patient from the queue to begin.</p>
            </div>
          ) : (
           <div className="bg-white rounded-lg border border-border">
             <div className="border-b border-border flex overflow-x-auto scrollbar-none">
               {["vitals", "consultation", "prescriptions", "handovers", "signatures", "death"].map(tab => (
                 <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors capitalize flex-shrink-0 ${activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>{tab}</button>
               ))}
               <button onClick={() => setShowDischargeSummary(true)} className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-muted-foreground hover:text-primary ml-auto flex-shrink-0 flex items-center gap-1">
                 <FileText className="w-3.5 h-3.5" /> Discharge
               </button>
             </div>
             {/* Two-column layout: context panel left, main workspace right */}
             <div className="flex gap-0 divide-x divide-border min-h-[600px]">
             {/* Left context panel — vitals snapshot + recent labs always visible */}
             <div className="w-56 flex-shrink-0 p-3 space-y-3 bg-muted/20 overflow-y-auto max-h-[700px]">
               {/* Vitals snapshot */}
               <div>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Latest Vitals</p>
                 {vitals ? (
                   <div className="space-y-1.5">
                     {[
                       { label: "BP", value: vitals.bp_systolic && vitals.bp_diastolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : null, unit: "mmHg", warn: vitals.bp_systolic > 140 },
                       { label: "HR", value: vitals.heart_rate, unit: "bpm", warn: vitals.heart_rate > 100 || vitals.heart_rate < 60 },
                       { label: "Temp", value: vitals.temperature, unit: "°C", warn: vitals.temperature > 38 },
                       { label: "SpO₂", value: vitals.spo2, unit: "%", warn: vitals.spo2 < 95 },
                       { label: "RR", value: vitals.respiratory_rate, unit: "/min", warn: vitals.respiratory_rate > 20 },
                       { label: "Weight", value: vitals.weight, unit: "kg", warn: false },
                       { label: "Glucose", value: vitals.glucose, unit: "mmol/L", warn: vitals.glucose > 11 },
                       { label: "Pain", value: vitals.pain_score, unit: "/10", warn: vitals.pain_score >= 7 },
                     ].filter(v => v.value != null && v.value !== 0).map(v => (
                       <div key={v.label} className={`flex items-center justify-between px-2 py-1 rounded text-xs ${v.warn ? "bg-triage-urgent/10 border border-triage-urgent/20" : "bg-background border border-border/40"}`}>
                         <span className="text-muted-foreground font-medium">{v.label}</span>
                         <span className={`font-bold font-mono ${v.warn ? "text-triage-urgent" : "text-foreground"}`}>{v.value}<span className="text-[9px] text-muted-foreground ml-0.5">{v.unit}</span></span>
                       </div>
                     ))}
                     <p className="text-[9px] text-muted-foreground text-right">{new Date(vitals.created_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                   </div>
                 ) : (
                   <p className="text-[11px] text-muted-foreground italic">No vitals recorded</p>
                 )}
               </div>

               {/* Active diagnoses */}
               {diagnoses.length > 0 && (
                 <div>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Diagnoses</p>
                   <div className="space-y-1">
                     {diagnoses.map(d => (
                       <div key={d.id} className="px-2 py-1 rounded bg-chart-3/10 border border-chart-3/20 text-xs">
                         <p className="font-medium text-chart-3 leading-tight">{d.diagnosis_name}</p>
                         {d.icd10_code && <p className="text-[9px] text-muted-foreground">{d.icd10_code}</p>}
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               {/* Recent lab orders */}
               {labOrders.length > 0 && (
                 <div>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Labs</p>
                   <div className="space-y-1">
                     {labOrders.slice(0, 5).map(lo => (
                       <div key={lo.id} className="px-2 py-1 rounded bg-background border border-border/40 text-xs">
                         <p className="font-medium leading-tight truncate">{(lo.tests || "").replace(/[\[\]"]/g, "").split(",")[0]}</p>
                         <span className={`text-[9px] font-medium ${lo.status === "completed" || lo.status === "verified" ? "text-chart-3" : lo.status === "in_progress" ? "text-primary" : "text-muted-foreground"}`}>{lo.status}</span>
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               {/* Journey stage */}
               {journey && (
                 <div>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Stage</p>
                   <div className="px-2 py-1.5 rounded bg-primary/10 border border-primary/20 text-xs text-center font-semibold text-primary">
                     {journey.current_stage?.replace(/_/g, " ")}
                   </div>
                 </div>
               )}
             </div>

             {/* Right main workspace */}
             <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[700px]">
               <ClinicalQuickActions onTabChange={setActiveTab} />
               <ClinicalQuickNav activeTab={activeTab} onTabChange={setActiveTab} />
                {/* Patient Journey Timeline */}
                {journey && (
                  <div className="mb-4">
                    <PatientJourneyTimeline journeyId={journey.id} compact />
                  </div>
                )}

                {/* Workflow Stage Bar */}
                {journey && (
                  <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground">Current Stage:</span>
                        <span className="text-sm font-semibold text-primary">{journey.current_stage?.replace(/_/g, " ")}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => transitionWorkflow("PHARMACY_PENDING", "Prescription issued")}
                          disabled={transitioning}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-chart-2/10 text-chart-2 rounded-md text-xs font-medium hover:bg-chart-2/20 disabled:opacity-50"
                        >
                          <Pill className="w-3 h-3" /> Send to Pharmacy
                        </button>
                        <button
                          onClick={() => transitionWorkflow("LAB_PENDING", "Lab tests ordered")}
                          disabled={transitioning}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-chart-3/10 text-chart-3 rounded-md text-xs font-medium hover:bg-chart-3/20 disabled:opacity-50"
                        >
                          <FlaskConical className="w-3 h-3" /> Send to Lab
                        </button>
                        <button
                          onClick={async () => {
                            if (!selectedVisit) return;
                            try {
                              // Check for existing pending orders for same diagnoses
                              const existingOrders = labOrders.filter(lo => lo.status === "pending" || lo.status === "ordered");
                              const diagnosisNames = diagnoses.map(d => d.diagnosis_name);
                              const duplicates = existingOrders.filter(lo => {
                                const loTests = (lo.tests || "").toLowerCase();
                                return diagnosisNames.some(dn => loTests.includes(dn.toLowerCase()));
                              });
                              
                              if (duplicates.length > 0) {
                                const proceed = confirm(`⚠️ ${duplicates.length} pending lab order(s) already exist for these diagnoses.\n\nCreate additional orders anyway?`);
                                if (!proceed) return;
                              }

                              const { data } = await base44.functions.invoke("autoGenerateLabOrders", {
                                visit_id: selectedVisit.id,
                                patient_id: selectedVisit.patient_id,
                                diagnoses: diagnosisNames,
                              });
                              alert(`✅ ${data.orders_created} lab order(s) generated.\n\n${data.orders.map(o => `• ${o.diagnosis}: ${o.tests.join(", ")}`).join("\n")}`);
                              // Refresh lab orders
                              const lList = await base44.entities.LabOrder.filter({ patient_id: selectedVisit.patient_id }, "-created_date", 30);
                              setLabOrders(lList);
                            } catch (e) {
                              alert("Lab order generation failed: " + (e.response?.data?.error || e.message));
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-chart-4/10 text-chart-4 rounded-md text-xs font-medium hover:bg-chart-4/20"
                        >
                          <Beaker className="w-3 h-3" /> Auto-Generate Labs
                        </button>
                        <button
                          onClick={() => transitionWorkflow("BILLING", "Consultation complete")}
                          disabled={transitioning}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium hover:bg-primary/20 disabled:opacity-50"
                        >
                          <ArrowRight className="w-3 h-3" /> Send to Billing
                        </button>
                        <button
                          onClick={() => transitionWorkflow("COMPLETED", "Visit completed")}
                          disabled={transitioning}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-chart-3/10 text-chart-3 rounded-md text-xs font-medium hover:bg-chart-3/20 disabled:opacity-50"
                        >
                          <CheckCircle className="w-3 h-3" /> Complete
                        </button>
                        <button
                          onClick={() => navigate(`/surgery-calendar?patient=${selectedVisit.patient_id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-chart-5/10 text-chart-5 rounded-md text-xs font-medium hover:bg-chart-5/20"
                        >
                          <Scissors className="w-3 h-3" /> Book Surgery
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* CDS Warning Banner */}
                {cdsWarnings.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {cdsWarnings.map((w, i) => (
                      <div key={i} className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                        w.severity === "error" ? "bg-destructive/5 border-destructive/30" : "bg-chart-2/5 border-chart-2/30"
                      }`}>
                        {w.severity === "error" ? <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-chart-2 mt-0.5 shrink-0" />}
                        <div>
                          <p className={`text-xs font-semibold ${w.severity === "error" ? "text-destructive" : "text-chart-2"}`}>{w.message}</p>
                          {w.detail && <p className="text-xs text-muted-foreground mt-0.5">{w.detail}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "vitals" && (
                   <div className="space-y-4">
                    <div className="mb-4">
                      <RealTimeVitals compact />
                    </div>
                    <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><Heart className="w-4 h-4 text-destructive" /> Vital Signs</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "BP Systolic", key: "bp_systolic", unit: "mmHg" },
                        { label: "BP Diastolic", key: "bp_diastolic", unit: "mmHg" },
                        { label: "Heart Rate", key: "heart_rate", unit: "bpm" },
                        { label: "Resp. Rate", key: "respiratory_rate", unit: "/min" },
                        { label: "Temperature", key: "temperature", unit: "°C" },
                        { label: "SpO2", key: "spo2", unit: "%" },
                        { label: "Weight", key: "weight", unit: "kg" },
                        { label: "Height", key: "height", unit: "cm" },
                        { label: "Glucose", key: "glucose", unit: "mmol/L" },
                        { label: "Pain Score", key: "pain_score", unit: "0-10" },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="block text-xs text-muted-foreground mb-1">{f.label} ({f.unit})</label>
                          <input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={vitalForm[f.key]} onChange={e => setVitalForm({...vitalForm, [f.key]: e.target.value})} />
                        </div>
                      ))}
                    </div>
                    <button onClick={saveVitals} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"><Save className="w-4 h-4" /> Save Vitals</button>
                    {vitals && <p className="text-xs text-muted-foreground mt-2">Last recorded: {new Date(vitals.created_date).toLocaleString()}</p>}
                    {selectedVisit && <VitalSignsChart patientId={selectedVisit.patient_id} visitId={selectedVisit.id} />}
                  </div>
                )}

                {activeTab === "consultation" && (
                  <div>
                    <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Consultation Notes</h4>
                    <TemplateSelector onSelectTemplate={applyTemplate} />
                    {activeTemplate && (
                      <div className="mb-4 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-primary">
                          Template applied: <strong>{activeTemplate.name}</strong>
                        </span>
                        <button onClick={() => { setActiveTemplate(null); setConsultForm({ chief_complaint: "", history_present_illness: "", physical_examination: "", assessment: "", plan: "", clinical_notes: "" }); setDiagnosisForm({ diagnosis_name: "", icd10_code: "", type: "primary" }); setPrescForm({ items: [{ drug_name: "", dosage: "", frequency: "", duration: "", route: "", quantity: "", instructions: "" }] }); }} className="ml-auto text-[10px] text-muted-foreground hover:text-destructive">Clear</button>
                      </div>
                    )}
                    {diagnoses.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Diagnoses</p>
                        {diagnoses.map(d => (
                          <div key={d.id} className="p-3 bg-chart-3/5 border border-chart-3/20 rounded-lg mb-2">
                            <p className="text-sm font-medium">{d.diagnosis_name}</p>
                            <p className="text-xs text-muted-foreground">{d.icd10_code || "No ICD-10"} · <span className="capitalize">{d.type}</span></p>
                          </div>
                        ))}
                      </div>
                    )}
                    {consultations.map(c => (
                      <div key={c.id} className="mb-4 p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">{new Date(c.consultation_date).toLocaleString()}</p>
                          <SignatureStatus documentType="consultation" documentId={c.id} compact />
                        </div>
                        {c.chief_complaint && <div className="mb-2"><span className="text-xs font-medium text-muted-foreground">Chief Complaint:</span><p className="text-sm">{c.chief_complaint}</p></div>}
                        {c.assessment && <div className="mb-2"><span className="text-xs font-medium text-muted-foreground">Assessment:</span><p className="text-sm">{c.assessment}</p></div>}
                        {c.plan && <div className="mb-2"><span className="text-xs font-medium text-muted-foreground">Plan:</span><p className="text-sm">{c.plan}</p></div>}
                      </div>
                    ))}

                    {/* SOAP Notes Form — standardized structure */}
                    <div className="space-y-3">
                      {/* Diagnosis Section */}
                      <div className="p-4 bg-muted/20 rounded-lg border border-border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <FileBadge className="w-3.5 h-3.5" /> Diagnosis
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Diagnosis Name</label>
                            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={diagnosisForm.diagnosis_name} onChange={e => setDiagnosisForm({...diagnosisForm, diagnosis_name: e.target.value})} placeholder="e.g. Malaria" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">ICD-10 Code</label>
                            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={diagnosisForm.icd10_code} onChange={e => setDiagnosisForm({...diagnosisForm, icd10_code: e.target.value})} placeholder="e.g. B54" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
                            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={diagnosisForm.type} onChange={e => setDiagnosisForm({...diagnosisForm, type: e.target.value})}>
                              <option value="primary">Primary</option><option value="secondary">Secondary</option><option value="differential">Differential</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* S: Subjective */}
                      <div className="clinical-section space-y-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-chart-4/10 text-chart-4 flex items-center justify-center text-[10px] font-bold">S</span> Subjective
                        </h4>
                        <div className="space-y-2.5">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Chief Complaint <span className="text-clinical-critical">*</span></label>
                            <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} value={consultForm.chief_complaint} onChange={e => setConsultForm({...consultForm, chief_complaint: e.target.value})} placeholder="Patient's main concern in their own words..." />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">History of Present Illness</label>
                            <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={3} value={consultForm.history_present_illness} onChange={e => setConsultForm({...consultForm, history_present_illness: e.target.value})} placeholder="Onset, duration, severity, aggravating/relieving factors..." />
                          </div>
                        </div>
                      </div>

                      {/* O: Objective */}
                      <div className="clinical-section space-y-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-chart-3/10 text-chart-3 flex items-center justify-center text-[10px] font-bold">O</span> Objective
                        </h4>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Physical Examination</label>
                          <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={3} value={consultForm.physical_examination} onChange={e => setConsultForm({...consultForm, physical_examination: e.target.value})} placeholder="General appearance, vitals, system-specific findings, lab results..." />
                        </div>
                      </div>

                      {/* A: Assessment */}
                      <div className="clinical-section space-y-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-chart-2/10 text-chart-2 flex items-center justify-center text-[10px] font-bold">A</span> Assessment
                        </h4>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Clinical Assessment & Differential</label>
                          <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} value={consultForm.assessment} onChange={e => setConsultForm({...consultForm, assessment: e.target.value})} placeholder="Summary, differential diagnoses, clinical reasoning..." />
                        </div>
                      </div>

                      {/* P: Plan */}
                      <div className="clinical-section space-y-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">P</span> Plan
                        </h4>
                        <div className="space-y-2.5">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Treatment Plan <span className="text-clinical-critical">*</span></label>
                            <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} value={consultForm.plan} onChange={e => setConsultForm({...consultForm, plan: e.target.value})} placeholder="Medications, investigations, referrals, follow-up..." />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Additional Notes</label>
                            <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={3} value={consultForm.clinical_notes} onChange={e => setConsultForm({...consultForm, clinical_notes: e.target.value})} placeholder="Patient education, counselling, special instructions..." />
                          </div>
                        </div>
                      </div>
                    </div>
                    <button onClick={saveConsultation} className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm transition-colors"><Save className="w-4 h-4" /> Save Consultation Notes</button>
                  </div>
                )}

                {activeTab === "prescriptions" && (
                  <div>
                    <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><Pill className="w-4 h-4 text-chart-2" /> Prescriptions</h4>
                    {prescriptions.map(p => (
                      <div key={p.id} className="mb-3 p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Prescription — {new Date(p.created_date).toLocaleString()} — <span className="font-medium">{p.status}</span></p>
                          <SignatureStatus documentType="prescription" documentId={p.id} compact />
                        </div>
                      </div>
                    ))}
                    <div className="space-y-3">
                      {prescForm.items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border border-border rounded-lg">
                          <div><label className="block text-xs text-muted-foreground mb-0.5">Drug Name</label><input className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={item.drug_name} onChange={e => { const items = [...prescForm.items]; items[idx].drug_name = e.target.value; setPrescForm({ items }); }} /></div>
                          <div><label className="block text-xs text-muted-foreground mb-0.5">Dosage</label><input className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={item.dosage} onChange={e => { const items = [...prescForm.items]; items[idx].dosage = e.target.value; setPrescForm({ items }); }} /></div>
                          <div><label className="block text-xs text-muted-foreground mb-0.5">Frequency</label><input className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={item.frequency} onChange={e => { const items = [...prescForm.items]; items[idx].frequency = e.target.value; setPrescForm({ items }); }} /></div>
                          <div><label className="block text-xs text-muted-foreground mb-0.5">Qty</label><input type="number" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={item.quantity} onChange={e => { const items = [...prescForm.items]; items[idx].quantity = e.target.value; setPrescForm({ items }); }} /></div>
                          <div><label className="block text-xs text-muted-foreground mb-0.5">Duration</label><input className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={item.duration} onChange={e => { const items = [...prescForm.items]; items[idx].duration = e.target.value; setPrescForm({ items }); }} /></div>
                          <div><label className="block text-xs text-muted-foreground mb-0.5">Route</label><input className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={item.route} onChange={e => { const items = [...prescForm.items]; items[idx].route = e.target.value; setPrescForm({ items }); }} /></div>
                          <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-0.5">Instructions</label><input className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={item.instructions} onChange={e => { const items = [...prescForm.items]; items[idx].instructions = e.target.value; setPrescForm({ items }); }} /></div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 mt-3">
                      <button onClick={addPrescItem} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted"><Plus className="w-3 h-3 inline mr-1" /> Add Drug</button>
                      <button onClick={savePrescription} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"><Save className="w-3 h-3 inline mr-1" /> Save Prescription</button>
                    </div>
                  </div>
                )}

                {activeTab === "handovers" && (
                  <div>
                    <h4 className="font-heading font-semibold mb-4 flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-primary" /> Shift Handover History
                    </h4>
                    {handovers.length === 0 ? (
                      <div className="py-10 text-center">
                        <ArrowRightLeft className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No handover records for this patient.</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Handovers appear when included in a doctor's shift handover report.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {handovers.map(h => (
                          <div key={h.id} className={`p-4 rounded-lg border transition-all ${
                            h.acknowledged
                              ? "bg-clinical-normal/5 border-clinical-normal/20"
                              : "bg-chart-2/5 border-chart-2/20"
                          }`}>
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
                                  <span className="font-medium text-sm">
                                    {h.from_doctor_id?.slice(0, 8)} → {h.to_doctor_id?.slice(0, 8)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <FileBadge className="w-3 h-3" />
                                  <span className="capitalize">{h.shift_type}</span>
                                  <Clock className="w-3 h-3 ml-1" />
                                  {new Date(h.handover_date).toLocaleString("en-GB", {
                                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                                  })}
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                h.acknowledged
                                  ? "bg-clinical-normal/10 text-clinical-normal"
                                  : h.status === "escalated"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-chart-2/10 text-chart-2"
                              }`}>
                                {h.status}
                              </span>
                            </div>

                            {/* Relevant notes from this handover */}
                            <div className="space-y-1 text-xs">
                              {h.critical_cases && (
                                <p className="text-destructive flex items-start gap-1">
                                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span><strong>Critical:</strong> {h.critical_cases}</span>
                                </p>
                              )}
                              {h.treatment_updates && (
                                <p className="text-primary flex items-start gap-1">
                                  <Stethoscope className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span><strong>Updates:</strong> {h.treatment_updates}</span>
                                </p>
                              )}
                              {h.pending_investigations && (
                                <p className="text-chart-2 flex items-start gap-1">
                                  <FlaskConical className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span><strong>Pending:</strong> {h.pending_investigations}</span>
                                </p>
                              )}
                              {h.discharge_planning && (
                                <p className="text-chart-3 flex items-start gap-1">
                                  <CheckCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span><strong>Discharge:</strong> {h.discharge_planning}</span>
                                </p>
                              )}
                              {h.general_notes && (
                                <p className="text-muted-foreground"><strong>Notes:</strong> {h.general_notes}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "death" && (
                  <div>
                    <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><FileWarning className="w-4 h-4 text-destructive" /> Death Certification</h4>
                    {deathCerts.length > 0 && (
                      <div className="space-y-3 mb-4">
                        {deathCerts.map(dc => (
                          <div key={dc.id} className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-destructive">Death Certificate — {new Date(dc.certification_date || dc.created_date).toLocaleDateString("en-GB")}</p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dc.manner_of_death === "natural" ? "bg-muted" : "bg-destructive/10 text-destructive"}`}>{dc.manner_of_death}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <p><strong>Immediate:</strong> {dc.cause_of_death_immediate}</p>
                              {dc.cause_of_death_underlying && <p><strong>Underlying:</strong> {dc.cause_of_death_underlying}</p>}
                              {dc.icd10_code && <p><strong>ICD-10:</strong> {dc.icd10_code}</p>}
                              <p><strong>Date/Time:</strong> {dc.date_of_death} {dc.time_of_death || ""}</p>
                              <p><strong>Place:</strong> {dc.place_of_death}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setShowDeathForm(true)} className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/20 flex items-center gap-2">
                      <FileWarning className="w-4 h-4" /> Record Death Certificate
                    </button>
                    {showDeathForm && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeathForm(false)} />
                        <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
                          <h3 className="font-heading text-lg font-semibold mb-4">Death Certificate</h3>
                          <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!deathForm.date_of_death || !deathForm.cause_of_death_immediate) return;
                            const user = await base44.auth.me();
                            await base44.entities.DeathCertificate.create({
                              ...deathForm,
                              patient_id: selectedVisit.patient_id,
                              visit_id: selectedVisit.id,
                              certifying_doctor_id: user.id,
                              certifying_doctor_name: user.full_name,
                              certification_date: new Date().toISOString(),
                            });
                            const dcs = await base44.entities.DeathCertificate.filter({ patient_id: selectedVisit.patient_id }, "-created_date", 10);
                            setDeathCerts(dcs);
                            setShowDeathForm(false);
                            setDeathForm({ date_of_death: "", time_of_death: "", cause_of_death_immediate: "", cause_of_death_underlying: "", cause_of_death_contributing: "", icd10_code: "", manner_of_death: "natural", place_of_death: "ward", maternal_death: false, neonatal_death: false, autopsy_requested: false, notes: "" });
                          }} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div><label className="block text-xs text-muted-foreground mb-1">Date of Death *</label><input type="date" required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={deathForm.date_of_death} onChange={e => setDeathForm({...deathForm, date_of_death: e.target.value})} /></div>
                              <div><label className="block text-xs text-muted-foreground mb-1">Time of Death</label><input type="time" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={deathForm.time_of_death} onChange={e => setDeathForm({...deathForm, time_of_death: e.target.value})} /></div>
                              <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Immediate Cause *</label><input required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={deathForm.cause_of_death_immediate} onChange={e => setDeathForm({...deathForm, cause_of_death_immediate: e.target.value})} placeholder="e.g. Cerebral Malaria" /></div>
                              <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Underlying Cause</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={deathForm.cause_of_death_underlying} onChange={e => setDeathForm({...deathForm, cause_of_death_underlying: e.target.value})} /></div>
                              <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Contributing Conditions</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={deathForm.cause_of_death_contributing} onChange={e => setDeathForm({...deathForm, cause_of_death_contributing: e.target.value})} /></div>
                              <div><label className="block text-xs text-muted-foreground mb-1">ICD-10 Code</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={deathForm.icd10_code} onChange={e => setDeathForm({...deathForm, icd10_code: e.target.value})} /></div>
                              <div><label className="block text-xs text-muted-foreground mb-1">Manner</label><select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={deathForm.manner_of_death} onChange={e => setDeathForm({...deathForm, manner_of_death: e.target.value})}><option value="natural">Natural</option><option value="accident">Accident</option><option value="suicide">Suicide</option><option value="homicide">Homicide</option><option value="undetermined">Undetermined</option></select></div>
                              <div><label className="block text-xs text-muted-foreground mb-1">Place of Death</label><select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={deathForm.place_of_death} onChange={e => setDeathForm({...deathForm, place_of_death: e.target.value})}><option value="ward">Ward</option><option value="icu">ICU</option><option value="theatre">Theatre</option><option value="emergency">Emergency</option></select></div>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm">
                              <label className="flex items-center gap-2"><input type="checkbox" checked={deathForm.maternal_death} onChange={e => setDeathForm({...deathForm, maternal_death: e.target.checked})} /> Maternal Death</label>
                              <label className="flex items-center gap-2"><input type="checkbox" checked={deathForm.neonatal_death} onChange={e => setDeathForm({...deathForm, neonatal_death: e.target.checked})} /> Neonatal Death</label>
                              <label className="flex items-center gap-2"><input type="checkbox" checked={deathForm.autopsy_requested} onChange={e => setDeathForm({...deathForm, autopsy_requested: e.target.checked})} /> Autopsy Requested</label>
                            </div>
                            <div className="flex gap-3 pt-2">
                              <button type="submit" className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium"><FileWarning className="w-4 h-4 inline mr-1" /> Certify Death</button>
                              <button type="button" onClick={() => setShowDeathForm(false)} className="px-4 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "signatures" && (
                  <div>
                    <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><PenTool className="w-4 h-4 text-primary" /> Digital Signatures</h4>
                    <p className="text-xs text-muted-foreground mb-4">Verified audit trail for all clinical documents on this visit.</p>
                    {consultations.length === 0 && prescriptions.length === 0 ? (
                      <div className="py-8 text-center">
                        <PenTool className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No documents to sign yet.</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Signatures are captured when consultations and prescriptions are saved.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {consultations.map(c => (
                          <div key={`sig-c-${c.id}`} className="p-3 border border-border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">Consultation — {new Date(c.consultation_date).toLocaleString("en-GB")}</p>
                                <p className="text-xs text-muted-foreground">{c.assessment || c.chief_complaint || "No notes"}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <SignatureStatus documentType="consultation" documentId={c.id} />
                                {!signingDoc?.document_id || signingDoc?.document_id !== c.id ? (
                                  <button onClick={() => setSigningDoc({ document_type: "consultation", document_id: c.id })} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20 flex items-center gap-1">
                                    <PenTool className="w-3 h-3" /> Sign
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                        {prescriptions.map(p => (
                          <div key={`sig-p-${p.id}`} className="p-3 border border-border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">Prescription — {new Date(p.created_date).toLocaleString("en-GB")}</p>
                                <p className="text-xs text-muted-foreground">Status: {p.status}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <SignatureStatus documentType="prescription" documentId={p.id} />
                                {!signingDoc?.document_id || signingDoc?.document_id !== p.id ? (
                                  <button onClick={() => setSigningDoc({ document_type: "prescription", document_id: p.id })} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20 flex items-center gap-1">
                                    <PenTool className="w-3 h-3" /> Sign
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Discharge Summary Modal */}
                {showDischargeSummary && selectedVisit && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowDischargeSummary(false)} />
                    <div className="relative z-10 w-full max-w-2xl mx-4">
                      <DischargeSummaryTemplate
                        patientId={selectedVisit.patient_id}
                        visitId={selectedVisit.id}
                        patientName={getPatientName(selectedVisit.patient_id)}
                        onClose={() => setShowDischargeSummary(false)}
                      />
                    </div>
                  </div>
                )}

                {/* Signature Pad Modal */}
                {signingDoc && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setSigningDoc(null)} />
                    <div className="relative z-10 w-full max-w-lg mx-4">
                      <SignaturePad
                        title={`Sign ${signingDoc.document_type === "consultation" ? "Consultation" : "Prescription"}`}
                        onSave={handleSaveSignature}
                        onCancel={() => setSigningDoc(null)}
                        saving={savingSignature}
                      />
                    </div>
                  </div>
                )}
              </div>{/* end right main workspace */}
             </div>{/* end two-column flex */}
            </div>
          )}
        </div>
      </div>

      {/* Consultation overwrite confirmation */}
      <AlertDialog open={consultConfirmOpen} onOpenChange={setConsultConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Active Consultation Exists
            </AlertDialogTitle>
            <AlertDialogDescription>
              There is already an active consultation for this visit. Creating a new one will mark the previous as complete. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConsultConfirmOpen(false); doSaveConsultation(); }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}