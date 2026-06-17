import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, Package, RefreshCw, Save, Loader2, Search } from "lucide-react";

export default function InventoryAudit() {
  const [drugs, setDrugs] = useState([]);
  const [reagents, setReagents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [auditForm, setAuditForm] = useState({ physical_count: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [discrepancies, setDiscrepancies] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [drugData, reagentData] = await Promise.all([
        base44.entities.Drug.list("-updated_date", 500),
        base44.entities.LabReagent.list("-updated_date", 200),
      ]);
      setDrugs(drugData);
      setReagents(reagentData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const auditItem = async (e) => {
    e.preventDefault();
    if (!selectedItem || !auditForm.physical_count) {
      alert("Please enter physical count");
      return;
    }

    setSaving(true);
    try {
      const isReagent = selectedItem.type === "reagent";
      const entity = isReagent ? base44.entities.LabReagent : base44.entities.Drug;
      const physicalCount = Number(auditForm.physical_count);
      const systemCount = isReagent ? selectedItem.quantity_in_stock : selectedItem.quantity_in_stock;

      const discrepancy = physicalCount - systemCount;

      // Persist discrepancy to AuditLog if variance exists
      if (discrepancy !== 0) {
        const discrepancyRecord = {
          item: selectedItem.name,
          type: isReagent ? "Reagent" : "Drug",
          system_count: systemCount,
          physical_count: physicalCount,
          discrepancy: discrepancy,
          notes: auditForm.notes,
          date: new Date().toISOString(),
        };
        setDiscrepancies(prev => [...prev, discrepancyRecord]);

        // Log to backend AuditLog
        await base44.entities.AuditLog.create({
          user_id: (await base44.auth.me()).id,
          action: "inventory_audit_discrepancy",
          entity_type: isReagent ? "LabReagent" : "Drug",
          entity_id: selectedItem.id,
          changes: JSON.stringify(discrepancyRecord),
          timestamp: new Date().toISOString(),
        });
      }

      // Update system with physical count
      await entity.update(selectedItem.id, {
        quantity_in_stock: physicalCount,
        last_audit_date: new Date().toISOString(),
      });

      loadData();
      setSelectedItem(null);
      setAuditForm({ physical_count: "", notes: "" });
    } catch (e) {
      alert("Audit failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredDrugs = drugs.filter(d => d.name.toLowerCase().includes(searchInput.toLowerCase()));
  const filteredReagents = reagents.filter(r => r.name.toLowerCase().includes(searchInput.toLowerCase()));

  const lowStockDrugs = drugs.filter(d => (d.quantity_in_stock || 0) <= (d.reorder_level || 10));
  const expiredReagents = reagents.filter(r => new Date(r.expiry_date) < new Date());

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Inventory Audit</h2>
          <p className="text-sm text-muted-foreground mt-1">Physical stock verification and discrepancy tracking</p>
        </div>
        <button onClick={loadData} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Alerts */}
      {(lowStockDrugs.length > 0 || expiredReagents.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {lowStockDrugs.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-destructive">{lowStockDrugs.length} Drugs Low Stock</p>
                  <p className="text-xs text-muted-foreground mt-1">Need immediate reorder</p>
                </div>
              </div>
            </div>
          )}
          {expiredReagents.length > 0 && (
            <div className="bg-chart-2/5 border border-chart-2/20 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-chart-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-chart-2">{expiredReagents.length} Reagents Expired</p>
                  <p className="text-xs text-muted-foreground mt-1">Require disposal</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Item Selector */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm sticky top-4">
            <h4 className="font-heading font-semibold text-sm mb-3">Select Item to Audit</h4>
            <div className="relative mb-3">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-8 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="max-h-[600px] overflow-y-auto space-y-1">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Drugs</p>
                {filteredDrugs.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedItem({ ...d, type: "drug" })}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors ${
                      selectedItem?.id === d.id
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div className="font-medium">{d.name}</div>
                    <div className="text-[9px] text-muted-foreground">Stock: {d.quantity_in_stock || 0}</div>
                  </button>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 mt-3">Reagents</p>
                {filteredReagents.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedItem({ ...r, type: "reagent" })}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors ${
                      selectedItem?.id === r.id
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[9px] text-muted-foreground">Stock: {r.quantity_in_stock || 0}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Audit Form & Details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedItem ? (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h4 className="font-heading font-semibold text-sm mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> Audit {selectedItem.name}
              </h4>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">System Count</p>
                  <p className="text-lg font-bold">{selectedItem.quantity_in_stock || 0}</p>
                </div>
                <div className="p-3 bg-primary/5 rounded-lg">
                  <p className="text-xs text-primary font-medium">Reorder Level</p>
                  <p className="text-lg font-bold">{selectedItem.reorder_level || 0}</p>
                </div>
              </div>

              {selectedItem.type === "reagent" && selectedItem.expiry_date && (
                <div className={`p-3 rounded-lg mb-4 text-xs ${
                  new Date(selectedItem.expiry_date) < new Date()
                    ? "bg-destructive/5 border border-destructive/20 text-destructive"
                    : "bg-chart-3/5 border border-chart-3/20 text-chart-3"
                }`}>
                  Expiry: {new Date(selectedItem.expiry_date).toLocaleDateString("en-GB")}
                </div>
              )}

              <form onSubmit={auditItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Physical Count *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={auditForm.physical_count}
                    onChange={e => setAuditForm({ ...auditForm, physical_count: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0"
                  />
                </div>

                {auditForm.physical_count && (
                  <div className={`p-3 rounded-lg text-sm font-medium ${
                    Number(auditForm.physical_count) === (selectedItem.quantity_in_stock || 0)
                      ? "bg-chart-3/10 text-chart-3 border border-chart-3/20"
                      : "bg-chart-2/10 text-chart-2 border border-chart-2/20"
                  }`}>
                    Variance: {Number(auditForm.physical_count) - (selectedItem.quantity_in_stock || 0)} units
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                  <textarea
                    value={auditForm.notes}
                    onChange={e => setAuditForm({ ...auditForm, notes: e.target.value })}
                    placeholder="Condition, damage, etc..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Auditing..." : "Complete Audit"}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border/60 p-12 shadow-sm text-center">
              <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Select an item to begin audit.</p>
            </div>
          )}

          {/* Discrepancies */}
          {discrepancies.length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h4 className="font-heading font-semibold text-sm mb-3">Audit Discrepancies</h4>
              <div className="space-y-2">
                {discrepancies.map((d, i) => (
                  <div key={i} className={`p-3 rounded-lg border text-sm ${
                    d.discrepancy > 0 ? "bg-chart-3/5 border-chart-3/20" : "bg-chart-2/5 border-chart-2/20"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">{d.item} ({d.type})</p>
                      <span className={`font-bold ${d.discrepancy > 0 ? "text-chart-3" : "text-chart-2"}`}>
                        {d.discrepancy > 0 ? "+" : ""}{d.discrepancy}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">System: {d.system_count} → Physical: {d.physical_count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}