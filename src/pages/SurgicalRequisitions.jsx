import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Check, Clock, AlertCircle, Search, Loader2, X, Edit2, Trash2, Package } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function SurgicalRequisitions() {
  const [requisitions, setRequisitions] = useState([]);
  const [kits, setKits] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [filterStatus, setFilterStatus] = useState("submitted");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    booking_id: "",
    procedure_name: "",
    scheduled_date: "",
    items: [],
    priority: "routine",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, k, s] = await Promise.all([
        base44.entities.SurgicalRequisition.filter({ status: filterStatus }, "-created_date", 100),
        base44.entities.SurgicalSupplyKit.filter({ status: "active" }, "", 50),
        base44.entities.Drug.filter({ category: { $in: ["surgical", "instruments", "implants"] } }, "", 500),
      ]);
      setRequisitions(reqs);
      setKits(k);
      setSupplies(s);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addItemToForm = (item) => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { item_id: item.id, item_name: item.name, category: item.category, quantity: 1, unit: "pack" }]
    }));
  };

  const removeItemFromForm = (idx) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
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
      setForm(prev => ({
        ...prev,
        items: kitItems
      }));
    } catch (e) { alert("Failed to apply kit"); }
  };

  const saveRequisition = async (e) => {
    e.preventDefault();
    if (!form.booking_id || form.items.length === 0) {
      alert("Please select a booking and add items");
      return;
    }
    
    setSaving(true);
    try {
      const u = await base44.auth.me();
      if (selectedReq) {
        await base44.entities.SurgicalRequisition.update(selectedReq.id, {
          ...form,
          items: JSON.stringify(form.items),
          total_items: form.items.length,
        });
      } else {
        await base44.entities.SurgicalRequisition.create({
          ...form,
          items: JSON.stringify(form.items),
          total_items: form.items.length,
          requested_by_id: u.id,
          requested_by_name: u.display_name || u.full_name || u.email,
          requisition_date: new Date().toISOString(),
          status: "draft",
        });
      }
      loadData();
      setShowForm(false);
      setSelectedReq(null);
      resetForm();
    } catch (e) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const submitRequisition = async (req) => {
    try {
      await base44.entities.SurgicalRequisition.update(req.id, { status: "submitted" });
      loadData();
    } catch (e) { alert("Failed: " + e.message); }
  };

  const approveRequisition = async (req) => {
    try {
      const u = await base44.auth.me();
      await base44.entities.SurgicalRequisition.update(req.id, { 
        status: "approved",
        approved_by_id: u.id,
        approved_date: new Date().toISOString()
      });
      loadData();
    } catch (e) { alert("Failed: " + e.message); }
  };

  const resetForm = () => {
    setForm({
      booking_id: "",
      procedure_name: "",
      scheduled_date: "",
      items: [],
      priority: "routine",
      notes: "",
    });
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container">
      <PageHeader title="Surgical Supply Requisitions" subtitle="Request & manage surgical supplies for scheduled procedures" icon={Package} className="mb-6">
        <button
          onClick={() => { setShowForm(true); setSelectedReq(null); resetForm(); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> New Requisition
        </button>
      </PageHeader>

      {/* Status Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["draft", "submitted", "approved", "partial", "completed"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === s
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Requisitions Table */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {requisitions.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No requisitions in {filterStatus} status.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Procedure</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Scheduled</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Items</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Priority</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map(req => (
                  <tr key={req.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-3 px-4 text-xs">{new Date(req.created_date).toLocaleDateString("en-GB")}</td>
                    <td className="py-3 px-4 font-medium">{req.procedure_name}</td>
                    <td className="py-3 px-4 text-xs">{req.scheduled_date}</td>
                    <td className="py-3 px-4 text-xs">{req.total_items}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        req.priority === "emergency" ? "bg-destructive/10 text-destructive" :
                        req.priority === "urgent" ? "bg-chart-2/10 text-chart-2" :
                        "bg-muted text-muted-foreground"
                      }`}>{req.priority}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        req.status === "approved" || req.status === "completed" ? "bg-chart-3/10 text-chart-3" :
                        req.status === "submitted" ? "bg-chart-1/10 text-chart-1" :
                        "bg-muted text-muted-foreground"
                      }`}>{req.status}</span>
                    </td>
                    <td className="py-3 px-4 flex gap-1">
                      {req.status === "draft" && (
                        <>
                          <button onClick={() => submitRequisition(req)} className="p-1 rounded hover:bg-primary/10 text-primary" title="Submit">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setSelectedReq(req); setForm({ ...req, items: typeof req.items === "string" ? JSON.parse(req.items) : req.items }); setShowForm(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {req.status === "submitted" && (
                        <button onClick={() => approveRequisition(req)} className="p-1 rounded hover:bg-chart-3/10 text-chart-3" title="Approve">
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" /> {selectedReq ? "Edit" : "New"} Requisition
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveRequisition} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Procedure *</label>
                  <input
                    required
                    type="text"
                    value={form.procedure_name}
                    onChange={e => setForm({ ...form, procedure_name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Scheduled Date *</label>
                  <input
                    required
                    type="date"
                    value={form.scheduled_date}
                    onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Apply Supply Kit (Optional)</label>
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-muted-foreground">Items *</label>
                  <span className="text-xs text-muted-foreground">{form.items.length} items</span>
                </div>
                {form.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Add supplies below or apply a kit above</p>
                ) : (
                  <div className="space-y-1.5 mb-3 max-h-[150px] overflow-y-auto">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs">
                        <span className="flex-1 truncate">{item.item_name}</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => updateItemQty(idx, e.target.value)}
                          className="w-12 rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                        <span className="text-muted-foreground">{item.unit}</span>
                        <button type="button" onClick={() => removeItemFromForm(idx)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Add Items</p>
                  <div className="max-h-[120px] overflow-y-auto border border-border rounded-lg">
                    {supplies.map(supply => (
                      <button
                        key={supply.id}
                        type="button"
                        onClick={() => addItemToForm(supply)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 border-b border-border/40 last:border-b-0"
                      >
                        {supply.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Booking ID</label>
                  <input
                    type="text"
                    value={form.booking_id}
                    onChange={e => setForm({ ...form, booking_id: e.target.value })}
                    placeholder="Auto-link or enter manually"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Special instructions, allergies, concerns..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Requisition"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}