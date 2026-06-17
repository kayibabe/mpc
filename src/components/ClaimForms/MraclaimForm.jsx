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

export default function MraClaimForm() {
  const [form, setForm] = useState({
    memberName: "", empNo: "", department: "", age: "", sex: "",
    dateOfTreatment: "", doctorAddress: "", illnessReason: "",
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
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Member Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Member Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.memberName} onChange={e => setForm({...form, memberName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Emp No</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.empNo} onChange={e => setForm({...form, empNo: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Department</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.department} onChange={e => setForm({...form, department: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Sex</label><select className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.sex} onChange={e => setForm({...form, sex: e.target.value})}><option value="">Select</option><option value="M">Male</option><option value="F">Female</option></select></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Treatment Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Date of Treatment</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.dateOfTreatment} onChange={e => setForm({...form, dateOfTreatment: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Doctor Address</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.doctorAddress} onChange={e => setForm({...form, doctorAddress: e.target.value})} /></div>
          <div className="md:col-span-2"><label className="block text-xs text-muted-foreground mb-1">Nature of Illness</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.illnessReason} onChange={e => setForm({...form, illnessReason: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Cost Breakdown</h3>
          <button type="button" onClick={addTreatment} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20"><Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="space-y-2">
          {form.treatments.map((t, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 p-3 border border-border/60 rounded-lg">
              <input className="col-span-9 rounded border border-border px-2 py-1 text-xs" placeholder="Description (Consultation, Drugs, Lab, etc.)" value={t.description} onChange={e => handleTreatmentChange(idx, "description", e.target.value)} />
              <input className="col-span-2 rounded border border-border px-2 py-1 text-xs" placeholder="Cost (K)" type="number" value={t.cost} onChange={e => handleTreatmentChange(idx, "cost", e.target.value)} />
              <button type="button" onClick={() => removeTreatment(idx)} className="col-span-1 p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save MRA Claim</button>
    </form>
  );
}