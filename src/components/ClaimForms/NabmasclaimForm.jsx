import { useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";

export default function NabmasClaimForm() {
  const [form, setForm] = useState({
    employeeName: "", employeeId: "", centerHeadOffice: "", treatmentDate: "", patientName: "",
    doctorHospitalAddress: "", nabmasRegNo: "", visitType: "ordinary",
    treatments: [{ category: "", description: "", cost: "" }],
    diagnosis: "",
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
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Member Section</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Employee Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.employeeName} onChange={e => setForm({...form, employeeName: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Employee ID</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Center/Head Office</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.centerHeadOffice} onChange={e => setForm({...form, centerHeadOffice: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Patient Name</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.patientName} onChange={e => setForm({...form, patientName: e.target.value})} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Doctor's Section</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Treatment Date</label><input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.treatmentDate} onChange={e => setForm({...form, treatmentDate: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Doctor/Hospital</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.doctorHospitalAddress} onChange={e => setForm({...form, doctorHospitalAddress: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">NABMAS Reg No</label><input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.nabmasRegNo} onChange={e => setForm({...form, nabmasRegNo: e.target.value})} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Visit Type</label><select className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.visitType} onChange={e => setForm({...form, visitType: e.target.value})}><option value="ordinary">Ordinary</option><option value="emergency">Emergency</option><option value="afterhours">After Hours</option><option value="referral">Referral</option></select></div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Billing Details</h3>
          <button type="button" onClick={addTreatment} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20"><Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="space-y-2 text-xs">
          {form.treatments.map((t, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 p-2 border border-border/60 rounded-lg">
              <select className="col-span-4 rounded border border-border px-2 py-1" value={t.category} onChange={e => handleTreatmentChange(idx, "category", e.target.value)}>
                <option value="">Select</option>
                <option value="consultation">Consultation</option>
                <option value="hospitalization">Hospitalization</option>
                <option value="drugs">Drugs</option>
                <option value="dentistry">Dentistry</option>
              </select>
              <input className="col-span-5 rounded border border-border px-2 py-1" placeholder="Description" value={t.description} onChange={e => handleTreatmentChange(idx, "description", e.target.value)} />
              <input className="col-span-2 rounded border border-border px-2 py-1" placeholder="Cost (K)" type="number" value={t.cost} onChange={e => handleTreatmentChange(idx, "cost", e.target.value)} />
              <button type="button" onClick={() => removeTreatment(idx)} className="col-span-1 p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save NABMAS Claim</button>
    </form>
  );
}