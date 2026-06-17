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

export default function LibertyClaimForm() {
  const [form, setForm] = useState({
    invoiceNumber: "",
    firstName: "",
    lastName: "",
    memberNo: "",
    depCode: "",
    gender: "",
    dateOfBirth: "",
    age: "",
    employerName: "",
    email: "",
    contactInfo: "",
    consultingPhysician: "",
    providerNo: "",
    speciality: "",
    treatmentDate: "",
    admissionDate: "",
    dischargeDate: "",
    diagnosisIcd10: "",
    isMaternityClaim: false,
    treatments: [{ description: "", code: "", qty: "", cost: "" }],
  });

  const addTreatment = () => {
    setForm({
      ...form,
      treatments: [...form.treatments, { description: "", code: "", qty: "", cost: "" }],
    });
  };

  const removeTreatment = (idx) => {
    setForm({
      ...form,
      treatments: form.treatments.filter((_, i) => i !== idx),
    });
  };

  const handleTreatmentChange = (idx, field, value) => {
    const updated = [...form.treatments];
    updated[idx][field] = value;
    setForm({ ...form, treatments: updated });
  };

  return (
    <form className="space-y-6 bg-card border border-border/60 rounded-xl p-6">
      {/* Patient Details */}
      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Patient Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">First Name</label>
            <input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Last Name</label>
            <input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Member No</label>
            <input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.memberNo} onChange={e => setForm({...form, memberNo: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Date of Birth</label>
            <input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.dateOfBirth} onChange={e => setForm({...form, dateOfBirth: e.target.value, age: calculateAge(e.target.value)})} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Age</label>
            <input type="text" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-muted/50" value={form.age} readOnly />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Gender</label>
            <select className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
              <option value="">Select</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Dep Code</label>
            <input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.depCode} onChange={e => setForm({...form, depCode: e.target.value})} />
          </div>
        </div>
      </div>

      {/* Provider Details */}
      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Service Provider</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Consulting Physician</label>
            <input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.consultingPhysician} onChange={e => setForm({...form, consultingPhysician: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Provider No</label>
            <input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.providerNo} onChange={e => setForm({...form, providerNo: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Speciality</label>
            <input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.speciality} onChange={e => setForm({...form, speciality: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Treatment Date</label>
            <input type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.treatmentDate} onChange={e => setForm({...form, treatmentDate: e.target.value})} />
          </div>
        </div>
      </div>

      {/* Treatments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Treatment Details</h3>
          <button type="button" onClick={addTreatment} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {form.treatments.map((t, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 p-3 border border-border/60 rounded-lg">
              <input className="col-span-6 rounded border border-border px-2 py-1 text-xs" placeholder="Description" value={t.description} onChange={e => handleTreatmentChange(idx, "description", e.target.value)} />
              <input className="col-span-2 rounded border border-border px-2 py-1 text-xs" placeholder="Code" value={t.code} onChange={e => handleTreatmentChange(idx, "code", e.target.value)} />
              <input className="col-span-2 rounded border border-border px-2 py-1 text-xs" placeholder="Qty" type="number" value={t.qty} onChange={e => handleTreatmentChange(idx, "qty", e.target.value)} />
              <div className="col-span-2 flex items-center gap-1">
                <input className="flex-1 rounded border border-border px-2 py-1 text-xs" placeholder="Cost" type="number" value={t.cost} onChange={e => handleTreatmentChange(idx, "cost", e.target.value)} />
                <button type="button" onClick={() => removeTreatment(idx)} className="p-1 text-destructive hover:bg-destructive/10 rounded">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Diagnosis */}
      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">Diagnosis & Claim Info</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Diagnosis / ICD-10</label>
            <input className="w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.diagnosisIcd10} onChange={e => setForm({...form, diagnosisIcd10: e.target.value})} placeholder="e.g. B54" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isMaternityClaim} onChange={e => setForm({...form, isMaternityClaim: e.target.checked})} className="w-4 h-4" />
              <span className="text-xs text-muted-foreground">Maternity Claim</span>
            </label>
          </div>
        </div>
      </div>

      <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2">
        <Save className="w-4 h-4" /> Save Claim Form
      </button>
    </form>
  );
}