import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Search, X, Zap, Clock, XCircle } from "lucide-react";
import TemplateEditorModal from "@/components/TemplateEditorModal";

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recentIds, setRecentIds] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    base44.entities.ClinicalTemplate.filter({ is_active: true }, "category", 100)
      .then(setTemplates)
      .catch(() => {});

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
    // Close the template selector, then open the editor modal
    setOpen(false);
    setSearch("");
    setEditingTemplate(template);
  };

  const handleEditorSave = (editedData) => {
    onSelectTemplate?.(editedData);

    // Track recent usage
    const updated = [editingTemplate.id, ...recentIds.filter(id => id !== editingTemplate.id)].slice(0, 10);
    setRecentIds(updated);
    try { localStorage.setItem("recentClinicalTemplates", JSON.stringify(updated)); } catch {}

    setEditingTemplate(null);
  };

  const handleEditorCancel = () => {
    setEditingTemplate(null);
  };

  const handleClose = () => {
    setOpen(false);
    setSearch("");
  };

  if (templates.length === 0) return null;

  const categoryKeys = Object.keys(grouped).sort((a, b) =>
    Object.keys(CATEGORY_LABELS).indexOf(a) - Object.keys(CATEGORY_LABELS).indexOf(b)
  );

  return (
    <div className="mb-4">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-primary/30 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10 hover:border-primary/50 transition-all shadow-sm"
      >
        <Zap className="w-4 h-4" />
        Clinical Templates ({templates.length})
      </button>

      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

          {/* Modal Content */}
          <div className="relative z-10 bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
              <div>
                <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Clinical Templates
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {templates.length} templates available — select one to auto-fill the SOAP notes
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative mx-6 mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
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

            {/* Scrollable Template List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Recent templates quick picks */}
              {!search && recentTemplates.length > 0 && (
                <div>
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
              {categoryKeys.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No templates match your search.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term.</p>
                </div>
              ) : (
                categoryKeys.map(cat => {
                  const catTemplates = grouped[cat];
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
                              {t.diagnosis_name}
                              {t.icd10_code && (
                                <span className="font-mono ml-2 text-[10px] opacity-60">{t.icd10_code}</span>
                              )}
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

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border/60 bg-muted/10">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  Select a template to auto-fill SOAP notes, diagnosis, and prescriptions
                </p>
                <button
                  onClick={handleClose}
                  className="px-4 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {editingTemplate && (
        <TemplateEditorModal
          template={editingTemplate}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
    </div>
  );
}