import { useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";

export default function PreciousClaimForm() {
  const [form, setForm] = useState({
    claimNumber: "", schemeType: "", memberSurname: "", firstName: "",
    employerAddress: "", telephone: "", patientSurname: "", patientFirstName: "",
    address: "", dob: "", relationshipToMember: "", membershipNo: "",
    admissionDate: "", dischargeDate: "", facilityName: "", providerNo: "",
    treatments: [{ date: "", code: "", unitCost: "", days: "", qty: "", cost: "" }],
  });

  const addTreatment = () => {
    setForm({...form, treatments: [...form.treatments, { date: "", code: "", unitCost: "", days: "", qty: "", cost: "" }]});
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
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Member Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Claim Number</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.claimNumber} onChange={e => setForm({...form, claimNumber: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Scheme Type</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.schemeType} onChange={e => setForm({...form, schemeType: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Member Surname</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.memberSurname} onChange={e => setForm({...form, memberSurname: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">First Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Employer Address</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.employerAddress} onChange={e => setForm({...form, employerAddress: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Telephone</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Patient Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Patient Surname</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.patientSurname} onChange={e => setForm({...form, patientSurname: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">First Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.patientFirstName} onChange={e => setForm({...form, patientFirstName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">DOB</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Relationship</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.relationshipToMember} onChange={e => setForm({...form, relationshipToMember: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">In-Patient Treatment</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Admission Date</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.admissionDate} onChange={e => setForm({...form, admissionDate: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Discharge Date</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.dischargeDate} onChange={e => setForm({...form, dischargeDate: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Facility Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.facilityName} onChange={e => setForm({...form, facilityName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Provider No</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.providerNo} onChange={e => setForm({...form, providerNo: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Treatment & Investigation</h3>
          <button type="button" onClick={addTreatment} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20"><Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="space-y-2 text-xs">
          {form.treatments.map((t, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 p-2 border border-border/60 rounded-lg">
              <input type="date" className="col-span-2 rounded border border-border px-2 py-1" value={t.date} onChange={e => handleTreatmentChange(idx, "date", e.target.value)} />
              <input className="col-span-2 rounded border border-border px-2 py-1" placeholder="Code" value={t.code} onChange={e => handleTreatmentChange(idx, "code", e.target.value)} />
              <input className="col-span-1 rounded border border-border px-2 py-1" placeholder="Unit" type="number" value={t.unitCost} onChange={e => handleTreatmentChange(idx, "unitCost", e.target.value)} />
              <input className="col-span-1 rounded border border-border px-2 py-1" placeholder="Days" type="number" value={t.days} onChange={e => handleTreatmentChange(idx, "days", e.target.value)} />
              <input className="col-span-1 rounded border border-border px-2 py-1" placeholder="Qty" type="number" value={t.qty} onChange={e => handleTreatmentChange(idx, "qty", e.target.value)} />
              <input className="col-span-2 rounded border border-border px-2 py-1" placeholder="Cost" type="number" value={t.cost} onChange={e => handleTreatmentChange(idx, "cost", e.target.value)} />
              <button type="button" onClick={() => removeTreatment(idx)} className="col-span-1 p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save Precious Claim</button>
    </form>
  );
}