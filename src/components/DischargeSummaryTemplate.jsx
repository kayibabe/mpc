import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Printer, Loader2, CheckCircle, RefreshCw, User, Stethoscope, Pill, Calendar, Activity, BookOpen, AlertCircle } from "lucide-react";

const CONDITION_OPTIONS = ["stable", "improved", "recovered", "referred", "self_discharge", "deceased"];

export default function DischargeSummaryTemplate({ patientId, visitId, patientName, onClose }) {
  const [form, setForm] = useState({
    admission_summary: "",
    clinical_course: "",
    procedures_performed: "",
    discharge_diagnosis: "",
    discharge_medications: "",
    follow_up_plan: "",
    patient_education: "",
    condition_on_discharge: "stable",
    discharge_date: new Date().toISOString().slice(0, 10),
    discharging_doctor: "",
  });
  const [pulling, setPulling] = useState(true);
  const [pulledData, setPulledData] = useState(null); // raw pulled records for sidebar preview
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Auto-pull on mount
  useEffect(() => {
    if (visitId && patientId) autoPull();
  }, [visitId, patientId]);

  const autoPull = async () => {
    setPulling(true);
    try {
      const [diagnoses, consultations, prescriptions, labOrders, vitals, admission] = await Promise.all([
        base44.entities.Diagnosis.filter({ visit_id: visitId }, "-created_date", 20),
        base44.entities.Consultation.filter({ visit_id: visitId }, "-created_date", 10),
        base44.entities.Prescription.filter({ visit_id: visitId }, "-created_date", 10),
        base44.entities.LabOrder.filter({ patient_id: patientId }, "-created_date", 20),
        base44.entities.VitalSigns.filter({ visit_id: visitId }, "-created_date", 5),
        base44.entities.Admission.filter({ visit_id: visitId }, "-created_date", 1),
      ]);

      // Fetch prescription items for each prescription
      let allPrescItems = [];
      for (const presc of prescriptions) {
        try {
          const items = await base44.entities.PrescriptionItem.filter({ prescription_id: presc.id }, "", 30);
          allPrescItems = [...allPrescItems, ...items];
        } catch (_) {}
      }

      setPulledData({ diagnoses, consultations, prescriptions, labOrders, vitals, admission: admission[0] || null, prescItems: allPrescItems });

      // Build pre-filled form fields from pulled data
      const latestConsult = consultations[0];
      const latestVitals = vitals[0];

      // Discharge Diagnosis
      const diagText = diagnoses.map(d =>
        `${d.diagnosis_name}${d.icd10_code ? ` (${d.icd10_code})` : ""}${d.type !== "primary" ? ` [${d.type}]` : ""}`
      ).join("\n");

      // Clinical Course — from consultation SOAP notes
      const courseText = consultations.map(c => {
        const parts = [];
        if (c.chief_complaint) parts.push(`Presenting complaint: ${c.chief_complaint}`);
        if (c.history_present_illness) parts.push(`History: ${c.history_present_illness}`);
        if (c.assessment) parts.push(`Assessment: ${c.assessment}`);
        if (c.plan) parts.push(`Plan: ${c.plan}`);
        return parts.join("\n");
      }).join("\n\n---\n\n");

      // Procedures & Investigations — from lab orders
      const labText = labOrders.map(lo => {
        const tests = lo.tests ? lo.tests.replace(/[\[\]"]/g, "").replace(/,/g, ", ") : "";
        return `${tests} — ${lo.status}${lo.priority !== "routine" ? ` [${lo.priority}]` : ""}`;
      }).join("\n");

      const proceduresText = labText || "";

      // Discharge Medications — from prescription items
      const medText = allPrescItems.map(item =>
        `• ${item.drug_name} ${item.dosage} — ${item.frequency}${item.duration ? `, ${item.duration}` : ""}${item.route ? ` (${item.route})` : ""}${item.instructions ? `\n  Instruction: ${item.instructions}` : ""}`
      ).join("\n");

      // Follow-up Plan — from latest consultation plan
      const followUpText = latestConsult?.plan
        ? `${latestConsult.plan}`
        : "";

      // Admission Summary
      const adm = admission[0];
      const admText = adm
        ? `Admitted: ${new Date(adm.admission_date || adm.created_date).toLocaleDateString("en-GB")} · Type: ${adm.admission_type || "—"} · Diagnosis on admission: ${adm.diagnosis_on_admission || "—"}`
        : "";

      // Vitals on discharge
      const vitalsText = latestVitals
        ? `BP: ${latestVitals.bp_systolic || "—"}/${latestVitals.bp_diastolic || "—"} mmHg · HR: ${latestVitals.heart_rate || "—"} bpm · Temp: ${latestVitals.temperature || "—"}°C · SpO₂: ${latestVitals.spo2 || "—"}%`
        : "";

      setForm(prev => ({
        ...prev,
        discharge_diagnosis: diagText || prev.discharge_diagnosis,
        clinical_course: courseText || prev.clinical_course,
        procedures_performed: proceduresText
          ? `Lab / Investigations:\n${proceduresText}${vitalsText ? `\n\nVitals on discharge: ${vitalsText}` : ""}`
          : prev.procedures_performed,
        discharge_medications: medText || prev.discharge_medications,
        follow_up_plan: followUpText || prev.follow_up_plan,
        admission_summary: admText || prev.admission_summary,
      }));
    } catch (e) {
      console.error("Auto-pull failed:", e);
    } finally {
      setPulling(false);
    }
  };

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const { data } = await base44.functions.invoke("generateDischargeSummary", { visit_id: visitId, patient_id: patientId });
      if (data?.structured) setForm(prev => ({ ...prev, ...data.structured }));
      else if (data?.summary) setForm(prev => ({ ...prev, clinical_course: data.summary }));
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
    const sections = [
      { label: "ADMISSION SUMMARY", value: form.admission_summary },
      { label: "DISCHARGE DIAGNOSIS", value: form.discharge_diagnosis },
      { label: "CLINICAL COURSE & TREATMENT", value: form.clinical_course },
      { label: "PROCEDURES & INVESTIGATIONS", value: form.procedures_performed },
      { label: "DISCHARGE MEDICATIONS", value: form.discharge_medications },
      { label: "FOLLOW-UP PLAN", value: form.follow_up_plan },
      { label: "PATIENT / FAMILY EDUCATION", value: form.patient_education },
    ];
    const w = window.open("", "_blank");
    w.document.write(`
      <html><head><title>Discharge Summary — ${patientName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; font-size: 12px; max-width: 800px; margin: 0 auto; }
        .header { border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px; }
        .logo { font-size: 18px; font-weight: bold; }
        .subtitle { font-size: 11px; color: #555; }
        .meta { display: flex; gap: 24px; margin: 10px 0; font-size: 11px; }
        .meta span { border-right: 1px solid #ccc; padding-right: 12px; }
        .section { margin-bottom: 18px; border-left: 3px solid #2563eb; padding-left: 10px; }
        .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #1e40af; margin-bottom: 4px; }
        .section-body { white-space: pre-wrap; line-height: 1.6; color: #1e293b; }
        .footer { margin-top: 30px; padding-top: 12px; border-top: 2px solid #000; font-size: 11px; display: flex; justify-content: space-between; }
        .condition { display: inline-block; padding: 2px 10px; border-radius: 12px; background: #dcfce7; color: #166534; font-weight: bold; text-transform: capitalize; }
      </style></head><body>
      <div class="header">
        <div class="logo">🏥 MTOWERA PRIVATE CLINIC</div>
        <div class="subtitle">P.O. Box — Mtowera, Malawi &nbsp;|&nbsp; Discharge Summary</div>
        <div class="meta">
          <span><strong>Patient:</strong> ${patientName}</span>
          <span><strong>Discharge Date:</strong> ${form.discharge_date}</span>
          <span><strong>Doctor:</strong> ${form.discharging_doctor || "—"}</span>
          <span><strong>Condition:</strong> <span class="condition">${form.condition_on_discharge}</span></span>
        </div>
      </div>
      ${sections.map(s => s.value ? `
        <div class="section">
          <div class="section-title">${s.label}</div>
          <div class="section-body">${s.value}</div>
        </div>` : "").join("")}
      <div class="footer">
        <span>Signature: ____________________________</span>
        <span>Date: ${form.discharge_date}</span>
        <span>Generated: ${new Date().toLocaleString("en-GB")}</span>
      </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const SECTIONS = [
    { key: "admission_summary", label: "Admission Summary", icon: User, rows: 2, placeholder: "Date admitted, presenting complaint, ward/bed..." },
    { key: "discharge_diagnosis", label: "Discharge Diagnosis", icon: Stethoscope, rows: 3, placeholder: "Primary and secondary diagnoses with ICD-10 codes..." },
    { key: "clinical_course", label: "Clinical Course & Treatment History", icon: Activity, rows: 5, placeholder: "Hospital course, treatments given, response to therapy..." },
    { key: "procedures_performed", label: "Procedures & Investigations", icon: BookOpen, rows: 3, placeholder: "Lab results, imaging findings, procedures performed..." },
    { key: "discharge_medications", label: "Discharge Medications", icon: Pill, rows: 4, placeholder: "Drug name · dose · frequency · duration..." },
    { key: "follow_up_plan", label: "Follow-up Instructions", icon: Calendar, rows: 3, placeholder: "Next appointment, clinic, review date, referral..." },
    { key: "patient_education", label: "Patient & Family Education", icon: AlertCircle, rows: 2, placeholder: "Red flags, diet restrictions, activity, wound care..." },
  ];

  return (
    <div className="bg-white rounded-xl border border-border shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-primary/5 border-b border-border px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Discharge Summary</h3>
            <p className="text-[11px] text-muted-foreground">{patientName}</p>
          </div>
          {pulling && (
            <span className="flex items-center gap-1 text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" /> Pulling records…
            </span>
          )}
          {!pulling && pulledData && (
            <span className="flex items-center gap-1 text-[11px] text-chart-3 bg-chart-3/10 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" />
              {pulledData.diagnoses.length}dx · {pulledData.consultations.length} consults · {pulledData.prescItems.length} meds
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={autoPull} disabled={pulling} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${pulling ? "animate-spin" : ""}`} /> Re-pull
          </button>
          <button onClick={generateWithAI} disabled={generating || pulling} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-chart-4/10 text-chart-4 text-xs font-medium hover:bg-chart-4/20 disabled:opacity-50">
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
            {generating ? "AI Writing…" : "AI Enhance"}
          </button>
          <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
            <Printer className="w-3 h-3" /> Print
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Meta row */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Discharge Date</label>
            <input type="date" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.discharge_date} onChange={e => setForm({ ...form, discharge_date: e.target.value })} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Discharging Doctor</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Dr. Name" value={form.discharging_doctor} onChange={e => setForm({ ...form, discharging_doctor: e.target.value })} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Condition on Discharge</label>
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.condition_on_discharge} onChange={e => setForm({ ...form, condition_on_discharge: e.target.value })}>
              {CONDITION_OPTIONS.map(o => <option key={o} value={o}>{o.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
          </div>
        </div>

        {/* Pulled data quick-reference strip */}
        {pulledData && (pulledData.diagnoses.length > 0 || pulledData.prescItems.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pulledData.diagnoses.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Stethoscope className="w-3 h-3" /> Pulled Diagnoses ({pulledData.diagnoses.length})
                </p>
                <div className="space-y-0.5">
                  {pulledData.diagnoses.map(d => (
                    <p key={d.id} className="text-xs text-blue-800">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${d.type === "primary" ? "bg-blue-500" : "bg-blue-300"}`} />
                      {d.diagnosis_name}{d.icd10_code ? ` (${d.icd10_code})` : ""}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {pulledData.prescItems.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Pill className="w-3 h-3" /> Pulled Medications ({pulledData.prescItems.length})
                </p>
                <div className="space-y-0.5">
                  {pulledData.prescItems.slice(0, 5).map(item => (
                    <p key={item.id} className="text-xs text-green-800">• {item.drug_name} {item.dosage} — {item.frequency}</p>
                  ))}
                  {pulledData.prescItems.length > 5 && <p className="text-[10px] text-green-600">+{pulledData.prescItems.length - 5} more</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Editable template sections */}
        {SECTIONS.map(section => {
          const Icon = section.icon;
          return (
            <div key={section.key}>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <Icon className="w-3.5 h-3.5 text-primary" /> {section.label}
              </label>
              <textarea
                rows={section.rows}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder={section.placeholder}
                value={form[section.key] || ""}
                onChange={e => setForm({ ...form, [section.key]: e.target.value })}
              />
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center gap-3 flex-shrink-0">
        {onClose && <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {saved
            ? <><CheckCircle className="w-4 h-4" /> Saved!</>
            : saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : <><FileText className="w-4 h-4" /> Save & Finalise Discharge</>}
        </button>
      </div>
    </div>
  );
}