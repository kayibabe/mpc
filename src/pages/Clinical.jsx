import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Stethoscope, Heart, FileText, Pill, Activity, Plus, Save, Search } from "lucide-react";
import TemplateSelector from "@/components/TemplateSelector";

export default function Clinical() {
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [vitals, setVitals] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [vitalForm, setVitalForm] = useState({ bp_systolic: "", bp_diastolic: "", heart_rate: "", respiratory_rate: "", temperature: "", spo2: "", weight: "", height: "", glucose: "", pain_score: "" });
  const [consultForm, setConsultForm] = useState({ chief_complaint: "", history_present_illness: "", physical_examination: "", assessment: "", plan: "", clinical_notes: "" });
  const [prescForm, setPrescForm] = useState({ items: [{ drug_name: "", dosage: "", frequency: "", duration: "", route: "", quantity: "", instructions: "" }] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vitals");

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
    const [vList, cList, pList] = await Promise.all([
      base44.entities.VitalSigns.filter({ visit_id: visit.id }, "-created_date", 10),
      base44.entities.Consultation.filter({ visit_id: visit.id }, "-created_date", 10),
      base44.entities.Prescription.filter({ visit_id: visit.id }, "-created_date", 10),
    ]);
    setVitals(vList[0] || null);
    setConsultations(cList);
    setPrescriptions(pList);
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
    await base44.entities.Consultation.create({
      visit_id: selectedVisit.id, patient_id: selectedVisit.patient_id,
      ...consultForm, consultation_date: new Date().toISOString(),
    });
    setConsultForm({ chief_complaint: "", history_present_illness: "", physical_examination: "", assessment: "", plan: "", clinical_notes: "" });
    const c = await base44.entities.Consultation.filter({ visit_id: selectedVisit.id }, "-created_date", 10);
    setConsultations(c);
  };

  const savePrescription = async () => {
    if (!selectedVisit) return;
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
  };

  const addPrescItem = () => setPrescForm({ items: [...prescForm.items, { drug_name: "", dosage: "", frequency: "", duration: "", route: "", quantity: "", instructions: "" }] });

  const applyTemplate = ({ consultData, prescriptions, diagnosis, icd10 }) => {
    setConsultForm(consultData);
    // Add diagnosis via consultation save later — prefill assessment
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
      setActiveTab("prescriptions");
    }
    setActiveTab("consultation");
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container">
      <h2 className="section-title mb-6">Clinical</h2>
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
                {["vitals", "consultation", "prescriptions"].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-medium transition-colors capitalize ${activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>{tab}</button>
                ))}
              </div>
              <div className="p-5">
                {activeTab === "vitals" && (
                  <div>
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
                  </div>
                )}

                {activeTab === "consultation" && (
                  <div>
                    <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Consultation Notes</h4>
                    <TemplateSelector onSelectTemplate={applyTemplate} />
                    {consultations.map(c => (
                      <div key={c.id} className="mb-4 p-4 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">{new Date(c.consultation_date).toLocaleString()}</p>
                        {c.chief_complaint && <div className="mb-2"><span className="text-xs font-medium text-muted-foreground">Chief Complaint:</span><p className="text-sm">{c.chief_complaint}</p></div>}
                        {c.assessment && <div className="mb-2"><span className="text-xs font-medium text-muted-foreground">Assessment:</span><p className="text-sm">{c.assessment}</p></div>}
                        {c.plan && <div className="mb-2"><span className="text-xs font-medium text-muted-foreground">Plan:</span><p className="text-sm">{c.plan}</p></div>}
                      </div>
                    ))}
                    <div className="space-y-3">
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
                        <p className="text-xs text-muted-foreground">Prescription — {new Date(p.created_date).toLocaleString()} — <span className="font-medium">{p.status}</span></p>
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}