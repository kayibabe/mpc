import { useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return "";
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--;
    months += 12;
  }
  if (today.getDate() < birthDate.getDate()) {
    months--;
  }
  return years === 0 ? `${months} month${months !== 1 ? 's' : ''}` : `${years} year${years !== 1 ? 's' : ''}`;
};

export default function UnimedClaimForm() {
  const [form, setForm] = useState({
    unimedId: "", cover: "", principalMember: "", university: "",
    patientName: "", dob: "", age: "", relationship: "", treatmentDate: "",
    serviceProvider: "", clinician: "", mcmRegNo: "", diagnosis: "",
    treatments: [{ description: "", cost: "" }],
  });

  const addTreatment = () => {
    setForm({...form, treatments: [...form.treatments, { description: "", cost: "" }]});
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
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Member's Section</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Patient's UNIMED ID</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.unimedId} onChange={e => setForm({...form, unimedId: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Cover</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.cover} onChange={e => setForm({...form, cover: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Principal Member</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.principalMember} onChange={e => setForm({...form, principalMember: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">University</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.university} onChange={e => setForm({...form, university: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Patient Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Patient Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.patientName} onChange={e => setForm({...form, patientName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">DOB</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.dob} onChange={e => setForm({...form, dob: e.target.value, age: calculateAge(e.target.value)})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Age</label><input type="text" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-muted/50" value={form.age} readOnly /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Relationship</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.relationship} onChange={e => setForm({...form, relationship: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Date of Treatment</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.treatmentDate} onChange={e => setForm({...form, treatmentDate: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Provider's Section</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Service Provider</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.serviceProvider} onChange={e => setForm({...form, serviceProvider: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Clinician/Doctor</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.clinician} onChange={e => setForm({...form, clinician: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">MCM Reg No</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.mcmRegNo} onChange={e => setForm({...form, mcmRegNo: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Diagnosis</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Medical Services</h3>
          <button type="button" onClick={addTreatment} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20"><Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="space-y-2 text-xs">
          {form.treatments.map((t, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 p-2 border border-border/60 rounded-lg">
              <input className="col-span-9 rounded border border-border px-2 py-1" placeholder="Description (Consultation, Drugs, Tests, etc.)" value={t.description} onChange={e => handleTreatmentChange(idx, "description", e.target.value)} />
              <input className="col-span-2 rounded border border-border px-2 py-1" placeholder="Cost (MK)" type="number" value={t.cost} onChange={e => handleTreatmentChange(idx, "cost", e.target.value)} />
              <button type="button" onClick={() => removeTreatment(idx)} className="col-span-1 p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save UNIMED Claim</button>
    </form>
  );
}