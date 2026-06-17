import { useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";

export default function WemasClaimForm() {
  const [form, setForm] = useState({
    claimNo: "", invoiceNo: "", patientNo: "", firstName: "", memberSurname: "",
    employerAddress: "", phoneNo: "", patientSurname: "", patientFirstName: "",
    homeAddress: "", gender: "", dob: "", relationshipToMember: "", membershipNo: "",
    admissionDate: "", dischargeDate: "", providerName: "", referringDoctor: "",
    treatments: [{ date: "", tariffCode: "", description: "", serviceType: "", unitDays: "", qty: "", fee: "" }],
    diagnosticCodes: ["", "", "", "", "", ""],
  });

  const addTreatment = () => {
    setForm({...form, treatments: [...form.treatments, { date: "", tariffCode: "", description: "", serviceType: "", unitDays: "", qty: "", fee: "" }]});
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
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Claim Info</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Claim No</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.claimNo} onChange={e => setForm({...form, claimNo: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Invoice No</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.invoiceNo} onChange={e => setForm({...form, invoiceNo: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Patient No</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.patientNo} onChange={e => setForm({...form, patientNo: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Member No</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.membershipNo} onChange={e => setForm({...form, membershipNo: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Patient Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">First Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Surname</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.patientSurname} onChange={e => setForm({...form, patientSurname: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">DOB</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Gender</label><select className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}><option value="">Select</option><option value="M">Male</option><option value="F">Female</option></select></div>
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
              <input className="col-span-2 rounded border border-border px-2 py-1" placeholder="Code" value={t.tariffCode} onChange={e => handleTreatmentChange(idx, "tariffCode", e.target.value)} />
              <input className="col-span-3 rounded border border-border px-2 py-1" placeholder="Description" value={t.description} onChange={e => handleTreatmentChange(idx, "description", e.target.value)} />
              <input className="col-span-1 rounded border border-border px-2 py-1" placeholder="Qty" type="number" value={t.qty} onChange={e => handleTreatmentChange(idx, "qty", e.target.value)} />
              <input className="col-span-2 rounded border border-border px-2 py-1" placeholder="Fee (MK)" type="number" value={t.fee} onChange={e => handleTreatmentChange(idx, "fee", e.target.value)} />
              <button type="button" onClick={() => removeTreatment(idx)} className="col-span-1 p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save WEMAS Claim</button>
    </form>
  );
}