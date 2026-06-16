import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Pill, Plus, Save, AlertTriangle, Package, ShoppingCart, Clock, TrendingDown, Loader2, BarChart3, Calendar, ArrowRight, CheckCircle, GitBranch } from "lucide-react";
import InventoryAlerts from "@/components/InventoryAlerts";

export default function Pharmacy() {
  const [drugs, setDrugs] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [dispensings, setDispensings] = useState([]);
  const [pharmacyJourneys, setPharmacyJourneys] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inventory");
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [drugForm, setDrugForm] = useState({ name: "", generic_name: "", category: "", strength: "", form: "", manufacturer: "", unit_price: "", cost_price: "", quantity_in_stock: "", reorder_level: "10", batch_number: "", expiry_date: "" });

  useEffect(() => {
    async function load() {
      try {
        const [d, p, disp, jList, patList] = await Promise.all([
          base44.entities.Drug.list("-created_date", 200),
          base44.entities.Prescription.filter({ status: { $in: ["pending", "partial"] } }, "-created_date", 50),
          base44.entities.PharmacyDispensing.list("-created_date", 50),
          base44.entities.PatientJourney.filter({ current_stage: { $in: ["PHARMACY_PENDING", "PHARMACY_DISPENSING"] }, status: "active" }, "-created_date", 30),
          base44.entities.Patient.list("-created_date", 100),
        ]);
        setDrugs(d);
        setPrescriptions(p);
        setDispensings(disp);
        setPharmacyJourneys(jList);
        setPatients(patList);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const addDrug = async (e) => {
    e.preventDefault();
    await base44.entities.Drug.create({
      ...drugForm, unit_price: Number(drugForm.unit_price), cost_price: Number(drugForm.cost_price),
      quantity_in_stock: Number(drugForm.quantity_in_stock), reorder_level: Number(drugForm.reorder_level),
    });
    const d = await base44.entities.Drug.list("-created_date", 200);
    setDrugs(d);
    setShowAddDrug(false);
    setDrugForm({ name: "", generic_name: "", category: "", strength: "", form: "", manufacturer: "", unit_price: "", cost_price: "", quantity_in_stock: "", reorder_level: "10", batch_number: "", expiry_date: "" });
  };

  const dispenseDrug = async (drugId) => {
    const drug = drugs.find(d => d.id === drugId);
    const qty = prompt(`Quantity to dispense (in stock: ${drug.quantity_in_stock}):`);
    if (!qty || Number(qty) <= 0 || Number(qty) > drug.quantity_in_stock) return;
    await base44.entities.Drug.update(drugId, { quantity_in_stock: drug.quantity_in_stock - Number(qty) });
    await base44.entities.PharmacyDispensing.create({
      prescription_item_id: "", patient_id: "", drug_name: drug.name, quantity_dispensed: Number(qty), dispensing_date: new Date().toISOString(),
    });
    const [d, disp] = await Promise.all([
      base44.entities.Drug.list("-created_date", 200),
      base44.entities.PharmacyDispensing.list("-created_date", 50),
    ]);
    setDrugs(d);
    setDispensings(disp);
  };

  const getPatientName = (pid) => { const p = patients.find(pt => pt.id === pid); return p ? `${p.first_name} ${p.last_name}` : "Unknown"; };

  const transitionWorkflow = async (journeyId, nextStage, notes = "") => {
    setTransitioning(true);
    try {
      await base44.functions.invoke('handleWorkflowStageChange', { journey_id: journeyId, next_stage: nextStage, notes });
      const jList = await base44.entities.PatientJourney.filter({ current_stage: { $in: ["PHARMACY_PENDING", "PHARMACY_DISPENSING"] }, status: "active" }, "-created_date", 30);
      setPharmacyJourneys(jList);
    } catch (e) {
      alert("Workflow transition failed: " + (e.response?.data?.error || e.message));
    } finally {
      setTransitioning(false);
    }
  };

  const lowStockDrugs = drugs.filter(d => d.quantity_in_stock <= d.reorder_level);
  const expiringDrugs = drugs.filter(d => d.expiry_date && new Date(d.expiry_date) < new Date(Date.now() + 90 * 86400000));

  const loadForecast = async () => {
    setForecastLoading(true);
    try {
      const { data } = await base44.functions.invoke('generateInventoryForecast', {});
      setForecast(data);
    } catch (e) {
      console.error(e);
    } finally {
      setForecastLoading(false);
    }
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Pharmacy</h2>
          <p className="text-sm text-muted-foreground mt-1">Drug inventory, dispensing, and stock management</p>
        </div>
        <button onClick={() => { setShowAddDrug(true); setActiveTab("inventory"); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm">
          <Plus className="w-4 h-4" /> Add Drug
        </button>
      </div>

      <InventoryAlerts />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Pill className="w-5 h-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Drugs</p><p className="text-xl font-bold">{drugs.length}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div><div><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-xl font-bold">{lowStockDrugs.length}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center"><Clock className="w-5 h-5 text-chart-4" /></div><div><p className="text-sm text-muted-foreground">Expiring ≤90 Days</p><p className="text-xl font-bold">{expiringDrugs.length}</p></div></div></div>
      </div>

      <div className="bg-card rounded-xl border border-border/60 shadow-sm">
        <div className="border-b border-border flex">
          {["queue", "inventory", "dispensing", "prescriptions", "forecast"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-3 text-sm font-medium capitalize ${activeTab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>
        <div className="p-4">
          {showAddDrug && (
            <form onSubmit={addDrug} className="mb-6 p-4 bg-muted/30 rounded-xl space-y-3">
              <h4 className="font-heading font-semibold">Add New Drug</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[{label: "Name *", key: "name"}, {label: "Generic Name *", key: "generic_name"}, {label: "Category", key: "category"}, {label: "Strength", key: "strength"}, {label: "Form", key: "form"}, {label: "Manufacturer", key: "manufacturer"}, {label: "Unit Price (MWK) *", key: "unit_price", type: "number"}, {label: "Cost Price (MWK)", key: "cost_price", type: "number"}, {label: "Quantity *", key: "quantity_in_stock", type: "number"}, {label: "Reorder Level", key: "reorder_level", type: "number"}, {label: "Batch Number", key: "batch_number"}, {label: "Expiry Date", key: "expiry_date", type: "date"}].map(f => (
                  <div key={f.key}><label className="block text-xs text-muted-foreground mb-0.5">{f.label}</label><input type={f.type || "text"} required={f.label.includes("*")} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={drugForm[f.key]} onChange={e => setDrugForm({...drugForm, [f.key]: e.target.value})} /></div>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Save className="w-3 h-3 inline mr-1" /> Save Drug</button>
                <button type="button" onClick={() => setShowAddDrug(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
              </div>
            </form>
          )}

          {activeTab === "queue" && (
            <div>
              <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><GitBranch className="w-4 h-4 text-primary" /> Pharmacy Queue ({pharmacyJourneys.length})</h4>
              {pharmacyJourneys.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No patients waiting for pharmacy.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium text-muted-foreground">Patient</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Stage</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Actions</th></tr></thead>
                    <tbody>
                      {pharmacyJourneys.map(j => (
                        <tr key={j.id} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-medium">{getPatientName(j.patient_id)}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              j.current_stage === "PHARMACY_DISPENSING" ? "bg-chart-2/10 text-chart-2" : "bg-chart-4/10 text-chart-4"
                            }`}>{j.current_stage?.replace(/_/g, " ")}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-1 flex-wrap">
                              {j.current_stage === "PHARMACY_PENDING" && (
                                <button
                                  onClick={() => transitionWorkflow(j.id, "PHARMACY_DISPENSING", "Started dispensing")}
                                  disabled={transitioning}
                                  className="px-2 py-1 bg-chart-2/10 text-chart-2 rounded text-xs font-medium hover:bg-chart-2/20"
                                >
                                  <ArrowRight className="w-3 h-3 inline mr-0.5" /> Start
                                </button>
                              )}
                              {j.current_stage === "PHARMACY_DISPENSING" && (
                                <button
                                  onClick={() => transitionWorkflow(j.id, "NURSING_ADMINISTRATION", "Drugs dispensed")}
                                  disabled={transitioning}
                                  className="px-2 py-1 bg-chart-3/10 text-chart-3 rounded text-xs font-medium hover:bg-chart-3/20"
                                >
                                  <ArrowRight className="w-3 h-3 inline mr-0.5" /> Send to Nursing
                                </button>
                              )}
                              <button
                                onClick={() => transitionWorkflow(j.id, "BILLING", "Pharmacy complete")}
                                disabled={transitioning}
                                className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20"
                              >
                                <ArrowRight className="w-3 h-3 inline mr-0.5" /> Send to Billing
                              </button>
                              <button
                                onClick={() => transitionWorkflow(j.id, "COMPLETED", "Pharmacy done")}
                                disabled={transitioning}
                                className="px-2 py-1 bg-chart-3/10 text-chart-3 rounded text-xs font-medium hover:bg-chart-3/20"
                              >
                                <CheckCircle className="w-3 h-3 inline mr-0.5" /> Complete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "inventory" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium text-muted-foreground">Drug</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Strength</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Stock</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Price</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Expiry</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Actions</th></tr></thead>
                <tbody>
                  {drugs.map(d => (
                    <tr key={d.id} className={`border-b border-border/40 hover:bg-muted/30 ${d.quantity_in_stock <= d.reorder_level ? "bg-destructive/5" : ""}`}>
                      <td className="py-2.5 px-3"><p className="font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.generic_name}</p></td>
                      <td className="py-2.5 px-3">{d.strength || "—"}</td>
                      <td className="py-2.5 px-3"><span className={d.quantity_in_stock <= d.reorder_level ? "text-destructive font-semibold" : ""}>{d.quantity_in_stock}</span></td>
                      <td className="py-2.5 px-3">MWK {d.unit_price?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">{d.expiry_date || "—"}</td>
                      <td className="py-2.5 px-3"><button onClick={() => dispenseDrug(d.id)} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20">Dispense</button></td>
                    </tr>
                  ))}
                  {drugs.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No drugs in inventory.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "dispensing" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Drug</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Quantity</th></tr></thead>
                <tbody>
                  {dispensings.map(d => (
                    <tr key={d.id} className="border-b border-border/40"><td className="py-2.5 px-3">{new Date(d.dispensing_date).toLocaleDateString("en-GB")}</td><td className="py-2.5 px-3 font-medium">{d.drug_name}</td><td className="py-2.5 px-3">{d.quantity_dispensed}</td></tr>
                  ))}
                  {dispensings.length === 0 && <tr><td colSpan={3} className="py-12 text-center text-sm text-muted-foreground">No dispensing records.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "prescriptions" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Patient ID</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th></tr></thead>
                <tbody>
                  {prescriptions.map(p => (
                    <tr key={p.id} className="border-b border-border/40"><td className="py-2.5 px-3">{new Date(p.created_date).toLocaleDateString("en-GB")}</td><td className="py-2.5 px-3 font-mono text-xs">{p.patient_id?.slice(0, 8)}</td><td className="py-2.5 px-3 capitalize">{p.status}</td></tr>
                  ))}
                  {prescriptions.length === 0 && <tr><td colSpan={3} className="py-12 text-center text-sm text-muted-foreground">No pending prescriptions.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "forecast" && (
            <div>
              {!forecast ? (
                <div className="py-12 text-center">
                  <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">Generate an inventory forecast based on 90-day consumption patterns with seasonal adjustments.</p>
                  <button onClick={loadForecast} disabled={forecastLoading} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                    {forecastLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />}
                    {forecastLoading ? "Analyzing..." : "Generate Forecast"}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold">
                        Generated: {new Date(forecast.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-xs text-muted-foreground">Based on 90-day consumption · {forecast.total_drugs} drugs analyzed</p>
                    </div>
                    <button onClick={loadForecast} disabled={forecastLoading} className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted">
                      {forecastLoading ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null} Refresh
                    </button>
                  </div>

                  {forecast.peak_season_active && (
                    <div className="mb-4 p-3 bg-chart-2/10 border border-chart-2/30 rounded-lg flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-chart-2" />
                      <p className="text-xs font-medium text-chart-2">Peak season active (Dec–Apr) — Malaria & seasonal drug multipliers applied</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3 bg-destructive/5 rounded-lg text-center border border-destructive/20">
                      <p className="text-lg font-bold text-destructive">{forecast.critical_count}</p>
                      <p className="text-xs text-muted-foreground">Critical</p>
                    </div>
                    <div className="p-3 bg-chart-2/5 rounded-lg text-center border border-chart-2/20">
                      <p className="text-lg font-bold text-chart-2">{forecast.warning_count}</p>
                      <p className="text-xs text-muted-foreground">Need Restock</p>
                    </div>
                    <div className="p-3 bg-chart-3/5 rounded-lg text-center border border-chart-3/20">
                      <p className="text-lg font-bold text-chart-3">{forecast.adequate_count}</p>
                      <p className="text-xs text-muted-foreground">Adequate</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Drug</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Stock</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Daily Use</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Reorder At</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Days Left</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                      </tr></thead>
                      <tbody>
                        {forecast.items.map((f, i) => (
                          <tr key={i} className={`border-b border-border/40 ${
                            f.status === "critical" ? "bg-destructive/5" : f.status === "warning" ? "bg-chart-2/5" : ""
                          }`}>
                            <td className="py-2.5 px-3">
                              <p className="font-medium text-sm">{f.drug_name}</p>
                              {f.seasonality_active && <span className="text-xs text-chart-2">⚡ {f.seasonality_multiplier}x seasonal</span>}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs">{f.current_stock}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{f.average_daily_consumption.toFixed(1)}/day</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{f.reorder_point}</td>
                            <td className="py-2.5 px-3">
                              <span className={`font-mono text-xs font-semibold ${
                                f.days_of_stock_remaining <= f.safety_stock_days ? "text-destructive" :
                                f.days_of_stock_remaining <= f.lead_time_days ? "text-chart-2" : "text-chart-3"
                              }`}>
                                {f.days_of_stock_remaining === 999 ? "—" : f.days_of_stock_remaining}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                f.status === "critical" ? "bg-destructive/10 text-destructive" :
                                f.status === "warning" ? "bg-chart-2/10 text-chart-2" : "bg-chart-3/10 text-chart-3"
                              }`}>{f.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}