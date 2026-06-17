import { useState } from "react";
import { Save, XCircle, FileText, Pill, FileBadge } from "lucide-react";

export default function TemplateEditorModal({ template, onSave, onCancel }) {
  const [chiefComplaint, setChiefComplaint] = useState(template?.subjective_template || "");
  const [historyPresentIllness, setHistoryPresentIllness] = useState("");
  const [physicalExamination, setPhysicalExamination] = useState(template?.objective_template || "");
  const [assessment, setAssessment] = useState(template?.assessment_template || "");
  const [plan, setPlan] = useState(template?.plan_template || "");
  const [clinicalNotes, setClinicalNotes] = useState(
    `Template: ${template?.name || ""} (${template?.icd10_code || "No ICD-10"})${template?.treatment_plan ? "\n\nTreatment Plan:\n" + template.treatment_plan : ""}`
  );
  const [diagnosisName, setDiagnosisName] = useState(template?.diagnosis_name || "");
  const [icd10Code, setIcd10Code] = useState(template?.icd10_code || "");

  let defaultPrescriptions = [];
  try { defaultPrescriptions = JSON.parse(template?.default_prescriptions || "[]"); } catch {}

  const [prescItems, setPrescItems] = useState(
    defaultPrescriptions.length > 0
      ? defaultPrescriptions.map(p => ({
          drug_name: p.drug_name || "",
          dosage: p.dosage || "",
          frequency: p.frequency || "",
          duration: p.duration || "",
          route: p.route || "",
          quantity: String(p.quantity || ""),
          instructions: p.instructions || "",
        }))
      : [{ drug_name: "", dosage: "", frequency: "", duration: "", route: "", quantity: "", instructions: "" }]
  );

  const handleSave = () => {
    const consultData = {
      chief_complaint: chiefComplaint,
      history_present_illness: historyPresentIllness,
      physical_examination: physicalExamination,
      assessment,
      plan,
      clinical_notes: clinicalNotes,
    };

    onSave({
      consultData,
      prescriptions: prescItems.filter(i => i.drug_name.trim() && i.quantity),
      diagnosis: diagnosisName,
      icd10: icd10Code,
      treatmentPlan: template?.treatment_plan || "",
    });
  };

  if (!template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative z-10 bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-primary/5">
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Edit Template: {template.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and customize before applying — changes are not saved to the template itself
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Close"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Diagnosis */}
          <div className="p-4 bg-muted/20 rounded-lg border border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileBadge className="w-3.5 h-3.5" /> Diagnosis
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Diagnosis Name</label>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={diagnosisName}
                  onChange={e => setDiagnosisName(e.target.value)}
                  placeholder="e.g. Malaria"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">ICD-10 Code</label>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={icd10Code}
                  onChange={e => setIcd10Code(e.target.value)}
                  placeholder="e.g. B54"
                />
              </div>
            </div>
          </div>

          {/* S: Subjective */}
          <div className="border-l-[3px] border-primary pl-3 space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-chart-4/10 text-chart-4 flex items-center justify-center text-[10px] font-bold">S</span> Subjective
            </h4>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Chief Complaint</label>
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                value={chiefComplaint}
                onChange={e => setChiefComplaint(e.target.value)}
                placeholder="Patient's main concern..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">History of Present Illness</label>
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                value={historyPresentIllness}
                onChange={e => setHistoryPresentIllness(e.target.value)}
                placeholder="Onset, duration, severity..."
              />
            </div>
          </div>

          {/* O: Objective */}
          <div className="border-l-[3px] border-primary pl-3 space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-chart-3/10 text-chart-3 flex items-center justify-center text-[10px] font-bold">O</span> Objective
            </h4>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Physical Examination</label>
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                value={physicalExamination}
                onChange={e => setPhysicalExamination(e.target.value)}
                placeholder="General appearance, vitals, system-specific findings..."
              />
            </div>
          </div>

          {/* A: Assessment */}
          <div className="border-l-[3px] border-primary pl-3 space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-chart-2/10 text-chart-2 flex items-center justify-center text-[10px] font-bold">A</span> Assessment
            </h4>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Clinical Assessment & Differential</label>
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                value={assessment}
                onChange={e => setAssessment(e.target.value)}
                placeholder="Summary, differential diagnoses..."
              />
            </div>
          </div>

          {/* P: Plan */}
          <div className="border-l-[3px] border-primary pl-3 space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">P</span> Plan
            </h4>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Treatment Plan</label>
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                value={plan}
                onChange={e => setPlan(e.target.value)}
                placeholder="Medications, investigations, referrals, follow-up..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Clinical Notes</label>
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                value={clinicalNotes}
                onChange={e => setClinicalNotes(e.target.value)}
                placeholder="Patient education, counselling, special instructions..."
              />
            </div>
          </div>

          {/* Prescriptions */}
          <div className="p-4 bg-muted/20 rounded-lg border border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5" /> Prescriptions
            </p>
            <div className="space-y-2">
              {prescItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border border-border rounded-lg bg-background">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Drug Name</label>
                    <input
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={item.drug_name}
                      onChange={e => {
                        const items = [...prescItems];
                        items[idx].drug_name = e.target.value;
                        setPrescItems(items);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Dosage</label>
                    <input
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={item.dosage}
                      onChange={e => {
                        const items = [...prescItems];
                        items[idx].dosage = e.target.value;
                        setPrescItems(items);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Frequency</label>
                    <input
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={item.frequency}
                      onChange={e => {
                        const items = [...prescItems];
                        items[idx].frequency = e.target.value;
                        setPrescItems(items);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Qty</label>
                    <input
                      type="number"
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={item.quantity}
                      onChange={e => {
                        const items = [...prescItems];
                        items[idx].quantity = e.target.value;
                        setPrescItems(items);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Duration</label>
                    <input
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={item.duration}
                      onChange={e => {
                        const items = [...prescItems];
                        items[idx].duration = e.target.value;
                        setPrescItems(items);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Route</label>
                    <input
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={item.route}
                      onChange={e => {
                        const items = [...prescItems];
                        items[idx].route = e.target.value;
                        setPrescItems(items);
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Instructions</label>
                    <input
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={item.instructions}
                      onChange={e => {
                        const items = [...prescItems];
                        items[idx].instructions = e.target.value;
                        setPrescItems(items);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPrescItems([...prescItems, { drug_name: "", dosage: "", frequency: "", duration: "", route: "", quantity: "", instructions: "" }])}
              className="mt-2 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted transition-colors"
            >
              + Add Drug
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 bg-muted/10 flex items-center justify-between gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save & Apply Template
          </button>
        </div>
      </div>
    </div>
  );
}