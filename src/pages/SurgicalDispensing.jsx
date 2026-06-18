import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Check, Clock, AlertCircle, Loader2, X } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function SurgicalDispensing() {
  const [requisitions, setRequisitions] = useState([]);
  const [dispensing, setDispensing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReq, setExpandedReq] = useState(null);
  const [dispensingForm, setDispensingForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, disp] = await Promise.all([
        base44.entities.SurgicalRequisition.filter({ status: { $in: ["approved", "partial"] } }, "-created_date", 100),
        base44.entities.SurgicalDispensing.filter({ status: { $in: ["pending", "dispensed"] } }, "-created_date", 200),
      ]);
      setRequisitions(reqs);
      setDispensing(disp);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getDispensingForReq = (reqId) => {
    return dispensing.filter(d => d.requisition_id === reqId);
  };

  const dispenseItem = async (req, item, idx) => {
    const key = `${req.id}-${idx}`;
    const qty = Number(dispensingForm[key]?.quantity) || 0;
    if (qty <= 0) { alert("Enter valid quantity"); return; }

    setSaving(true);
    try {
      const u = await base44.auth.me();
      const existing = dispensing.find(d => d.requisition_id === req.id && d.item_id === item.item_id);
      
      if (existing) {
        await base44.entities.SurgicalDispensing.update(existing.id, {
          quantity_dispensed: qty,
          status: "dispensed",
          dispensed_by_id: u.id,
          dispensed_by_name: u.display_name || u.full_name,
          dispensed_date: new Date().toISOString(),
        });
      } else {
        await base44.entities.SurgicalDispensing.create({
          requisition_id: req.id,
          booking_id: req.booking_id,
          patient_id: req.patient_id,
          item_id: item.item_id,
          item_name: item.item_name,
          quantity_requested: item.quantity,
          quantity_dispensed: qty,
          unit: item.unit,
          status: "dispensed",
          dispensed_by_id: u.id,
          dispensed_by_name: u.display_name || u.full_name,
          dispensed_date: new Date().toISOString(),
        });
      }
      
      setDispensingForm(prev => ({ ...prev, [key]: {} }));
      loadData();
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const receiveItems = async (reqId) => {
    try {
      const u = await base44.auth.me();
      const reqDispensing = dispensing.filter(d => d.requisition_id === reqId);
      
      for (const d of reqDispensing) {
        if (d.status === "dispensed") {
          await base44.entities.SurgicalDispensing.update(d.id, {
            status: "received",
            received_by_id: u.id,
            received_by_name: u.display_name || u.full_name,
            received_date: new Date().toISOString(),
          });
        }
      }

      const allItems = requisitions.find(r => r.id === reqId).total_items;
      const receivedItems = reqDispensing.filter(d => d.status === "dispensed").length;
      
      await base44.entities.SurgicalRequisition.update(reqId, {
        status: receivedItems === allItems ? "completed" : "partial",
        items_fulfilled: receivedItems,
      });

      loadData();
    } catch (e) {
      alert("Failed: " + e.message);
    }
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container">
      <PageHeader title="Surgical Supply Dispensing" subtitle="Issue & track surgical supplies to theater" icon={Package} />

      <div className="space-y-4 mt-6">
        {requisitions.length === 0 ? (
          <div className="bg-card rounded-xl border border-border/60 p-12 text-center">
            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No approved requisitions awaiting dispensing.</p>
          </div>
        ) : (
          requisitions.map(req => {
            const reqDispensing = getDispensingForReq(req.id);
            const reqItems = typeof req.items === "string" ? JSON.parse(req.items) : req.items;
            const allDispensed = reqDispensing.length === reqItems.length;

            return (
              <div key={req.id} className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedReq(expandedReq === req.id ? null : req.id)}
                  className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/20 transition-colors border-b border-border/40"
                >
                  <div className="text-left flex-1">
                    <p className="font-semibold">{req.procedure_name}</p>
                    <p className="text-xs text-muted-foreground">Scheduled: {req.scheduled_date} • {req.total_items} items</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{reqDispensing.length}/{reqItems.length} dispensed</span>
                    {allDispensed && <Check className="w-4 h-4 text-chart-3" />}
                    {!allDispensed && <Clock className="w-4 h-4 text-chart-1" />}
                  </div>
                </button>

                {expandedReq === req.id && (
                  <div className="px-4 py-4 space-y-3">
                    {reqItems.map((item, idx) => {
                      const dispensed = reqDispensing.find(d => d.item_id === item.item_id);
                      const key = `${req.id}-${idx}`;

                      return (
                        <div key={idx} className={`p-3 rounded-lg border ${
                          dispensed ? "border-chart-3/20 bg-chart-3/5" : "border-border/40 bg-muted/10"
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{item.item_name}</p>
                              <p className="text-xs text-muted-foreground">Required: {item.quantity} {item.unit}</p>
                            </div>
                            {dispensed ? (
                              <div className="text-right">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-chart-3/10 text-chart-3 text-xs font-medium">
                                  <Check className="w-3 h-3" /> {dispensed.quantity_dispensed} issued
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  max={item.quantity}
                                  placeholder="Qty"
                                  value={dispensingForm[key]?.quantity || ""}
                                  onChange={e => setDispensingForm(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key], quantity: e.target.value }
                                  }))}
                                  className="w-16 rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <button
                                  onClick={() => dispenseItem(req, item, idx)}
                                  disabled={saving}
                                  className="px-2 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {allDispensed && (
                      <button
                        onClick={() => receiveItems(req.id)}
                        className="w-full px-4 py-2 bg-chart-3 text-white rounded-lg text-sm font-medium hover:bg-chart-3/90"
                      >
                        Confirm Receipt to Theater
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}