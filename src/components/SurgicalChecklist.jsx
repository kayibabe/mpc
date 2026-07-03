import { useState } from "react";
import { CheckCircle, Circle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const WHO_SIGN_IN_ITEMS = [
  { id: "s1", label: "Patient has confirmed: identity, site, procedure, consent", category: "patient" },
  { id: "s2", label: "Site marked / not applicable", category: "site" },
  { id: "s3", label: "Anaesthesia safety check completed", category: "anaesthesia" },
  { id: "s4", label: "Pulse oximeter on patient and functioning", category: "monitoring" },
  { id: "s5", label: "Allergy status confirmed", category: "patient" },
  { id: "s6", label: "Airway / aspiration risk assessed", category: "anaesthesia" },
  { id: "s7", label: "Risk of >500mL blood loss (7mL/kg children)", category: "surgical" },
  { id: "s8", label: "Appropriate IV access and fluids planned", category: "anaesthesia" },
];

const WHO_TIME_OUT_ITEMS = [
  { id: "t1", label: "All team members introduced by name and role", category: "team" },
  { id: "t2", label: "Surgeon, anaesthetist, nurse: confirm patient, site, procedure", category: "team" },
  { id: "t3", label: "Anticipated critical events — surgeon reviews", category: "surgical" },
  { id: "t4", label: "Anticipated critical events — anaesthetist reviews", category: "anaesthesia" },
  { id: "t5", label: "Anticipated critical events — nursing team reviews", category: "nursing" },
  { id: "t6", label: "Antibiotic prophylaxis given within last 60 minutes", category: "medication" },
  { id: "t7", label: "Essential imaging displayed", category: "imaging" },
];

const WHO_SIGN_OUT_ITEMS = [
  { id: "o1", label: "Nurse verbally confirms: name of procedure recorded", category: "nursing" },
  { id: "o2", label: "Instrument, sponge, and needle counts complete", category: "nursing" },
  { id: "o3", label: "Specimen labelling confirmed (patient name, specimen)", category: "nursing" },
  { id: "o4", label: "Equipment problems addressed", category: "equipment" },
  { id: "o5", label: "Surgeon, anaesthetist, nurse review post-op concerns", category: "team" },
  { id: "o6", label: "Post-op recovery and management plan confirmed", category: "plan" },
];

const PHASE_ITEMS = {
  sign_in: WHO_SIGN_IN_ITEMS,
  time_out: WHO_TIME_OUT_ITEMS,
  sign_out: WHO_SIGN_OUT_ITEMS,
};

const PHASE_LABELS = {
  sign_in: "Sign In — Before Induction",
  time_out: "Time Out — Before Incision",
  sign_out: "Sign Out — Before Patient Leaves Theatre",
};

const PHASE_COLORS = {
  sign_in: "border-chart-1 bg-chart-1/5",
  time_out: "border-chart-2 bg-chart-2/5",
  sign_out: "border-chart-3 bg-chart-3/5",
};

export default function SurgicalChecklist({ bookingId, patientId, patientName, onComplete }) {
  const [checklists, setChecklists] = useState({});
  const [activePhase, setActivePhase] = useState("sign_in");
  const [checkedItems, setCheckedItems] = useState({});
  const [itemNotes, setItemNotes] = useState({});
  const [saving, setSaving] = useState(false);
  const [staffName, setStaffName] = useState("");

  const phaseItems = PHASE_ITEMS[activePhase] || [];
  const completedCount = phaseItems.filter(i => checkedItems[i.id]).length;
  const allDone = completedCount === phaseItems.length;

  const toggleItem = (itemId) => {
    setCheckedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const saveChecklist = async () => {
    if (!bookingId || !patientId) return;
    setSaving(true);
    try {
      const items = phaseItems.map(i => ({
        label: i.label,
        category: i.category,
        checked: !!checkedItems[i.id],
        checked_by: staffName || "Nurse",
        checked_at: new Date().toISOString(),
        notes: itemNotes[i.id] || "",
      }));

      await base44.entities.SurgicalChecklist.create({
        surgical_booking_id: bookingId,
        patient_id: patientId,
        checklist_type: `who_${activePhase.replace("_", "_")}`,
        phase: activePhase,
        completed_date: allDone ? new Date().toISOString() : null,
        completed_by_name: staffName || "Surgical Team",
        items: JSON.stringify(items),
        status: allDone ? "completed" : "in_progress",
      });

      onComplete?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Phase Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
        {["sign_in", "time_out", "sign_out"].map(phase => (
          <button
            key={phase}
            onClick={() => setActivePhase(phase)}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all capitalize ${
              activePhase === phase
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {phase.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Phase Header */}
      <div className={`p-4 rounded-xl border-l-4 ${PHASE_COLORS[activePhase]}`}>
        <h4 className="font-heading text-sm font-bold">{PHASE_LABELS[activePhase]}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {completedCount} of {phaseItems.length} items checked
        </p>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${allDone ? "bg-chart-3" : "bg-primary"}`}
            style={{ width: `${(completedCount / phaseItems.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Staff Name */}
      <div>
        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Completed By</label>
        <input
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Full name..."
          value={staffName}
          onChange={e => setStaffName(e.target.value)}
        />
      </div>

      {/* Checklist Items */}
      <div className="space-y-1.5">
        {phaseItems.map(item => (
          <button
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-all ${
              checkedItems[item.id]
                ? "bg-chart-3/5 border-chart-3/30"
                : "bg-card border-border hover:border-primary/30 hover:bg-muted/20"
            }`}
          >
            {checkedItems[item.id] ? (
              <CheckCircle className="w-5 h-5 text-chart-3 mt-0.5 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground/40 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${checkedItems[item.id] ? "text-chart-3 line-through opacity-70" : "text-foreground"}`}>
                {item.label}
              </p>
              <span className="text-[10px] text-muted-foreground uppercase">{item.category}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Save Button */}
      <button
        onClick={saveChecklist}
        disabled={saving || !staffName.trim()}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-colors"
      >
        {saving ? "Saving..." : allDone ? "Complete & Sign Checklist" : "Save Checklist Progress"}
      </button>
    </div>
  );
}