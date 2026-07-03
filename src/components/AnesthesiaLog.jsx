import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Activity, Droplets, Plus, X, AlertCircle } from "lucide-react";

const VITAL_TEMPLATE = { time: "", hr: "", bp_sys: "", bp_dia: "", spo2: "", etco2: "", temp: "", notes: "" };
const EVENT_TEMPLATE = { time: "", event_type: "hypotension", description: "", action_taken: "" };
const FLUID_TEMPLATE = { fluid: "Normal Saline", volume_ml: "", time_started: "" };
const DRUG_TEMPLATE = { drug: "", dose: "", rate: "", route: "IV" };

const EVENT_TYPES = [
  "hypotension", "hypertension", "bradycardia", "tachycardia", "desaturation",
  "bronchospasm", "anaphylaxis", "difficult_airway", "cardiac_arrest",
  "hemorrhage", "drug_reaction", "equipment_failure", "other",
];

export default function AnesthesiaLog({ bookingId, patientId, booking, onComplete }) {
  const [form, setForm] = useState({
    anaesthesia_type: booking?.anaesthesia_type || "general",
    asa_classification: "ASA I",
    airway_management: "ett",
    ett_size: "",
    ventilation_mode: "controlled",
    induction_time: new Date().toISOString(),
    estimated_blood_loss_ml: 0,
    urine_output_ml: 0,
    disposition: "recovery",
    postop_instructions: "",
    complications: "",
    induction_agents: [],
    maintenance_agents: [],
    iv_fluids: [],
    blood_products: [],
    vitals_log: [],
    events_log: [],
    reversal_agents: [],
  });
  const [activeTab, setActiveTab] = useState("vitals");
  const [saving, setSaving] = useState(false);
  const [staffName, setStaffName] = useState("");

  const addVital = () => setForm({ ...form, vitals_log: [...form.vitals_log, { ...VITAL_TEMPLATE, time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }] });

  const updateVital = (idx, field, value) => {
    const copy = [...form.vitals_log];
    copy[idx][field] = value;
    setForm({ ...form, vitals_log: copy });
  };

  const removeVital = idx => setForm({ ...form, vitals_log: form.vitals_log.filter((_, i) => i !== idx) });

  const addEvent = () => setForm({ ...form, events_log: [...form.events_log, { ...EVENT_TEMPLATE, time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }] });

  const updateEvent = (idx, field, value) => {
    const copy = [...form.events_log];
    copy[idx][field] = value;
    setForm({ ...form, events_log: copy });
  };

  const removeEvent = idx => setForm({ ...form, events_log: form.events_log.filter((_, i) => i !== idx) });

  const addFluid = () => setForm({ ...form, iv_fluids: [...form.iv_fluids, { ...FLUID_TEMPLATE, time_started: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }] });

  const updateFluid = (idx, field, value) => {
    const copy = [...form.iv_fluids];
    copy[idx][field] = value;
    setForm({ ...form, iv_fluids: copy });
  };

  const removeFluid = idx => setForm({ ...form, iv_fluids: form.iv_fluids.filter((_, i) => i !== idx) });

  const addInductionDrug = () => setForm({ ...form, induction_agents: [...form.induction_agents, { ...DRUG_TEMPLATE }] });
  const updateInductionDrug = (idx, field, value) => {
    const copy = [...form.induction_agents];
    copy[idx][field] = value;
    setForm({ ...form, induction_agents: copy });
  };
  const removeInductionDrug = idx => setForm({ ...form, induction_agents: form.induction_agents.filter((_, i) => i !== idx) });

  const addMaintenanceDrug = () => setForm({ ...form, maintenance_agents: [...form.maintenance_agents, { ...DRUG_TEMPLATE }] });
  const updateMaintenanceDrug = (idx, field, value) => {
    const copy = [...form.maintenance_agents];
    copy[idx][field] = value;
    setForm({ ...form, maintenance_agents: copy });
  };
  const removeMaintenanceDrug = idx => setForm({ ...form, maintenance_agents: form.maintenance_agents.filter((_, i) => i !== idx) });

  const addReversal = () => setForm({ ...form, reversal_agents: [...form.reversal_agents, { ...DRUG_TEMPLATE }] });
  const updateReversal = (idx, field, value) => {
    const copy = [...form.reversal_agents];
    copy[idx][field] = value;
    setForm({ ...form, reversal_agents: copy });
  };
  const removeReversal = idx => setForm({ ...form, reversal_agents: form.reversal_agents.filter((_, i) => i !== idx) });

  const saveLog = async () => {
    if (!bookingId || !patientId) return;
    setSaving(true);
    try {
      await base44.entities.AnesthesiaLog.create({
        surgical_booking_id: bookingId,
        patient_id: patientId,
        anaesthetist_name: staffName || "Anaesthetist",
        ...form,
        induction_agents: JSON.stringify(form.induction_agents.filter(d => d.drug)),
        maintenance_agents: JSON.stringify(form.maintenance_agents.filter(d => d.drug)),
        iv_fluids: JSON.stringify(form.iv_fluids.filter(f => f.volume_ml)),
        blood_products: JSON.stringify(form.blood_products),
        vitals_log: JSON.stringify(form.vitals_log.filter(v => v.hr || v.bp_sys)),
        events_log: JSON.stringify(form.events_log.filter(e => e.description)),
        reversal_agents: JSON.stringify(form.reversal_agents.filter(d => d.drug)),
        status: "completed",
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
      {/* Staff Name */}
      <div>
        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Anaesthetist Name</label>
        <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Full name..." value={staffName} onChange={e => setStaffName(e.target.value)} />
      </div>

      {/* Core Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">ASA Classification</label>
          <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.asa_classification} onChange={e => setForm({...form, asa_classification: e.target.value})}>
            <option>ASA I</option><option>ASA II</option><option>ASA III</option><option>ASA IV</option><option>ASA V</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">Airway</label>
          <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.airway_management} onChange={e => setForm({...form, airway_management: e.target.value})}>
            <option value="mask">Mask</option><option value="lma">LMA</option><option value="ett">ETT</option><option value="tracheostomy">Tracheostomy</option>
          </select>
        </div>
        {form.airway_management === "ett" && (
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1">ETT Size (mm)</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.ett_size} onChange={e => setForm({...form, ett_size: e.target.value})} placeholder="e.g. 7.5" />
          </div>
        )}
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">Ventilation</label>
          <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.ventilation_mode} onChange={e => setForm({...form, ventilation_mode: e.target.value})}>
            <option value="spontaneous">Spontaneous</option><option value="assisted">Assisted</option><option value="controlled">Controlled</option>
          </select>
        </div>
      </div>

      {/* Tabs: Vitals, Events, Drugs, Fluids */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
        {[
          { key: "vitals", label: "Vitals Log", icon: Activity },
          { key: "events", label: "Events", icon: AlertCircle },
          { key: "drugs", label: "Drugs", icon: Plus },
          { key: "fluids", label: "Fluids", icon: Droplets },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-md text-xs font-medium transition-all ${activeTab === tab.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <tab.icon className="w-3 h-3" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Vitals Log */}
      {activeTab === "vitals" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Periodic Vitals ({form.vitals_log.length})</span>
            <button onClick={addVital} className="text-xs text-primary font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
          </div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {form.vitals_log.map((v, i) => (
              <div key={i} className="grid grid-cols-4 gap-1.5 p-2 border border-border rounded-lg bg-muted/10">
                <input className="col-span-1 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Time" value={v.time} onChange={e => updateVital(i, "time", e.target.value)} />
                <input className="rounded border border-border bg-background px-2 py-1 text-xs" placeholder="HR" value={v.hr} onChange={e => updateVital(i, "hr", e.target.value)} />
                <input className="rounded border border-border bg-background px-2 py-1 text-xs" placeholder="BP" value={v.bp_sys} onChange={e => updateVital(i, "bp_sys", e.target.value)} />
                <div className="flex items-center gap-1">
                  <input className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="SpO2" value={v.spo2} onChange={e => updateVital(i, "spo2", e.target.value)} />
                  <button onClick={() => removeVital(i)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events Log */}
      {activeTab === "events" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Intra-op Events ({form.events_log.length})</span>
            <button onClick={addEvent} className="text-xs text-primary font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
          </div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {form.events_log.map((e, i) => (
              <div key={i} className="p-2 border border-border rounded-lg bg-muted/10 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input className="w-20 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Time" value={e.time} onChange={ev => updateEvent(i, "time", ev.target.value)} />
                  <select className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" value={e.event_type} onChange={ev => updateEvent(i, "event_type", ev.target.value)}>
                    {EVENT_TYPES.map(et => <option key={et} value={et}>{et.replace(/_/g, " ")}</option>)}
                  </select>
                  <button onClick={() => removeEvent(i)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                </div>
                <input className="w-full rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Description" value={e.description} onChange={ev => updateEvent(i, "description", ev.target.value)} />
                <input className="w-full rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Action taken" value={e.action_taken} onChange={ev => updateEvent(i, "action_taken", ev.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drugs Tab */}
      {activeTab === "drugs" && (
        <div className="space-y-4">
          {/* Induction Agents */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Induction Agents</span>
              <button onClick={addInductionDrug} className="text-[10px] text-primary font-medium flex items-center gap-1"><Plus className="w-2.5 h-2.5" /> Add</button>
            </div>
            {form.induction_agents.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 mb-1">
                <input className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Drug" value={d.drug} onChange={e => updateInductionDrug(i, "drug", e.target.value)} />
                <input className="w-20 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Dose" value={d.dose} onChange={e => updateInductionDrug(i, "dose", e.target.value)} />
                <button onClick={() => removeInductionDrug(i)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          {/* Maintenance Agents */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Maintenance</span>
              <button onClick={addMaintenanceDrug} className="text-[10px] text-primary font-medium flex items-center gap-1"><Plus className="w-2.5 h-2.5" /> Add</button>
            </div>
            {form.maintenance_agents.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 mb-1">
                <input className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Drug" value={d.drug} onChange={e => updateMaintenanceDrug(i, "drug", e.target.value)} />
                <input className="w-16 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Dose" value={d.dose} onChange={e => updateMaintenanceDrug(i, "dose", e.target.value)} />
                <input className="w-16 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Rate" value={d.rate} onChange={e => updateMaintenanceDrug(i, "rate", e.target.value)} />
                <button onClick={() => removeMaintenanceDrug(i)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          {/* Reversal */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reversal Agents</span>
              <button onClick={addReversal} className="text-[10px] text-primary font-medium flex items-center gap-1"><Plus className="w-2.5 h-2.5" /> Add</button>
            </div>
            {form.reversal_agents.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 mb-1">
                <input className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Drug" value={d.drug} onChange={e => updateReversal(i, "drug", e.target.value)} />
                <input className="w-20 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Dose" value={d.dose} onChange={e => updateReversal(i, "dose", e.target.value)} />
                <button onClick={() => removeReversal(i)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fluids Tab */}
      {activeTab === "fluids" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">IV Fluids ({form.iv_fluids.length})</span>
            <button onClick={addFluid} className="text-xs text-primary font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {form.iv_fluids.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 p-2 border border-border rounded-lg bg-muted/10">
                <input className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" value={f.fluid} onChange={e => updateFluid(i, "fluid", e.target.value)} />
                <input className="w-16 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="mL" value={f.volume_ml} onChange={e => updateFluid(i, "volume_ml", e.target.value)} />
                <input className="w-16 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Time" value={f.time_started} onChange={e => updateFluid(i, "time_started", e.target.value)} />
                <button onClick={() => removeFluid(i)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Blood Loss (mL)</label>
              <input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.estimated_blood_loss_ml} onChange={e => setForm({...form, estimated_blood_loss_ml: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Urine Output (mL)</label>
              <input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.urine_output_ml} onChange={e => setForm({...form, urine_output_ml: Number(e.target.value)})} />
            </div>
          </div>
        </div>
      )}

      {/* Post-op */}
      <div>
        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Disposition</label>
        <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.disposition} onChange={e => setForm({...form, disposition: e.target.value})}>
          <option value="recovery">Recovery</option><option value="icu">ICU</option><option value="ward">Ward</option>
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Post-op Instructions</label>
        <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} value={form.postop_instructions} onChange={e => setForm({...form, postop_instructions: e.target.value})} placeholder="Recovery instructions, monitoring, analgesia plan..." />
      </div>
      <div>
        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Complications</label>
        <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} value={form.complications} onChange={e => setForm({...form, complications: e.target.value})} placeholder="Any intra-operative complications..." />
      </div>

      <button onClick={saveLog} disabled={saving || !staffName.trim()} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 shadow-sm">
        {saving ? "Saving..." : "Complete Anaesthesia Log"}
      </button>
    </div>
  );
}