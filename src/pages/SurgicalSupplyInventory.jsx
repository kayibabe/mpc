import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { Package, Plus, Search, AlertTriangle, RefreshCw, Save, Loader2, Edit2, X } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function SurgicalSupplyInventory() {
  const [supplies, setSupplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    category: "instruments",
    quantity_in_stock: 0,
    reorder_level: 5,
    unit_price: 0,
    supplier: "",
    last_restocked: new Date().toISOString().slice(0, 10),
    expiry_date: "",
    status: "active",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load surgical supplies (store in Drug entity as fallback)
      const drugData = await base44.entities.Drug.filter(
        { category: { $in: ["surgical", "instruments", "implants"] } },
        "-updated_date",
        500
      );
      setSupplies(drugData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveSupply = async (e) => {
    e.preventDefault();
    if (!form.name) {
      toast({ title: "Supply name required", description: "Enter a name for the supply item before saving.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (selectedSupply) {
        await base44.entities.Drug.update(selectedSupply.id, form);
      } else {
        await base44.entities.Drug.create({
          ...form,
          quantity_in_stock: Number(form.quantity_in_stock),
          reorder_level: Number(form.reorder_level),
          unit_price: Number(form.unit_price),
        });
      }
      loadData();
      setShowForm(false);
      setSelectedSupply(null);
      resetForm();
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      category: "instruments",
      quantity_in_stock: 0,
      reorder_level: 5,
      unit_price: 0,
      supplier: "",
      last_restocked: new Date().toISOString().slice(0, 10),
      expiry_date: "",
      status: "active",
    });
  };

  const filteredSupplies = supplies.filter(s =>
    s.name.toLowerCase().includes(searchInput.toLowerCase()) ||
    (s.supplier || "").toLowerCase().includes(searchInput.toLowerCase())
  );

  const lowStockSupplies = supplies.filter(s => (s.quantity_in_stock || 0) <= (s.reorder_level || 5));

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Surgical Supply Inventory" subtitle="Instruments, implants, and supplies management" icon={Package} className="mb-6">
        <button
          onClick={() => {
            setShowForm(true);
            setSelectedSupply(null);
            resetForm();
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Add Supply
        </button>
      </PageHeader>

      {/* Low Stock Alert */}
      {lowStockSupplies.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-6 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm text-destructive">{lowStockSupplies.length} Items Low Stock</p>
            <p className="text-xs text-muted-foreground mt-1">Require immediate reorder</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm mb-6 flex items-center gap-3">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search supply or supplier..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="flex-1 rounded-lg border-none bg-transparent text-sm focus:outline-none"
        />
        <button onClick={loadData} className="p-1.5 rounded hover:bg-muted">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Supplies Grid */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {filteredSupplies.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No surgical supplies found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Supply</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stock</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Unit Price</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Supplier</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSupplies.map(supply => {
                  const isLowStock = (supply.quantity_in_stock || 0) <= (supply.reorder_level || 5);
                  return (
                    <tr key={supply.id} className={`border-b border-border/40 hover:bg-muted/30 ${isLowStock ? "bg-destructive/5" : ""}`}>
                      <td className="py-3 px-4 font-medium">{supply.name}</td>
                      <td className="py-3 px-4 capitalize text-xs">{supply.category || "—"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{supply.quantity_in_stock || 0}</span>
                          {isLowStock && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">MWK {(supply.unit_price || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{supply.supplier || "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          supply.status === "active" ? "bg-chart-3/10 text-chart-3" : "bg-muted text-muted-foreground"
                        }`}>
                          {supply.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setSelectedSupply(supply);
                            setForm(supply);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded hover:bg-primary/10 text-primary text-xs"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-2xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" /> {selectedSupply ? "Edit" : "Add"} Supply
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveSupply} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Supply Name *</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="instruments">Instruments</option>
                    <option value="implants">Implants</option>
                    <option value="consumables">Consumables</option>
                    <option value="equipment">Equipment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Stock Count</label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantity_in_stock}
                    onChange={e => setForm({ ...form, quantity_in_stock: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    value={form.reorder_level}
                    onChange={e => setForm({ ...form, reorder_level: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Unit Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unit_price}
                    onChange={e => setForm({ ...form, unit_price: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Supplier</label>
                <input
                  type="text"
                  value={form.supplier}
                  onChange={e => setForm({ ...form, supplier: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Supply"}
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