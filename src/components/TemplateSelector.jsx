import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, ChevronDown, ChevronUp, Search, X, Zap, Clock } from "lucide-react";

const CATEGORY_LABELS = {
  general: "General Medicine",
  anc: "ANC / Maternal",
  paediatric: "Paediatric",
  surgical: "Surgical",
  chronic: "Chronic Disease",
  emergency: "Emergency",
};

const CATEGORY_COLORS = {
  general: "bg-primary/10 text-primary border-primary/20",
  anc: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  paediatric: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  surgical: "bg-chart-5/10 text-chart-5 border-chart-5/20",
  chronic: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  emergency: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function TemplateSelector({ onSelectTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [recentIds, setRecentIds] = useState([]);

  useEffect(() => {
    base44.entities.ClinicalTemplate.filter({ is_active: true }, "category", 100)
      .then(setTemplates)
      .catch(() => {});

    // Load recent template selections from localStorage
    try {
      const saved = localStorage.getItem("recentClinicalTemplates");
      if (saved) setRecentIds(JSON.parse(saved));
    } catch {}
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.diagnosis_name?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      (CATEGORY_LABELS[t.category] || "").toLowerCase().includes(q)
    );
  }, [templates, search]);

  const recentTemplates = useMemo(() =>
    recentIds.map(id => templates.find(t => t.id === id)).filter(Boolean).slice(0, 4),
  [recentIds, templates]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(t => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filtered]);

  const handleSelect = (template) => {
    let prescriptions = [];
    try { prescriptions = JSON.parse(template.default_prescriptions || "[]"); } catch {}
    let investigations = [];
    try { investigations = JSON.parse(template.default_investigations || "[]"); } catch {}

    const consultData = {
      chief_complaint: template.subjective_template || "",
      history_present_illness: "",
      physical_examination: template.objective_template || "",
      assessment: template.assessment_template || "",
      plan: template.plan_template || "",
      clinical_notes: `Template: ${template.name} (${template.icd10_code || "No ICD-10"})${template.treatment_plan ? "\n\nTreatment Plan:\n" + template.treatment_plan : ""}`,
    };

    onSelectTemplate?.({
      consultData,
      prescriptions,
      investigations,
      diagnosis: template.diagnosis_name,
      icd10: template.icd10_code,
      treatmentPlan: template.treatment_plan || "",
    });

    // Track recent usage
    const updated = [template.id, ...recentIds.filter(id => id !== template.id)].slice(0, 10);
    setRecentIds(updated);
    try { localStorage.setItem("recentClinicalTemplates", JSON.stringify(updated)); } catch {}

    setExpanded(false);
  };

  if (templates.length === 0) return null;

  const categoryKeys = Object.keys(grouped).sort((a, b) =>
    Object.keys(CATEGORY_LABELS).indexOf(a) - Object.keys(CATEGORY_LABELS).indexOf(b)
  );

  return (
    <div className="mb-4">
      <button
        onClick={() => { setExpanded(!expanded); setSearch(""); }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-primary/30 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10 hover:border-primary/50 transition-all shadow-sm"
      >
        <Zap className="w-4 h-4" />
        Clinical Templates ({templates.length})
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="mt-3 p-4 bg-card rounded-xl border-2 border-primary/20 shadow-lg animate-in slide-in-from-top-2">
          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
              placeholder="Search templates by name, diagnosis, or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Recent templates quick picks */}
          {!search && recentTemplates.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Recently Used
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recentTemplates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:scale-[1.02] ${CATEGORY_COLORS[t.category] || "bg-muted text-muted-foreground border-border"}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Template categories */}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {categoryKeys.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No templates match your search.</p>
              </div>
            ) : (
              categoryKeys.map(cat => {
                const catTemplates = grouped[cat];
                const catColor = CATEGORY_COLORS[cat] || "bg-muted text-muted-foreground border-border";
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {CATEGORY_LABELS[cat] || cat}
                      </p>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-mono">
                        {catTemplates.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {catTemplates.map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleSelect(t)}
                          className="group text-left px-3.5 py-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm transition-all"
                        >
                          <p className="font-semibold text-sm group-hover:text-primary transition-colors">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {t.diagnosis_name}{t.icd10_code ? <span className="font-mono ml-2 text-[10px] opacity-60">{t.icd10_code}</span> : ""}
                          </p>
                          {t.treatment_plan && (
                            <p className="text-[10px] text-chart-3 mt-1 font-medium">+ Integrated treatment plan</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!search && (
            <p className="text-[10px] text-muted-foreground text-center mt-4 pt-3 border-t border-border/40">
              Select a template to auto-fill the SOAP notes, diagnosis, prescriptions, and investigations
            </p>
          )}
        </div>
      )}
    </div>
  );
}