import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Stethoscope, Heart, FileText, Pill, Activity, Plus, Save, Search, AlertTriangle, ShieldAlert, FlaskConical, ArrowRight, CheckCircle, GitBranch, PenTool } from "lucide-react";
import TemplateSelector from "@/components/TemplateSelector";
import VitalSignsChart from "@/components/VitalSignsChart";
import PatientJourneyTimeline from "@/components/PatientJourneyTimeline";
import DepartmentDashboard from "@/components/DepartmentDashboard";
import RealTimeVitals from "@/components/RealTimeVitals";
import SignaturePad from "@/components/SignaturePad";
import SignatureStatus from "@/components/SignatureStatus";

export default function Clinical() {
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

  // Signature state
  const [signingDoc, setSigningDoc] = useState(null); // { document_type, document_id }
  const [savingSignature, setSavingSignature] = useState(false);
  const [lastSavedDocId, setLastSavedDocId] = useState(null);

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
    const [vList, cList, pList, dList, lList, jList] = await Promise.all([
      base44.entities.VitalSigns.filter({ visit_id: visit.id }, "-created_date", 10),
      base44.entities.Consultation.filter({ visit_id: visit.id }, "-created_date", 10),
      base44.entities.Prescription.filter({ visit_id: visit.id }, "-created_date", 10),
      base44.entities.Diagnosis.filter({ visit_id: visit.id }, "-created_date", 20),
      base44.entities.LabOrder.filter({ patient_id: visit.patient_id }, "-created_date", 30),
      base44.entities.PatientJourney.filter({ visit_id: visit.id, status: "active" }, "-created_date", 1),
    ]);
    setVitals(vList[0] || null);
    setConsultations(cList);
    setPrescriptions(pList);
    setDiagnoses(dList);
    setLabOrders(lList);
    setJourney(jList[0] || null);
    // Run CDS checks
    runCdsChecks(visit, dList, lList);
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
    const consultation = await base44.entities.Consultation.create({
      visit_id: selectedVisit.id, patient_id: selectedVisit.patient_id,
      ...consultForm, consultation_date: new Date().toISOString(),
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
    // Trigger signature capture
    setSigningDoc({ document_type: "consultation", document_id: consultation.id });
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
      const positiveLab = malariaLabOrders.find(l => l.status === "completed" || l.status === "verified");

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
    const prescribedDrugs = prescForm.items.map(i => i.drug_name?.toLowerCase() || "");
    const actDrugs = ["artemether", "lumefantrine", "artesunate", "coartem", "al", "quinine", "artemether-lumefantrine"];
    const isPrescribingAct = prescribedDrugs.some(d => actDrugs.some(act => d.includes(act)));

    if (isPrescribingAct) {
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
        const positiveLab = malariaLabOrders.find(l => l.status === "completed" || l.status === "verified");
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

  const applyTemplate = ({ consultData, prescriptions, diagnosis, icd10 }) => {
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
    <div className="page-container">
      <h2 className="section-title mb-6">Clinical</h2>
      <div className="mb-6">
        <DepartmentDashboard department="clinical" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visit List */}
        <div className="bg-card rounded-xl border border-border/60 shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="font-heading font-semibold">Waiting Queue</h3>
          </div>
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {visits.map(v => (
              <button key={v.id} onClick={() => selectVisit(v)} className={`w-full text-left p-3 hover:bg-muted/40 transition-colors ${selectedVisit?.id === v.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}>
                <p className="text-sm font-medium">{getPatientName(v.patient_id)}</p>
                <p className="text-xs text-muted-foreground capitalize">{v.visit_type} • {v.queue_status}</p>
              </button>
            ))}
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
            <div className="bg-card rounded-xl border border-border/60 shadow-sm">
              <div className="border-b border-border flex">
                {["vitals", "consultation", "prescriptions", "signatures"].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-medium transition-colors capitalize ${activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>{tab}</button>
                ))}
              </div>
              <div className="p-5">
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
                  <div>
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
                    <div className="space-y-3">
                      <div className="p-4 bg-muted/20 rounded-lg border border-border mb-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Diagnosis</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Diagnosis Name</label>
                            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={diagnosisForm.diagnosis_name} onChange={e => setDiagnosisForm({...diagnosisForm, diagnosis_name: e.target.value})} placeholder="e.g. Malaria" />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">ICD-10 Code</label>
                            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={diagnosisForm.icd10_code} onChange={e => setDiagnosisForm({...diagnosisForm, icd10_code: e.target.value})} placeholder="e.g. B54" />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Type</label>
                            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={diagnosisForm.type} onChange={e => setDiagnosisForm({...diagnosisForm, type: e.target.value})}>
                              <option value="primary">Primary</option><option value="secondary">Secondary</option><option value="differential">Differential</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      {["chief_complaint", "history_present_illness", "physical_examination", "assessment", "plan", "clinical_notes"].map(f => (
                        <div key={f}>
                          <label className="block text-xs font-medium text-muted-foreground mb-1 capitalize">{f.replace(/_/g, " ")}</label>
                          <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={f === "clinical_notes" ? 3 : 2} value={consultForm[f]} onChange={e => setConsultForm({...consultForm, [f]: e.target.value})} />
                        </div>
                      ))}
                    </div>
                    <button onClick={saveConsultation} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"><Save className="w-4 h-4" /> Save Notes</button>
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}