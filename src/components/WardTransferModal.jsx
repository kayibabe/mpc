import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowRightLeft } from "lucide-react";

export default function WardTransferModal({ patient, admission, onComplete, onCancel }) {
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    to_ward_id: "",
    to_bed_id: "",
    reason: "bed_availability",
    clinical_notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const init = async () => {
    try {
      const w = await base44.entities.Ward.list("", 50);
      setWards(w);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleWardChange = async (wardId) => {
    setForm({ ...form, to_ward_id: wardId, to_bed_id: "" });
    try {
      const b = await base44.entities.Bed.filter(
        { ward_id: wardId, status: "available" },
        "",
        50
      );
      setBeds(b);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.to_ward_id || !form.to_bed_id) {
      alert("Select destination ward and bed");
      return;
    }

    setSubmitting(true);
    try {
      const selectedBed = beds.find(b => b.id === form.to_bed_id);
      const selectedWard = wards.find(w => w.id === form.to_ward_id);
      const user = await base44.auth.me();

      // Create transfer record
      await base44.entities.WardTransfer.create({
        patient_id: patient.id,
        admission_id: admission.id,
        from_ward_id: admission.ward_id,
        from_ward_name: admission.ward_name,
        from_bed_id: admission.bed_id,
        from_bed_number: admission.bed_number,
        to_ward_id: form.to_ward_id,
        to_ward_name: selectedWard.name,
        to_bed_id: form.to_bed_id,
        to_bed_number: selectedBed.bed_number,
        transfer_date: new Date().toISOString(),
        reason: form.reason,
        clinical_notes: form.clinical_notes,
        approved_by_id: user.id,
        approved_by_name: user.full_name,
        status: "completed",
      });

      // Update admission with new bed info
      await base44.entities.Admission.update(admission.id, {
        ward_id: form.to_ward_id,
        ward_name: selectedWard.name,
        bed_id: form.to_bed_id,
        bed_number: selectedBed.bed_number,
      });

      // Release old bed
      const oldBed = await base44.entities.Bed.get(admission.bed_id);
      if (oldBed) {
        await base44.entities.Bed.update(oldBed.id, { status: "cleaning" });
      }

      // Assign new bed as occupied
      await base44.entities.Bed.update(form.to_bed_id, { status: "occupied", patient_id: patient.id });

      onComplete?.();
    } catch (e) {
      alert("Transfer failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && wards.length === 0) {
    init();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
        <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-primary" /> Transfer Ward
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted/20 rounded-lg text-sm">
            <p>
              <strong>{patient?.first_name} {patient?.last_name}</strong> — Currently in{" "}
              <strong>{admission?.ward_name}</strong> Bed {admission?.bed_number}
            </p>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Destination Ward *</label>
            <select
              required
              value={form.to_ward_id}
              onChange={(e) => handleWardChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select ward...</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {beds.length > 0 && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Available Bed *
              </label>
              <select
                required
                value={form.to_bed_id}
                onChange={(e) => setForm({ ...form, to_bed_id: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select bed...</option>
                {beds.map((b) => (
                  <option key={b.id} value={b.id}>
                    Bed {b.bed_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Reason *</label>
            <select
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="clinical_deterioration">Clinical Deterioration</option>
              <option value="clinical_improvement">Clinical Improvement</option>
              <option value="infection_control">Infection Control</option>
              <option value="isolation">Isolation</option>
              <option value="bed_availability">Bed Availability</option>
              <option value="patient_request">Patient Request</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Clinical Notes</label>
            <textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              value={form.clinical_notes}
              onChange={(e) => setForm({ ...form, clinical_notes: e.target.value })}
              placeholder="Any clinical notes for the transfer..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting || !beds.length}
              className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Processing..." : "Complete Transfer"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 border border-border rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}