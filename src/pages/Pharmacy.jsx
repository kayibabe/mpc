import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Pill, Plus, Save, AlertTriangle, Clock, TrendingDown, Loader2, BarChart3, Calendar, ArrowRight, CheckCircle, GitBranch, PenTool, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import InventoryAlerts from "@/components/InventoryAlerts";
import ExpiryAlerts from "@/components/ExpiryAlerts";
import PatientJourneyTimeline from "@/components/PatientJourneyTimeline";
import DepartmentDashboard from "@/components/DepartmentDashboard";
import SignaturePad from "@/components/SignaturePad";
import SignatureStatus from "@/components/SignatureStatus";
import PharmacyRequisitionDashboard from "@/components/PharmacyRequisitionDashboard";
import PageHeader from "@/components/ui/PageHeader";

export default function Pharmacy() {
  const [drugs, setDrugs] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [dispensings, setDispensings] = useState([]);
  const [pharmacyJourneys, setPharmacyJourneys] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inventory");
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Signature state
  const [signingDoc, setSigningDoc] = useState(null);
  const [savingSignature, setSavingSignature] = useState(false);
  const [drugForm, setDrugForm] = useState({ name: "", generic_name: "", category: "", strength: "", form: "", manufacturer: "", unit_price: "", cost_price: "", quantity_in_stock: "", reorder_level: "10", batch_number: "", expiry_date: "" });

  useEffect(() => {
    async function load() {
      try {
        const [d, p, pi, disp, jList, patList] = await Promise.all([
          base44.entities.Drug.list("-created_date", 200),
          base44.entities.Prescription.filter({ status: { $in: ["pending", "partial"] } }, "-created_date", 50),
          base44.entities.PrescriptionItem.filter({ status: { $in: ["pending", "partial"] } }, "-created_date", 100),
          base44.entities.PharmacyDispensing.list("-created_date", 50),
          base44.entities.PatientJourney.filter({ current_stage: { $in: ["PHARMACY_PENDING", "PHARMACY_DISPENSING"] }, status: "active" }, "-created_date", 30),
          base44.entities.Patient.list("-created_date", 100),
        ]);
        setDrugs(d);
        setPrescriptions(p);
        setPrescriptionItems(pi);
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

  // ── Proper Dispensing Modal State ──
  const [dispenseModal, setDispenseModal] = useState(null); // { drug, prescriptionItem }
  const [dispenseQty, setDispenseQty] = useState("");
  const [wasteConfirm, setWasteConfirm] = useState(null); // drug pending disposal

  const openDispenseModal = (drug, prescriptionItem = null) => {
    setDispenseModal({ drug, prescriptionItem, counselingNotes: "" });
    setDispenseQty(prescriptionItem ? String(prescriptionItem.quantity) : "1");
  };

  const dispenseDrug = async () => {
    if (!dispenseModal) return;
    const { drug, prescriptionItem } = dispenseModal;
    const qty = Number(dispenseQty);
    if (!qty || qty <= 0 || qty > drug.quantity_in_stock) return;

    await base44.entities.Drug.update(drug.id, { quantity_in_stock: drug.quantity_in_stock - qty });

    await base44.entities.PharmacyDispensing.create({
      prescription_item_id: prescriptionItem?.id || "",
      prescription_id: prescriptionItem?.prescription_id || "",
      patient_id: prescriptionItem?.patient_id || "",
      drug_name: drug.name,
      quantity_dispensed: qty,
      batch_number: drug.batch_number || "",
      dispensing_date: new Date().toISOString(),
      dispensed_by: "pharmacy",
      counseling_notes: dispenseModal.counselingNotes || "",
    });

    // Update prescription item status
    if (prescriptionItem?.id) {
      const remaining = (prescriptionItem.quantity || 0) - qty;
      await base44.entities.PrescriptionItem.update(prescriptionItem.id, {
        status: remaining <= 0 ? "dispensed" : "partial",
        quantity: remaining < 0 ? 0 : remaining,
      });
    }

    const [d, disp] = await Promise.all([
      base44.entities.Drug.list("-created_date", 200),
      base44.entities.PharmacyDispensing.list("-created_date", 50),
    ]);
    setDrugs(d);
    setDispensings(disp);
    setDispenseModal(null);
    setDispenseQty("");
  };

  const disposeAsWaste = (drug) => {
    setWasteConfirm(drug);
  };

  const doDisposeAsWaste = async () => {
    const drug = wasteConfirm;
    setWasteConfirm(null);
    if (!drug) return;
    try {
      const cats = await base44.entities.WasteCategory.filter({ code: "PHM" }, "", 1);
      const catId = cats.length > 0 ? cats[0].id : null;
      await base44.entities.WasteLog.create({
        waste_category_id: catId || "",
        category_code: "PHM",
        origin_department: "pharmacy",
        quantity_kg: (drug.quantity_in_stock || 0) * 0.05,
        container_count: 1,
        disposal_method: "incineration",
        notes: `Expired/recalled drug: ${drug.name} (batch ${drug.batch_number || "N/A"}, expiry ${drug.expiry_date || "N/A"}). ${drug.quantity_in_stock} units disposed.`,
        generated_by: "pharmacy_staff",
        generated_at: new Date().toISOString(),
        status: "generated",
        linked_document_type: "expired_drug",
        linked_document_id: drug.id,
        sla_deadline: new Date(Date.now() + 168 * 3600000).toISOString(),
      });
      await base44.entities.Drug.update(drug.id, { status: "discontinued", quantity_in_stock: 0 });
      const d = await base44.entities.Drug.list("-created_date", 200);
      setDrugs(d);
      toast({ title: "Waste disposal logged", description: `${drug.name} marked for incineration.` });
    } catch (e) {
      toast({ title: "Waste disposal failed", description: e.message || "Unknown error", variant: "destructive" });
    }
  };

  const getPatientName = (pid) => { const p = patients.find(pt => pt.id === pid); return p ? `${p.first_name} ${p.last_name}` : "Unknown"; };

  const handleSaveSignature = async (file) => {
    if (!signingDoc) return;
    setSavingSignature(true);
    try {
      const { data: uploadData } = await base44.integrations.Core.UploadFile({ file });
      await base44.functions.invoke("saveSignature", {
        file_url: uploadData.file_url,
        document_type: "prescription_dispensed",
        document_id: signingDoc.document_id,
        patient_id: signingDoc.patient_id || '',
        visit_id: '',
      });
      setSigningDoc(null);
      const disp = await base44.entities.PharmacyDispensing.list("-created_date", 50);
      setDispensings(disp);
    } catch (e) {
      console.error('Signature save failed:', e);
    } finally {
      setSavingSignature(false);
    }
  };

  const transitionWorkflow = async (journeyId, nextStage, notes = "") => {
    setTransitioning(true);
    try {
      await base44.functions.invoke('handleWorkflowStageChange', { journey_id: journeyId, next_stage: nextStage, notes });
      const jList = await base44.entities.PatientJourney.filter({ current_stage: { $in: ["PHARMACY_PENDING", "PHARMACY_DISPENSING"] }, status: "active" }, "-created_date", 30);
      setPharmacyJourneys(jList);
    } catch (e) {
      toast({ title: "Workflow transition failed", description: e.response?.data?.error || e.message, variant: "destructive" });
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
      <PageHeader title="Pharmacy" subtitle="Drug inventory, dispensing, and stock management" icon={Pill} className="mb-6">
        <button onClick={() => { setShowAddDrug(true); setActiveTab("inventory"); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm">
          <Plus className="w-4 h-4" /> Add Drug
        </button>
      </PageHeader>

      <DepartmentDashboard department="pharmacy" />

      <InventoryAlerts />
      <ExpiryAlerts department="pharmacy" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Pill className="w-5 h-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Drugs</p><p className="text-xl font-bold">{drugs.length}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div><div><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-xl font-bold">{lowStockDrugs.length}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center"><Clock className="w-5 h-5 text-chart-4" /></div><div><p className="text-sm text-muted-foreground">Expiring ≤90 Days</p><p className="text-xl font-bold">{expiringDrugs.length}</p></div></div></div>
      </div>

      <PharmacyRequisitionDashboard />

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
                          <td className="py-2.5 px-3">
                            <span className="font-medium block">{getPatientName(j.patient_id)}</span>
                            <PatientJourneyTimeline journeyId={j.id} compact />
                          </td>
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
                <thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium text-muted-foreground">Drug</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Strength</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Stock</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Price</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Expiry</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">FEFO</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Actions</th></tr></thead>
                <tbody>
                  {[...drugs].sort((a, b) => { if (!a.expiry_date) return 1; if (!b.expiry_date) return -1; return new Date(a.expiry_date) - new Date(b.expiry_date); }).map(d => {
                    const daysToExpiry = d.expiry_date ? Math.round((new Date(d.expiry_date) - Date.now()) / 86400000) : null;
                    return (
                    <tr key={d.id} className={`border-b border-border/40 hover:bg-muted/30 ${d.quantity_in_stock <= d.reorder_level ? "bg-destructive/5" : ""}`}>
                      <td className="py-2.5 px-3"><p className="font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.generic_name}</p></td>
                      <td className="py-2.5 px-3">{d.strength || "—"}</td>
                      <td className="py-2.5 px-3"><span className={d.quantity_in_stock <= d.reorder_level ? "text-destructive font-semibold" : ""}>{d.quantity_in_stock}</span></td>
                      <td className="py-2.5 px-3">MWK {d.unit_price?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">{d.expiry_date || "—"}</td>
                      <td className={`py-2.5 px-3 text-xs font-mono ${daysToExpiry !== null && daysToExpiry <= 30 ? "text-destructive font-bold" : daysToExpiry !== null && daysToExpiry <= 90 ? "text-triage-semi font-semibold" : "text-muted-foreground"}`}>
                        {daysToExpiry !== null ? `${daysToExpiry}d` : "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1 flex-wrap">
                          <button onClick={() => openDispenseModal(d)} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20">Dispense</button>
                          {(d.status === "discontinued" || d.status === "recalled" || d.quantity_in_stock <= 0 || (d.expiry_date && new Date(d.expiry_date) < new Date())) && (
                            <button onClick={() => disposeAsWaste(d)} className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium hover:bg-destructive/20 flex items-center gap-1">
                              <Trash2 className="w-3 h-3" /> Dispose
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );})}
                  {drugs.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No drugs in inventory.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "dispensing" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Drug</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Quantity</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Signature</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Actions</th></tr></thead>
                <tbody>
                  {dispensings.map(d => (
                    <tr key={d.id} className="border-b border-border/40">
                      <td className="py-2.5 px-3">{new Date(d.dispensing_date).toLocaleDateString("en-GB")}</td>
                      <td className="py-2.5 px-3 font-medium">{d.drug_name}</td>
                      <td className="py-2.5 px-3">{d.quantity_dispensed}</td>
                      <td className="py-2.5 px-3">
                        <SignatureStatus documentType="prescription_dispensed" documentId={d.id} compact />
                      </td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => setSigningDoc({ document_type: "prescription_dispensed", document_id: d.id, patient_id: d.patient_id })} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20 flex items-center gap-1">
                          <PenTool className="w-3 h-3" /> Sign
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dispensings.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No dispensing records.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "prescriptions" && (
            <div className="overflow-x-auto">
              {prescriptionItems.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No pending prescription items to dispense.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Patient</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Drug</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Dosage</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Qty</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Action</th>
                  </tr></thead>
                  <tbody>
                    {prescriptionItems.map(item => {
                      const presc = prescriptions.find(p => p.id === item.prescription_id);
                      const drug = drugs.find(d => d.name?.toLowerCase() === item.drug_name?.toLowerCase() || d.generic_name?.toLowerCase() === item.drug_name?.toLowerCase());
                      return (
                        <tr key={item.id} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-medium">{getPatientName(presc?.patient_id)}</td>
                          <td className="py-2.5 px-3">{item.drug_name}</td>
                          <td className="py-2.5 px-3 text-xs">{item.dosage} {item.frequency} {item.duration}</td>
                          <td className="py-2.5 px-3 font-mono text-xs">{item.quantity}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.status === "dispensed" ? "bg-chart-3/10 text-chart-3" : "bg-chart-4/10 text-chart-4"
                            }`}>{item.status}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            {item.status !== "dispensed" && drug && (
                              <button
                                onClick={() => openDispenseModal(drug, { ...item, patient_id: presc?.patient_id })}
                                className="px-2 py-1 bg-chart-2/10 text-chart-2 rounded text-xs font-medium hover:bg-chart-2/20"
                              >
                                Dispense
                              </button>
                            )}
                            {!drug && item.status !== "dispensed" && (
                              <span className="text-xs text-destructive">Not in stock</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
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

      {/* Dispensing Modal */}
      {dispenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDispenseModal(null)} />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-card rounded-xl border border-border/60 p-6 shadow-2xl">
            <h3 className="font-heading text-lg font-semibold mb-4">Dispense Drug</h3>
            <div className="space-y-3">
              <div className="p-3 bg-muted/20 rounded-lg">
                <p className="text-sm font-semibold">{dispenseModal.drug.name}</p>
                <p className="text-xs text-muted-foreground">{dispenseModal.drug.generic_name} · {dispenseModal.drug.strength}</p>
                <p className="text-xs mt-1">In stock: <span className="font-semibold">{dispenseModal.drug.quantity_in_stock}</span></p>
              </div>
              {dispenseModal.prescriptionItem && (
                <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg text-xs">
                  <p><strong>Prescribed:</strong> {dispenseModal.prescriptionItem.dosage} {dispenseModal.prescriptionItem.frequency} × {dispenseModal.prescriptionItem.duration}</p>
                  <p><strong>Ordered qty:</strong> {dispenseModal.prescriptionItem.quantity}</p>
                  <p><strong>Patient:</strong> {getPatientName(dispenseModal.prescriptionItem.patient_id)}</p>
                </div>
              )}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Quantity to Dispense</label>
                <input
                  type="number"
                  min="1"
                  max={dispenseModal.drug.quantity_in_stock}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={dispenseQty}
                  onChange={e => setDispenseQty(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Counseling Notes</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={2}
                  placeholder="Medication counseling: dosage, side effects, storage..."
                  value={dispenseModal.counselingNotes}
                  onChange={e => setDispenseModal({...dispenseModal, counselingNotes: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={dispenseDrug}
                disabled={!dispenseQty || Number(dispenseQty) <= 0 || Number(dispenseQty) > dispenseModal.drug.quantity_in_stock}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                Confirm Dispense
              </button>
              <button onClick={() => setDispenseModal(null)} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      {signingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSigningDoc(null)} />
          <div className="relative z-10 w-full max-w-lg mx-4">
            <SignaturePad
              title="Sign Dispensing Record"
              onSave={handleSaveSignature}
              onCancel={() => setSigningDoc(null)}
              saving={savingSignature}
            />
          </div>
        </div>
      )}

      {/* Waste disposal confirmation */}
      <AlertDialog open={!!wasteConfirm} onOpenChange={(open) => { if (!open) setWasteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Waste Disposal
            </AlertDialogTitle>
            <AlertDialogDescription>
              Mark <strong>{wasteConfirm?.name}</strong> ({wasteConfirm?.quantity_in_stock} units) for pharmaceutical waste disposal via incineration? This action will zero the stock and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDisposeAsWaste} className="bg-destructive hover:bg-destructive/90 text-white">
              Dispose
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}