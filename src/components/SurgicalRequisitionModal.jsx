import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Plus, X, Loader2, Check, AlertCircle } from "lucide-react";

export default function SurgicalRequisitionModal({ booking, onClose, onSuccess }) {
  const [form, setForm] = useState({
    items: [],
    priority: "routine",
    notes: "",
  });
  const [supplies, setSupplies] = useState([]);
  const [kits, setKits] = useState([]);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    loadData();
    checkExisting();
  }, [booking]);

  const loadData = async () => {
    try {
      const [s, k] = await Promise.all([
        base44.entities.Drug.filter({ category: { $in: ["surgical", "instruments", "implants"] } }, "", 500),
        base44.entities.SurgicalSupplyKit.filter({ status: "active" }, "", 50),
      ]);
      setSupplies(s);
      setKits(k);
    } catch (e) { console.error(e); }
  };

  const checkExisting = async () => {
    try {
      const reqs = await base44.entities.SurgicalRequisition.filter(
        { booking_id: booking.id, status: { $in: ["draft", "submitted", "approved"] } },
        "-created_date",
        1
      );
      if (reqs.length > 0) {
        setExisting(reqs[0]);
        setForm(prev => ({
          ...prev,
          items: typeof reqs[0].items === "string" ? JSON.parse(reqs[0].items) : reqs[0].items,
          priority: reqs[0].priority,
          notes: reqs[0].notes,
        }));
      }
    } catch (e) { console.error(e); }
  };

  const addItem = (supply) => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { item_id: supply.id, item_name: supply.name, category: supply.category, quantity: 1, unit: "pack" }]
    }));
  };

  const removeItem = (idx) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateItemQty = (idx, qty) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[idx].quantity = Number(qty) || 0;
      return { ...prev, items: newItems };
    });
  };

  const applyKit = (kit) => {
    try {
      const kitItems = typeof kit.items === "string" ? JSON.parse(kit.items) : kit.items;
      setForm(prev => ({ ...prev, items: kitItems }));
    } catch (e) { alert("Failed to apply kit"); }
  };

  const saveRequisition = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) {
      alert("Please add at least one item");
      return;
    }

    setSaving(true);
    try {
      const u = await base44.auth.me();
      const reqData = {
        booking_id: booking.id,
        patient_id: booking.patient_id,
        procedure_name: booking.procedure_name,
        scheduled_date: booking.scheduled_date,
        items: JSON.stringify(form.items),
        total_items: form.items.length,
        priority: form.priority,
        notes: form.notes,
        requested_by_id: u.id,
        requested_by_name: u.display_name || u.full_name || u.email,
        requisition_date: new Date().toISOString(),
      };

      if (existing) {
        await base44.entities.SurgicalRequisition.update(existing.id, reqData);
      } else {
        await base44.entities.SurgicalRequisition.create({
          ...reqData,
          status: "draft",
        });
      }

      onSuccess?.();
      onClose();
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-xl border border-border shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" /> {existing ? "Edit" : "New"} Supply Requisition
            </h3>
            <p className="text-xs text-muted-foreground mt-1">{booking.procedure_name} — {booking.scheduled_date}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        {existing && existing.status !== "draft" && (
          <div className="mb-4 p-3 bg-chart-1/5 border border-chart-1/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-chart-1 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-medium text-chart-1">Requisition already {existing.status}</p>
              <p className="text-muted-foreground">You can view or edit in draft status only</p>
            </div>
          </div>
        )}

        <form onSubmit={saveRequisition} className="space-y-4">
          {/* Quick Kit Apply */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Quick Apply Kit (Optional)</label>
            <div className="flex gap-2 flex-wrap">
              {kits.map(kit => (
                <button
                  key={kit.id}
                  type="button"
                  onClick={() => applyKit(kit)}
                  className="px-2 py-1 bg-chart-4/10 text-chart-4 rounded text-xs font-medium hover:bg-chart-4/20"
                >
                  {kit.kit_name}
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-muted-foreground">Supplies ({form.items.length})</label>
              {form.items.length > 0 && <Check className="w-4 h-4 text-chart-3" />}
            </div>

            {form.items.length > 0 && (
              <div className="space-y-1.5 mb-3 max-h-[150px] overflow-y-auto">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs">
                    <span className="flex-1 truncate font-medium">{item.item_name}</span>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => updateItemQty(idx, e.target.value)}
                      className="w-12 rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                    <span className="text-muted-foreground text-[10px]">{item.unit}</span>
                    <button type="button" onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Items */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground">Add Supplies</p>
              <div className="max-h-[120px] overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {supplies.map(supply => (
                  <button
                    key={supply.id}
                    type="button"
                    onClick={() => addItem(supply)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex items-center justify-between"
                  >
                    <span>{supply.name}</span>
                    <Plus className="w-3 h-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Priority & Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Special instructions, concerns..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-border/40">
            <button
              type="submit"
              disabled={saving || form.items.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Saving..." : existing ? "Update" : "Create"} Requisition
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">
              Cancel
            </button>
          </div>

          {existing && existing.status === "draft" && (
            <p className="text-[10px] text-muted-foreground text-center pt-2">This requisition is in draft. Submit it in the requisitions page to request approval.</p>
          )}
        </form>
      </div>
    </div>
  );
}