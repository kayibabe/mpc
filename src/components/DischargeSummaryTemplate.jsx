import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Download, Printer, Loader2, CheckCircle } from "lucide-react";

const TEMPLATE_SECTIONS = [
  { key: "admission_summary", label: "Admission Summary", placeholder: "Date admitted, presenting complaint, ward/bed..." },
  { key: "clinical_course", label: "Clinical Course", placeholder: "Hospital course, treatments given, response to therapy..." },
  { key: "procedures_performed", label: "Procedures / Investigations", placeholder: "Lab results, imaging findings, procedures done..." },
  { key: "discharge_diagnosis", label: "Discharge Diagnosis", placeholder: "Primary and secondary diagnoses with ICD-10..." },
  { key: "discharge_medications", label: "Discharge Medications", placeholder: "Drug name, dose, frequency, duration..." },
  { key: "follow_up_plan", label: "Follow-up Plan", placeholder: "Next appointment, clinic, review date..." },
  { key: "patient_education", label: "Patient / Family Education", placeholder: "Counselling given, red flags, diet, activity restrictions..." },
  { key: "condition_on_discharge", label: "Condition on Discharge", placeholder: "Stable, improved, referred..." },
];

export default function DischargeSummaryTemplate({ patientId, visitId, patientName, onClose }) {
  const [form, setForm] = useState({
    admission_summary: "", clinical_course: "", procedures_performed: "",
    discharge_diagnosis: "", discharge_medications: "", follow_up_plan: "",
    patient_education: "", condition_on_discharge: "stable",
    discharge_date: new Date().toISOString().slice(0, 10),
    discharging_doctor: "",
  });
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const { data } = await base44.functions.invoke("generateDischargeSummary", { visit_id: visitId, patient_id: patientId });
      if (data?.summary) {
        setGenerated(data.summary);
        // Pre-fill form fields if AI returns structured data
        if (data.structured) {
          setForm(prev => ({ ...prev, ...data.structured }));
        }
      }
    } catch (_) {}
    finally { setGenerating(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Discharge.create({
        patient_id: patientId,
        visit_id: visitId,
        discharge_date: new Date(form.discharge_date).toISOString(),
        discharge_diagnosis: form.discharge_diagnosis,
        discharge_medications: form.discharge_medications,
        follow_up_plan: form.follow_up_plan,
        clinical_course: form.clinical_course,
        procedures_performed: form.procedures_performed,
        patient_education: form.patient_education,
        condition_on_discharge: form.condition_on_discharge,
        discharging_doctor: form.discharging_doctor,
        admission_summary: form.admission_summary,
      });
      setSaved(true);
      setTimeout(() => onClose?.(), 1500);
    } catch (_) {}
    finally { setSaving(false); }
  };

  const handlePrint = () => {
    const content = TEMPLATE_SECTIONS.map(s =>
      `\n${s.label.toUpperCase()}\n${"─".repeat(40)}\n${form[s.key] || "—"}`
    ).join("\n");
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html><head><title>Discharge Summary — ${patientName}</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;line-height:1.6}h1{border-bottom:2px solid #000;padding-bottom:10px}pre{white-space:pre-wrap;font-family:inherit}</style>
      </head><body>
      <h1>DISCHARGE SUMMARY</h1>
      <p><strong>Patient:</strong> ${patientName} &nbsp;&nbsp; <strong>Date:</strong> ${form.discharge_date} &nbsp;&nbsp; <strong>Doctor:</strong> ${form.discharging_doctor}</p>
      <p><strong>Zomba City Private Clinic</strong></p><hr/>
      <pre>${content}</pre>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-primary/5 border-b border-border px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-heading font-semibold text-base">Discharge Summary</h3>
            {patientName && <p className="text-xs text-muted-foreground">{patientName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateWithAI}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-chart-4/10 text-chart-4 text-xs font-medium hover:bg-chart-4/20 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {generating ? "Generating…" : "AI Auto-Fill"}
          </button>
          <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Header fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Discharge Date</label>
            <input type="date" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.discharge_date} onChange={e => setForm({ ...form, discharge_date: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Discharging Doctor</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Dr. Name" value={form.discharging_doctor} onChange={e => setForm({ ...form, discharging_doctor: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Condition on Discharge</label>
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.condition_on_discharge} onChange={e => setForm({ ...form, condition_on_discharge: e.target.value })}>
              <option value="stable">Stable</option>
              <option value="improved">Improved</option>
              <option value="recovered">Recovered</option>
              <option value="referred">Referred</option>
              <option value="self_discharge">Self Discharge</option>
              <option value="deceased">Deceased</option>
            </select>
          </div>
        </div>

        {/* AI generated preview */}
        {generated && (
          <div className="p-3 bg-chart-4/5 border border-chart-4/20 rounded-lg text-xs whitespace-pre-wrap">
            <p className="font-semibold text-chart-4 mb-1">AI Generated Summary</p>
            {generated}
          </div>
        )}

        {/* Template sections */}
        {TEMPLATE_SECTIONS.map(section => (
          <div key={section.key}>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{section.label}</label>
            <textarea
              rows={section.key === "discharge_medications" || section.key === "clinical_course" ? 4 : 3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder={section.placeholder}
              value={form[section.key] || ""}
              onChange={e => setForm({ ...form, [section.key]: e.target.value })}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
        {onClose && (
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Download className="w-4 h-4" /> Save Discharge Summary</>}
        </button>
      </div>
    </div>
  );
}