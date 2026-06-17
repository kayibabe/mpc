import { useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";

export default function ZombacityClaimForm() {
  const [form, setForm] = useState({
    memberName: "", employmentNo: "", patientName: "", relationshipToMember: "",
    dob: "", sex: "", age: "", contacts: "", institution: "", treatmentDate: "", illnessDiagnosis: "",
    treatments: [{ consultation: "", drugs: "", labTest: "", amount: "" }],
  });

  const addTreatment = () => {
    setForm({...form, treatments: [...form.treatments, { consultation: "", drugs: "", labTest: "", amount: "" }]});
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
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Member Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Member Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.memberName} onChange={e => setForm({...form, memberName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Employment No</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.employmentNo} onChange={e => setForm({...form, employmentNo: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Contacts</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.contacts} onChange={e => setForm({...form, contacts: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Patient Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Patient Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.patientName} onChange={e => setForm({...form, patientName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Relationship</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.relationshipToMember} onChange={e => setForm({...form, relationshipToMember: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">DOB</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Sex</label><select className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.sex} onChange={e => setForm({...form, sex: e.target.value})}><option value="">Select</option><option value="M">Male</option><option value="F">Female</option></select></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Age</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.age} onChange={e => setForm({...form, age: e.target.value})} type="number" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Date of Treatment</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.treatmentDate} onChange={e => setForm({...form, treatmentDate: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Illness / Diagnosis</h3>
        <input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.illnessDiagnosis} onChange={e => setForm({...form, illnessDiagnosis: e.target.value})} placeholder="Enter diagnosis" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Services</h3>
          <button type="button" onClick={addTreatment} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20"><Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="space-y-2 text-xs">
          {form.treatments.map((t, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 p-2 border border-border/60 rounded-lg">
              <input className="col-span-3 rounded border border-border px-2 py-1" placeholder="Consultation" type="number" value={t.consultation} onChange={e => handleTreatmentChange(idx, "consultation", e.target.value)} />
              <input className="col-span-3 rounded border border-border px-2 py-1" placeholder="Drugs" type="number" value={t.drugs} onChange={e => handleTreatmentChange(idx, "drugs", e.target.value)} />
              <input className="col-span-3 rounded border border-border px-2 py-1" placeholder="Lab Test" type="number" value={t.labTest} onChange={e => handleTreatmentChange(idx, "labTest", e.target.value)} />
              <button type="button" onClick={() => removeTreatment(idx)} className="col-span-1 p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save Zomba City Claim</button>
    </form>
  );
}