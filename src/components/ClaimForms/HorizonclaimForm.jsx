import { useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";

export default function HorizonClaimForm() {
  const [form, setForm] = useState({
    membershipNo: "", typeOfCover: "", principalName: "", employer: "", dob: "",
    patientName: "", relationship: "", treatmentDate: "", providerName: "",
    treatments: [{ date: "", description: "", serviceType: "", unitDays: "", qty: "", feeCharged: "" }],
  });

  const addTreatment = () => {
    setForm({...form, treatments: [...form.treatments, { date: "", description: "", serviceType: "", unitDays: "", qty: "", feeCharged: "" }]});
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
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Member Section</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Membership No</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.membershipNo} onChange={e => setForm({...form, membershipNo: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Type of Cover</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.typeOfCover} onChange={e => setForm({...form, typeOfCover: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Principal Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.principalName} onChange={e => setForm({...form, principalName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Employer</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.employer} onChange={e => setForm({...form, employer: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Patient Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Patient Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.patientName} onChange={e => setForm({...form, patientName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Relationship</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.relationship} onChange={e => setForm({...form, relationship: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">DOB</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Date of Treatment</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.treatmentDate} onChange={e => setForm({...form, treatmentDate: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Treatment Details</h3>
          <button type="button" onClick={addTreatment} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20"><Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="space-y-2 text-xs">
          {form.treatments.map((t, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 p-2 border border-border/60 rounded-lg">
              <input type="date" className="col-span-2 rounded border border-border px-2 py-1" value={t.date} onChange={e => handleTreatmentChange(idx, "date", e.target.value)} />
              <input className="col-span-4 rounded border border-border px-2 py-1" placeholder="Description" value={t.description} onChange={e => handleTreatmentChange(idx, "description", e.target.value)} />
              <input className="col-span-2 rounded border border-border px-2 py-1" placeholder="Service Type" value={t.serviceType} onChange={e => handleTreatmentChange(idx, "serviceType", e.target.value)} />
              <input className="col-span-2 rounded border border-border px-2 py-1" placeholder="Fee (K)" type="number" value={t.feeCharged} onChange={e => handleTreatmentChange(idx, "feeCharged", e.target.value)} />
              <button type="button" onClick={() => removeTreatment(idx)} className="col-span-1 p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save Horizon Claim</button>
    </form>
  );
}