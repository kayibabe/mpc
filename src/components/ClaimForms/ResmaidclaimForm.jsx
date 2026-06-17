import { useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";

export default function ResmaidClaimForm() {
  const [form, setForm] = useState({
    memberName: "", headOffice: "", patientName: "", dob: "", gender: "",
    relationship: "", treatmentDate: "", providerName: "", providerNo: "",
    illnessReason: "", accidentType: "",
    treatments: [{ category: "", description: "", cost: "" }],
  });

  const addTreatment = () => {
    setForm({...form, treatments: [...form.treatments, { category: "", description: "", cost: "" }]});
  };

  const removeTreatment = (idx) => {
    setForm({...form, treatments: form.treatments.filter((_, i) => i !== idx)});
  };

  const handleTreatmentChange = (idx, field, value) => {
    const updated = [...form.treatments];
    updated[idx][field] = value;
    setForm({ ...form, treatments: updated });
  };

  return (
    <form className="space-y-6 bg-card border border-border/60 rounded-xl p-6">
      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Member & Patient Info</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Member Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.memberName} onChange={e => setForm({...form, memberName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Head Office/Branch</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.headOffice} onChange={e => setForm({...form, headOffice: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Patient Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.patientName} onChange={e => setForm({...form, patientName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">DOB</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Treatment & Provider</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Treatment Date</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.treatmentDate} onChange={e => setForm({...form, treatmentDate: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Provider Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.providerName} onChange={e => setForm({...form, providerName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Provider No</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.providerNo} onChange={e => setForm({...form, providerNo: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Gender</label><select className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}><option value="">Select</option><option value="M">Male</option><option value="F">Female</option></select></div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Cost Breakdown</h3>
          <button type="button" onClick={addTreatment} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20"><Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="space-y-2 text-xs">
          {form.treatments.map((t, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 p-2 border border-border/60 rounded-lg">
              <select className="col-span-3 rounded border border-border px-2 py-1" value={t.category} onChange={e => handleTreatmentChange(idx, "category", e.target.value)}>
                <option value="">Select Category</option>
                <option value="Consultation">Consultation</option>
                <option value="Medical">Medical</option>
                <option value="Dentistry">Dentistry</option>
                <option value="Optical">Optical</option>
              </select>
              <input className="col-span-6 rounded border border-border px-2 py-1" placeholder="Description" value={t.description} onChange={e => handleTreatmentChange(idx, "description", e.target.value)} />
              <input className="col-span-2 rounded border border-border px-2 py-1" placeholder="Cost (K)" type="number" value={t.cost} onChange={e => handleTreatmentChange(idx, "cost", e.target.value)} />
              <button type="button" onClick={() => removeTreatment(idx)} className="col-span-1 p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save RESMAID Claim</button>
    </form>
  );
}