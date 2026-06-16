import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

export default function TemplateSelector({ onSelectTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.entities.ClinicalTemplate.filter({ is_active: true }, "category", 50)
      .then(setTemplates)
      .catch(() => {});
  }, []);

  const categories = [...new Set(templates.map(t => t.category))];

  const handleSelect = (template) => {
    let prescriptions = [];
    try { prescriptions = JSON.parse(template.default_prescriptions || "[]"); } catch {}

    const consultData = {
      chief_complaint: template.subjective_template || "",
      history_present_illness: "",
      physical_examination: template.objective_template || "",
      assessment: template.assessment_template || "",
      plan: template.plan_template || "",
      clinical_notes: `Template: ${template.name} (${template.icd10_code || "No ICD-10"})`,
    };

    onSelectTemplate?.({ consultData, prescriptions, diagnosis: template.diagnosis_name, icd10: template.icd10_code });
    setExpanded(false);
  };

  if (templates.length === 0) return null;

  const categoryLabels = {
    general: "General",
    anc: "ANC / Maternal",
    paediatric: "Paediatric",
    surgical: "Surgical",
    chronic: "Chronic Disease",
    emergency: "Emergency",
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
      >
        <FileText className="w-4 h-4 text-primary" />
        Clinical Templates
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="mt-2 p-3 bg-muted/20 rounded-lg border border-border">
          {categories.map(cat => {
            const catTemplates = templates.filter(t => t.category === cat);
            if (catTemplates.length === 0) return null;
            return (
              <div key={cat} className="mb-3 last:mb-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {categoryLabels[cat] || cat}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {catTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSelect(t)}
                      className="text-left px-3 py-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all text-sm"
                    >
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.diagnosis_name}{t.icd10_code ? ` — ${t.icd10_code}` : ""}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}