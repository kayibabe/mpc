import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, Loader2 } from "lucide-react";

export default function SurgicalRequisitionModal({ bookings, inventory, onClose, onSubmit }) {
  const [selectedBooking, setSelectedBooking] = useState("");
  const [items, setItems] = useState([]);
  const [priority, setPriority] = useState("routine");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addItem = () => {
    setItems([...items, { item_id: "", item_name: "", quantity: 1, unit: "unit", notes: "" }]);
  };

  const updateItem = (idx, field, value) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "item_id") {
      const drug = inventory.find(d => d.id === value);
      if (drug) updated[idx].item_name = drug.drug_name;
    }
    setItems(updated);
  };

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!selectedBooking || items.length === 0) {
      setError("Select booking and add at least one item");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const booking = bookings.find(b => b.id === selectedBooking);
      const req = await base44.entities.SurgicalRequisition.create({
        booking_id: selectedBooking,
        patient_id: booking?.patient_id || "",
        procedure_name: booking?.procedure_name || "Unknown",
        scheduled_date: booking?.scheduled_date || new Date().toISOString().slice(0, 10),
        requested_by_id: (await base44.auth.me()).id,
        requested_by_name: (await base44.auth.me()).display_name || (await base44.auth.me()).full_name,
        requisition_date: new Date().toISOString(),
        items: JSON.stringify(items),
        status: "submitted",
        total_items: items.length,
        priority,
        notes,
      });

      // Auto-create dispensing records for each item
      for (const item of items) {
        await base44.entities.SurgicalDispensing.create({
          requisition_id: req.id,
          booking_id: selectedBooking,
          patient_id: booking?.patient_id || "",
          item_id: item.item_id,
          item_name: item.item_name,
          quantity_requested: item.quantity,
          quantity_dispensed: 0,
          unit: item.unit,
          status: "pending",
        });
      }

      onSubmit();
    } catch (e) {
      setError(e.message || "Failed to submit requisition");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBookingData = bookings.find(b => b.id === selectedBooking);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-card rounded-xl border border-border shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-card pb-4 border-b border-border/40">
          <h3 className="text-lg font-semibold">New Supply Requisition</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Booking Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Surgery Booking *</label>
          <select
            value={selectedBooking}
            onChange={e => setSelectedBooking(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a surgery...</option>
            {bookings.map(b => (
              <option key={b.id} value={b.id}>
                {b.procedure_name} - {b.scheduled_date} @ {b.start_time} ({b.theater_room})
              </option>
            ))}
          </select>
          {selectedBookingData && (
            <div className="mt-2 p-3 bg-primary/5 rounded-lg text-xs">
              <p className="font-semibold text-foreground">{selectedBookingData.procedure_name}</p>
              <p className="text-muted-foreground">Surgeon: {selectedBookingData.surgeon_name || "TBD"}</p>
            </div>
          )}
        </div>

        {/* Priority */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Priority</label>
          <div className="flex gap-3">
            {["routine", "urgent", "emergency"].map(p => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  priority === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold">Items to Request *</label>
            <button
              onClick={addItem}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No items added yet. Click "Add Item" to start.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 border border-border/40 rounded-lg space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Item</label>
                      <select
                        value={item.item_id}
                        onChange={e => updateItem(idx, "item_id", e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select item...</option>
                        {inventory.map(drug => (
                          <option key={drug.id} value={drug.id}>
                            {drug.drug_name} (Stock: {drug.quantity_in_stock})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-medium mb-1 block">Notes (optional)</label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={e => updateItem(idx, "notes", e.target.value)}
                        placeholder="e.g., sterile, specific brand..."
                        className="w-full px-2 py-1 rounded border border-border/40 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* General Notes */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">General Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Special instructions, allergies, preferences..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">{error}</div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-card pt-4 border-t border-border/40">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? "Submitting..." : "Submit Requisition"}
          </button>
        </div>
      </div>
    </div>
  );
}