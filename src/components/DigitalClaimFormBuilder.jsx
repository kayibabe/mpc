import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, X, Loader2, Check, AlertCircle } from "lucide-react";

export default function DigitalClaimFormBuilder({ invoice, onClose, onSave }) {
  const [patient, setPatient] = useState(null);
  const [consultation, setConsultation] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const [form, setForm] = useState({
    scheme_id: "",
    scheme_name: "",
    patient_name: "",
    patient_dob: "",
    member_number: "",
    diagnosis: "",
    diagnosis_code: "",
    treatment_items: [],
    consultation_fee: "0",
    hospitalization_fee: "0",
    drugs_fee: "0",
    lab_fee: "0",
    total_amount: "0",
  });

  useEffect(() => {
    if (invoice?.patient_id) {
      loadPatientData(invoice.patient_id);
    }
    loadSchemes();
  }, [invoice]);

  const loadSchemes = async () => {
    try {
      const data = await base44.entities.MedicalAidScheme.list("", 50);
      setSchemes(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPatientData = async (patientId) => {
    setLoading(true);
    try {
      const [patientData, consultationData, prescriptionData] = await Promise.all([
        base44.entities.Patient.get(patientId),
        base44.entities.Consultation.filter({ patient_id: patientId }, "-created_date", 1),
        base44.entities.Prescription.filter({ patient_id: patientId }, "-created_date", 1).then(async (presc) => {
          if (presc.length === 0) return [];
          const items = await base44.entities.PrescriptionItem.filter({ prescription_id: presc[0].id }, "", 50);
          return items;
        }).catch(() => []),
      ]);

      setPatient(patientData);

      // Set patient details
      setForm((prev) => ({
        ...prev,
        patient_name: `${patientData.first_name} ${patientData.last_name}`,
        patient_dob: patientData.date_of_birth || "",
        member_number: patientData.medical_aid_number || "",
      }));

      // Auto-populate diagnosis from consultation
      if (consultationData.length > 0) {
        const consul = consultationData[0];
        setConsultation(consul);
        setForm((prev) => ({
          ...prev,
          diagnosis: consul.diagnosis_description || "",
          diagnosis_code: consul.icd10_code || "",
        }));
      }

      // Auto-populate medications from prescription
      if (prescriptionData.length > 0) {
        const items = prescriptionData.map((item) => ({
          description: item.drug_name || item.generic_name || "Unknown",
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total: (item.quantity || 1) * (item.unit_price || 0),
        }));
        setForm((prev) => ({
          ...prev,
          treatment_items: items,
          drugs_fee: items.reduce((sum, item) => sum + (item.total || 0), 0).toString(),
        }));
        setPrescriptions(prescriptionData);
      }
    } catch (e) {
      console.error("Error loading patient data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTreatmentItem = () => {
    setForm((prev) => ({
      ...prev,
      treatment_items: [...prev.treatment_items, { description: "", quantity: 1, unit_price: 0, total: 0 }],
    }));
  };

  const handleUpdateTreatmentItem = (index, field, value) => {
    const items = [...form.treatment_items];
    items[index] = { ...items[index], [field]: value };
    if (field === "quantity" || field === "unit_price") {
      items[index].total = (Number(items[index].quantity) || 0) * (Number(items[index].unit_price) || 0);
    }
    setForm((prev) => ({
      ...prev,
      treatment_items: items,
      drugs_fee: items.reduce((sum, item) => sum + (item.total || 0), 0).toString(),
    }));
  };

  const handleRemoveTreatmentItem = (index) => {
    const items = form.treatment_items.filter((_, i) => i !== index);
    setForm((prev) => ({
      ...prev,
      treatment_items: items,
      drugs_fee: items.reduce((sum, item) => sum + (item.total || 0), 0).toString(),
    }));
  };

  const calculateTotal = () => {
    const total = (Number(form.consultation_fee) || 0) +
      (Number(form.hospitalization_fee) || 0) +
      (Number(form.drugs_fee) || 0) +
      (Number(form.lab_fee) || 0);
    setForm((prev) => ({ ...prev, total_amount: total.toString() }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.scheme_id || !form.diagnosis) {
      alert("Please select a scheme and confirm diagnosis");
      return;
    }

    setSaving(true);
    try {
      await base44.entities.InsuranceClaim.create({
        invoice_id: invoice?.id || "",
        patient_id: invoice?.patient_id || "",
        scheme_id: form.scheme_id,
        scheme_name: form.scheme_name,
        claim_amount: Number(form.total_amount) || 0,
        co_pay_amount: 0,
        status: "pending",
      });

      setSuccessMessage("Claim form created successfully!");
      setTimeout(() => {
        setSuccessMessage(null);
        if (onSave) onSave();
      }, 1500);
    } catch (e) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full bg-card rounded-xl border border-border/60 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-heading text-lg font-semibold">Digital Insurance Claim Form</h3>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {successMessage && (
        <div className="mb-4 p-3 bg-chart-3/10 border border-chart-3/20 rounded-lg flex items-center gap-2 text-sm text-chart-3">
          <Check className="w-4 h-4" /> {successMessage}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Scheme Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Medical Aid Scheme *</label>
            <select
              required
              value={form.scheme_id}
              onChange={(e) => {
                const scheme = schemes.find((s) => s.id === e.target.value);
                setForm((prev) => ({
                  ...prev,
                  scheme_id: e.target.value,
                  scheme_name: scheme?.name || "",
                }));
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select scheme</option>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Patient Details (Read-only) */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/20 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Patient Name</p>
            <p className="text-sm font-semibold mt-1">{form.patient_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">DOB</p>
            <p className="text-sm font-semibold mt-1">{form.patient_dob || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Member #</p>
            <p className="text-sm font-semibold mt-1">{form.member_number || "N/A"}</p>
          </div>
        </div>

        {/* Diagnosis Section */}
        <div className="border-t border-border pt-4">
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-chart-1" /> Diagnosis
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Diagnosis Description *</label>
              <textarea
                required
                value={form.diagnosis}
                onChange={(e) => setForm((prev) => ({ ...prev, diagnosis: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows="3"
                placeholder="Auto-populated from latest consultation"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">ICD-10 Code</label>
              <input
                type="text"
                value={form.diagnosis_code}
                onChange={(e) => setForm((prev) => ({ ...prev, diagnosis_code: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g., A00"
              />
            </div>
          </div>
        </div>

        {/* Treatment Items */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm">Treatment Items (Medications)</h4>
            <button
              type="button"
              onClick={handleAddTreatmentItem}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20"
            >
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>

          {form.treatment_items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">No treatment items. Auto-populated from prescriptions if available.</p>
          ) : (
            <div className="space-y-2">
              {form.treatment_items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2 items-end">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleUpdateTreatmentItem(idx, "description", e.target.value)}
                    placeholder="Drug name"
                    className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleUpdateTreatmentItem(idx, "quantity", e.target.value)}
                    placeholder="Qty"
                    className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => handleUpdateTreatmentItem(idx, "unit_price", e.target.value)}
                    placeholder="Unit Price"
                    className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="bg-muted/30 rounded px-2 py-1 text-xs font-semibold">
                    {(item.total || 0).toLocaleString()}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTreatmentItem(idx)}
                    className="text-destructive hover:bg-destructive/10 rounded p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Breakdown */}
        <div className="border-t border-border pt-4">
          <h4 className="font-medium text-sm mb-3">Cost Breakdown</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Consultation Fee (MWK)</label>
              <input
                type="number"
                value={form.consultation_fee}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, consultation_fee: e.target.value }));
                  setTimeout(calculateTotal, 0);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Hospitalization Fee (MWK)</label>
              <input
                type="number"
                value={form.hospitalization_fee}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, hospitalization_fee: e.target.value }));
                  setTimeout(calculateTotal, 0);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Drugs Fee (MWK)</label>
              <input
                type="number"
                value={form.drugs_fee}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, drugs_fee: e.target.value }));
                  setTimeout(calculateTotal, 0);
                }}
                disabled
                className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Lab Fee (MWK)</label>
              <input
                type="number"
                value={form.lab_fee}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, lab_fee: e.target.value }));
                  setTimeout(calculateTotal, 0);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Total */}
          <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Total Claim Amount</span>
              <span className="font-bold text-lg text-primary">
                MWK {(Number(form.total_amount) || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-border pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? "Creating..." : "Create Insurance Claim"}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}