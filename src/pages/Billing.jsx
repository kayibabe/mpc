import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Receipt, Plus, Save, CreditCard, DollarSign, FileText, Search, Download, ArrowRight, CheckCircle, GitBranch, ClipboardList, Shield, UserCircle, ChevronDown, ChevronUp, Users, Trash2 } from "lucide-react";
import ShiftManagement from "@/components/ShiftManagement";
import RevenueReport from "@/components/RevenueReport";
import ReconciliationPanel from "@/components/ReconciliationPanel";
import LiveAuditMonitor from "@/components/LiveAuditMonitor";

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [claims, setClaims] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [invoiceSplits, setInvoiceSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("invoices");
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showPayment, setShowPayment] = useState(null);
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({ patient_id: "", payment_type: "cash" });
  const [items, setItems] = useState([{ service_type: "consultation", service_name: "", quantity: "1", unit_price: "", department: "" }]);
  const [paymentForm, setPaymentForm] = useState({ amount: "", payment_method: "cash", reference: "", split_id: "" });
  const [billingJourneys, setBillingJourneys] = useState([]);
  const [transitioning, setTransitioning] = useState(false);

  // Split billing state
  const [splitBilling, setSplitBilling] = useState(false);
  const [splits, setSplits] = useState([
    { payer_type: "patient", scheme_name: "", percentage: "50" },
    { payer_type: "insurance", scheme_name: "", percentage: "50" },
  ]);

  useEffect(() => {
    async function load() {
      try {
        const [inv, p, pay, c, s, split, jList] = await Promise.all([
          base44.entities.Invoice.list("-created_date", 100),
          base44.entities.Patient.list("-created_date", 200),
          base44.entities.Payment.list("-created_date", 100),
          base44.entities.InsuranceClaim.list("-created_date", 50),
          base44.entities.MedicalAidScheme.list("", 50),
          base44.entities.InvoiceSplit.list("-created_date", 200),
          base44.entities.PatientJourney.filter({ current_stage: "BILLING", status: "active" }, "-created_date", 30),
        ]);
        setInvoices(inv);
        setPatients(p);
        setPayments(pay);
        setClaims(c);
        setSchemes(s);
        setInvoiceSplits(split);
        setBillingJourneys(jList);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getPatientName = (pid) => { const p = patients.find(pt => pt.id === pid); return p ? `${p.first_name} ${p.last_name}` : "Unknown"; };
  const getInvoicePayments = (invId) => payments.filter(p => p.invoice_id === invId).reduce((sum, p) => sum + p.amount, 0);
  const getInvoiceSplits = (invId) => invoiceSplits.filter(s => s.invoice_id === invId);

  const computeInvoiceTotal = () => {
    return items.filter(i => i.service_name && i.unit_price).reduce((sum, i) => sum + Number(i.unit_price) * Number(i.quantity), 0);
  };

  const splitsValid = () => {
    if (!splitBilling) return true;
    const total = splits.reduce((s, sp) => s + (Number(sp.percentage) || 0), 0);
    return Math.abs(total - 100) < 0.1;
  };

  const createInvoice = async (e) => {
    e.preventDefault();
    const validItems = items.filter(i => i.service_name && i.unit_price);
    if (validItems.length === 0) return;
    if (splitBilling && !splitsValid()) {
      alert("Split billing percentages must add up to 100%.");
      return;
    }

    let total = 0;
    validItems.forEach(i => { total += Number(i.unit_price) * Number(i.quantity); });
    const invNum = `INV-${Date.now().toString(36).toUpperCase()}`;

    const inv = await base44.entities.Invoice.create({
      patient_id: invoiceForm.patient_id,
      payment_type: splitBilling ? "both" : invoiceForm.payment_type,
      invoice_number: invNum, total_amount: total, net_amount: total,
      status: "pending", created_date: new Date().toISOString(),
    });

    for (const item of validItems) {
      await base44.entities.InvoiceItem.create({
        invoice_id: inv.id, ...item, quantity: Number(item.quantity),
        unit_price: Number(item.unit_price), total: Number(item.unit_price) * Number(item.quantity),
      });
    }

    // Create split allocations
    if (splitBilling) {
      for (const split of splits) {
        const pct = Number(split.percentage);
        if (pct <= 0) continue;
        const splitAmount = Math.round(total * pct) / 100;
        await base44.entities.InvoiceSplit.create({
          invoice_id: inv.id,
          patient_id: invoiceForm.patient_id,
          payer_type: split.payer_type,
          scheme_name: split.payer_type === "insurance" ? split.scheme_name : "",
          percentage: pct,
          total_amount: splitAmount,
          paid_amount: 0,
          status: "pending",
        });
      }
    } else {
      // Single payer — create one split for tracking
      await base44.entities.InvoiceSplit.create({
        invoice_id: inv.id,
        patient_id: invoiceForm.patient_id,
        payer_type: invoiceForm.payment_type === "scheme" ? "insurance" : "patient",
        scheme_name: invoiceForm.payment_type === "scheme" ? (invoiceForm.scheme_name || "") : "",
        percentage: 100,
        total_amount: total,
        paid_amount: 0,
        status: "pending",
      });
    }

    const [invList, splitList] = await Promise.all([
      base44.entities.Invoice.list("-created_date", 100),
      base44.entities.InvoiceSplit.list("-created_date", 200),
    ]);
    setInvoices(invList);
    setInvoiceSplits(splitList);
    setShowCreateInvoice(false);
    setSplitBilling(false);
    setSplits([{ payer_type: "patient", scheme_name: "", percentage: "50" }, { payer_type: "insurance", scheme_name: "", percentage: "50" }]);
    setItems([{ service_type: "consultation", service_name: "", quantity: "1", unit_price: "", department: "" }]);
  };

  const processPayment = async (invoiceId) => {
    if (!paymentForm.amount) return;
    const amt = Number(paymentForm.amount);

    await base44.entities.Payment.create({
      invoice_id: invoiceId,
      patient_id: invoices.find(i => i.id === invoiceId)?.patient_id,
      amount: amt,
      payment_method: paymentForm.payment_method,
      reference: paymentForm.reference,
      payment_date: new Date().toISOString(),
    });

    // Update the matching split
    const splitId = paymentForm.split_id;
    if (splitId) {
      const split = invoiceSplits.find(s => s.id === splitId);
      if (split) {
        const newPaid = (split.paid_amount || 0) + amt;
        const newStatus = newPaid >= split.total_amount ? "paid" : "partial";
        await base44.entities.InvoiceSplit.update(splitId, {
          paid_amount: newPaid,
          status: newStatus,
        });
      }
    }

    // Recalculate overall invoice status
    const inv = invoices.find(i => i.id === invoiceId);
    const allSplits = getInvoiceSplits(invoiceId);
    const totalPaid = allSplits.reduce((s, sp) => s + (sp.paid_amount || 0), 0) + (splitId ? 0 : amt);
    const total = inv.net_amount || inv.total_amount;
    let newStatus = "pending";
    if (totalPaid >= total) newStatus = "paid";
    else if (totalPaid > 0) newStatus = "partial";

    await base44.entities.Invoice.update(invoiceId, { status: newStatus, paid_amount: totalPaid });

    const [invList, payList, splitList] = await Promise.all([
      base44.entities.Invoice.list("-created_date", 100),
      base44.entities.Payment.list("-created_date", 100),
      base44.entities.InvoiceSplit.list("-created_date", 200),
    ]);
    setInvoices(invList);
    setPayments(payList);
    setInvoiceSplits(splitList);
    setShowPayment(null);
    setPaymentForm({ amount: "", payment_method: "cash", reference: "", split_id: "" });

    if (totalPaid >= total) {
      try {
        const journeys = await base44.entities.PatientJourney.filter({ visit_id: inv.visit_id, status: "active" }, "-created_date", 1);
        if (journeys.length > 0) {
          await base44.functions.invoke('handleWorkflowStageChange', {
            journey_id: journeys[0].id,
            next_stage: "COMPLETED",
            notes: "Full payment received — visit finalized",
          });
        }
      } catch (_) { /* silent */ }
    }
  };

  const transitionWorkflow = async (journeyId, nextStage, notes = "") => {
    setTransitioning(true);
    try {
      await base44.functions.invoke('handleWorkflowStageChange', { journey_id: journeyId, next_stage: nextStage, notes });
      const jList = await base44.entities.PatientJourney.filter({ current_stage: "BILLING", status: "active" }, "-created_date", 30);
      setBillingJourneys(jList);
    } catch (e) {
      alert("Workflow transition failed: " + (e.response?.data?.error || e.message));
    } finally { setTransitioning(false); }
  };

  const submitClaim = async (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    const splits = getInvoiceSplits(invoiceId);
    const insuranceSplit = splits.find(s => s.payer_type === "insurance");
    const claimAmount = insuranceSplit ? insuranceSplit.total_amount : inv.total_amount;
    await base44.entities.InsuranceClaim.create({
      invoice_id: invoiceId, patient_id: inv.patient_id,
      scheme_name: inv.scheme_name || insuranceSplit?.scheme_name || "Unknown",
      claim_amount: claimAmount,
      status: "submitted", submitted_date: new Date().toISOString(),
    });
    const c = await base44.entities.InsuranceClaim.list("-created_date", 50);
    setClaims(c);
  };

  const exportInvoicePdf = async (invoiceId) => {
    try {
      const { data } = await base44.functions.invoke('exportInvoicePdf', { invoice_id: invoiceId });
      const byteChars = atob(data.pdf_base64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  const statusColors = { draft: "bg-muted text-muted-foreground", pending: "bg-chart-4/10 text-chart-4", partial: "bg-chart-1/10 text-chart-1", paid: "bg-chart-2/10 text-chart-2", cancelled: "bg-destructive/10 text-destructive" };
  const splitStatusColors = { pending: "bg-muted/60 text-muted-foreground", partial: "bg-chart-2/10 text-chart-2", paid: "bg-chart-3/10 text-chart-3" };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="section-title">Billing</h2><p className="text-sm text-muted-foreground mt-1">Invoices, payments, split billing & claims</p></div>
        <button onClick={() => setShowCreateInvoice(!showCreateInvoice)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm"><Plus className="w-4 h-4" /> New Invoice</button>
      </div>

      {/* Live Audit Monitor */}
      <div className="mb-6">
        <LiveAuditMonitor />
      </div>

      {/* Billing Workflow Queue */}
      {billingJourneys.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 shadow-sm mb-6 p-4">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2"><GitBranch className="w-4 h-4 text-primary" /> Billing Queue ({billingJourneys.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {billingJourneys.map(j => (
              <div key={j.id} className="p-3 border border-border rounded-lg bg-muted/10 flex items-center justify-between">
                <div><span className="text-sm font-medium">{getPatientName(j.patient_id)}</span><p className="text-xs text-muted-foreground">Stage: {j.current_stage?.replace(/_/g, " ")}</p></div>
                <button onClick={() => transitionWorkflow(j.id, "COMPLETED", "Billing cleared")} disabled={transitioning} className="px-3 py-1.5 bg-chart-3/10 text-chart-3 rounded text-xs font-medium hover:bg-chart-3/20"><CheckCircle className="w-3 h-3 inline mr-0.5" /> Complete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateInvoice && (
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-sm mb-6">
          <h3 className="font-heading text-lg font-semibold mb-4">Create Invoice</h3>
          <form onSubmit={createInvoice} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Patient *</label><select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={invoiceForm.patient_id} onChange={e => setInvoiceForm({...invoiceForm, patient_id: e.target.value})}><option value="">Select</option>{patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Payment Type</label><select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={invoiceForm.payment_type} onChange={e => setInvoiceForm({...invoiceForm, payment_type: e.target.value})} disabled={splitBilling}><option value="cash">Cash</option><option value="scheme">Scheme</option><option value="both">Both</option></select></div>
            </div>

            {/* Split Billing Toggle */}
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={splitBilling} onChange={e => setSplitBilling(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
                <span className="text-sm font-medium flex items-center gap-1.5"><Users className="w-4 h-4 text-primary" /> Split Billing</span>
              </label>
              <span className="text-xs text-muted-foreground">Split the invoice across multiple payers (patient + insurers)</span>
            </div>

            {splitBilling && (
              <div className="p-4 bg-muted/10 rounded-xl border border-border space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-chart-4" /> Payer Allocations</h4>
                {splits.map((split, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white/50 rounded-lg p-3">
                    <div className="col-span-3">
                      <label className="block text-[10px] text-muted-foreground mb-0.5">Payer</label>
                      <select className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" value={split.payer_type} onChange={e => { const s = [...splits]; s[idx].payer_type = e.target.value; s[idx].scheme_name = ""; setSplits(s); }}>
                        <option value="patient">Patient</option>
                        <option value="insurance">Insurance</option>
                      </select>
                    </div>
                    <div className={`${split.payer_type === "insurance" ? "col-span-4" : "col-span-5"}`}>
                      {split.payer_type === "insurance" ? (
                        <>
                          <label className="block text-[10px] text-muted-foreground mb-0.5">Scheme</label>
                          <select className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" value={split.scheme_name} onChange={e => { const s = [...splits]; s[idx].scheme_name = e.target.value; setSplits(s); }}>
                            <option value="">Select scheme</option>
                            {schemes.map(sc => <option key={sc.id} value={sc.name}>{sc.name}</option>)}
                          </select>
                        </>
                      ) : (
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-0.5">&nbsp;</label>
                          <span className="block px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1"><UserCircle className="w-3 h-3" /> Self-pay</span>
                        </div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-muted-foreground mb-0.5">% Share</label>
                      <input type="number" min="0" max="100" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" value={split.percentage} onChange={e => { const s = [...splits]; s[idx].percentage = e.target.value; setSplits(s); }} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-muted-foreground mb-0.5">Amount</label>
                      <span className="block px-2 py-1.5 text-xs font-mono font-semibold">
                        MWK {Math.round(computeInvoiceTotal() * (Number(split.percentage) || 0)) / 100}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {splits.length > 1 && (
                        <button type="button" onClick={() => setSplits(splits.filter((_, i) => i !== idx))} className="p-1.5 text-muted-foreground hover:text-destructive rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setSplits([...splits, { payer_type: "insurance", scheme_name: "", percentage: "0" }])} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Payer
                </button>
                {!splitsValid() && <p className="text-xs text-destructive">⚠ Percentages must add up to 100% (currently: {splits.reduce((s, sp) => s + (Number(sp.percentage) || 0), 0)}%)</p>}
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2">Line Items</h4>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
                  <div><label className="block text-xs text-muted-foreground mb-0.5">Service</label><select className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" value={item.service_type} onChange={e => { const it = [...items]; it[idx].service_type = e.target.value; setItems(it); }}><option value="consultation">Consultation</option><option value="lab">Lab</option><option value="imaging">Imaging</option><option value="pharmacy">Pharmacy</option><option value="procedure">Procedure</option><option value="bed">Bed</option><option value="maternal">Maternal</option><option value="other">Other</option></select></div>
                  <div><label className="block text-xs text-muted-foreground mb-0.5">Name</label><input className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" value={item.service_name} onChange={e => { const it = [...items]; it[idx].service_name = e.target.value; setItems(it); }} /></div>
                  <div><label className="block text-xs text-muted-foreground mb-0.5">Qty</label><input type="number" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" value={item.quantity} onChange={e => { const it = [...items]; it[idx].quantity = e.target.value; setItems(it); }} /></div>
                  <div><label className="block text-xs text-muted-foreground mb-0.5">Price (MWK)</label><input type="number" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" value={item.unit_price} onChange={e => { const it = [...items]; it[idx].unit_price = e.target.value; setItems(it); }} /></div>
                </div>
              ))}
              <button type="button" onClick={() => setItems([...items, { service_type: "consultation", service_name: "", quantity: "1", unit_price: "", department: "" }])} className="text-xs text-primary hover:underline">+ Add Item</button>
            </div>

            <div className="flex items-center justify-between">
              {computeInvoiceTotal() > 0 && <span className="text-sm font-semibold">Total: MWK {computeInvoiceTotal().toLocaleString()}</span>}
              <div className="flex gap-3">
                <button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Save className="w-3 h-3 inline mr-1" /> Create Invoice</button>
                <button type="button" onClick={() => { setShowCreateInvoice(false); setSplitBilling(false); }} className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border/60 shadow-sm">
        <div className="border-b border-border flex">
          {["invoices", "payments", "claims", "reconciliation", "reports", "shifts"].map(t => <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-3 text-sm font-medium capitalize ${activeTab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>)}
        </div>
        <div className="p-4">

          {/* INVOICES TAB — with split billing detail */}
          {activeTab === "invoices" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Invoice</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Patient</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Total (MWK)</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Paid</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {invoices.map(inv => {
                    const paid = getInvoicePayments(inv.id);
                    const splits = getInvoiceSplits(inv.id);
                    const hasSplits = splits.length > 0;
                    const isExpanded = expandedInvoice === inv.id;
                    const allSplitPaid = hasSplits && splits.every(s => s.status === "paid");

                    return (
                      <tr key={inv.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-mono text-xs cursor-pointer" onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}>
                          <div className="flex items-center gap-1">
                            {hasSplits && splits.some(s => s.payer_type === "insurance") && <Shield className="w-3 h-3 text-chart-4" />}
                            {inv.invoice_number}
                            {hasSplits && (isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">{getPatientName(inv.patient_id)}</td>
                        <td className="py-2.5 px-3 font-mono">{inv.total_amount?.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono">{paid.toLocaleString()}</td>
                        <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || ""}`}>{inv.status}</span></td>
                        <td className="py-2.5 px-3">
                          <div className="flex gap-1 flex-wrap">
                            {inv.status !== "paid" && inv.status !== "cancelled" && (
                              <button onClick={() => {
                                setShowPayment(inv.id);
                                // Pre-select first unpaid split
                                const firstUnpaid = splits.find(s => s.status !== "paid");
                                setPaymentForm({ amount: "", payment_method: "cash", reference: "", split_id: firstUnpaid?.id || "" });
                              }} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                                <CreditCard className="w-3 h-3 inline mr-0.5" /> Pay
                              </button>
                            )}
                            {(inv.payment_type === "scheme" || inv.payment_type === "both" || splits.some(s => s.payer_type === "insurance")) && (
                              <button onClick={() => submitClaim(inv.id)} className="px-2 py-1 bg-chart-4/10 text-chart-4 rounded text-xs font-medium"><FileText className="w-3 h-3 inline mr-0.5" /> Claim</button>
                            )}
                            <button onClick={() => exportInvoicePdf(inv.id)} className="px-2 py-1 bg-chart-1/10 text-chart-1 rounded text-xs font-medium"><Download className="w-3 h-3 inline mr-0.5" /> PDF</button>
                          </div>
                        </td>
                        {/* Split Breakdown Row */}
                        {isExpanded && hasSplits && (
                          <tr key={`${inv.id}-splits`} className="border-b border-border/40 bg-muted/10">
                            <td colSpan={6} className="p-0">
                              <div className="p-3 space-y-1.5">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Billing Splits</p>
                                {splits.map(split => {
                                  const splitPaid = split.paid_amount || 0;
                                  const splitPct = Math.round((splitPaid / (split.total_amount || 1)) * 100);
                                  return (
                                    <div key={split.id} className="flex items-center gap-3 bg-white/60 rounded-lg p-2.5">
                                      <div className="flex items-center gap-1.5 min-w-[80px]">
                                        {split.payer_type === "patient" ? <UserCircle className="w-3.5 h-3.5 text-primary" /> : <Shield className="w-3.5 h-3.5 text-chart-4" />}
                                        <span className="text-xs font-medium">{split.payer_type === "patient" ? "Patient" : split.scheme_name || "Insurance"}</span>
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                                          <span>{splitPaid.toLocaleString()} / {split.total_amount?.toLocaleString()} MWK ({split.percentage}%)</span>
                                          <span className={splitStatusColors[split.status]}>{split.status}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full transition-all ${
                                            split.status === "paid" ? "bg-chart-3" : splitPaid > 0 ? "bg-chart-2" : "bg-muted-foreground/20"
                                          }`} style={{ width: `${Math.min(100, splitPct)}%` }} />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tr>
                    );
                  })}
                  {invoices.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No invoices.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Amount (MWK)</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Method</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Reference</th></tr></thead><tbody>
              {payments.map(p => (<tr key={p.id} className="border-b border-border/40"><td className="py-2.5 px-3">{new Date(p.payment_date).toLocaleDateString("en-GB")}</td><td className="py-2.5 px-3 font-medium">{p.amount?.toLocaleString()}</td><td className="py-2.5 px-3 capitalize">{p.payment_method?.replace(/_/g, " ")}</td><td className="py-2.5 px-3">{p.reference || "—"}</td></tr>))}
              {payments.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">No payments.</td></tr>}
            </tbody></table></div>
          )}

          {activeTab === "reconciliation" && <ReconciliationPanel />}
          {activeTab === "reports" && <RevenueReport />}
          {activeTab === "shifts" && <ShiftManagement />}

          {activeTab === "claims" && (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium text-muted-foreground">Scheme</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Amount (MWK)</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Submitted</th></tr></thead><tbody>
              {claims.map(c => (<tr key={c.id} className="border-b border-border/40"><td className="py-2.5 px-3">{c.scheme_name}</td><td className="py-2.5 px-3 font-medium">{c.claim_amount?.toLocaleString()}</td><td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === "approved" ? "bg-chart-2/10 text-chart-2" : c.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-chart-4/10 text-chart-4"}`}>{c.status}</span></td><td className="py-2.5 px-3">{c.submitted_date ? new Date(c.submitted_date).toLocaleDateString("en-GB") : "—"}</td></tr>))}
              {claims.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">No claims.</td></tr>}
            </tbody></table></div>
          )}
        </div>
      </div>

      {/* Payment Modal — with split selector */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPayment(null)} />
          <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-sm mx-4">
            <h3 className="font-heading text-lg font-semibold mb-4">Process Payment</h3>
            <div className="space-y-3">
              {(() => {
                const splits = getInvoiceSplits(showPayment);
                return splits.length > 0 && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Apply To</label>
                    <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={paymentForm.split_id} onChange={e => setPaymentForm({...paymentForm, split_id: e.target.value})}>
                      <option value="">Invoice (general)</option>
                      {splits.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.payer_type === "patient" ? "Patient" : s.scheme_name || "Insurance"} — {s.total_amount?.toLocaleString()} MWK ({s.percentage}%) — {s.status}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}
              <div><label className="block text-xs text-muted-foreground mb-1">Amount (MWK) *</label><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">Method</label><select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={paymentForm.payment_method} onChange={e => setPaymentForm({...paymentForm, payment_method: e.target.value})}><option value="cash">Cash</option><option value="card">Card</option><option value="airtel_money">Airtel Money</option><option value="tnm_mpamba">TNM Mpamba</option><option value="bank_transfer">Bank Transfer</option></select></div>
              <div><label className="block text-xs text-muted-foreground mb-1">Reference</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})} /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => processPayment(showPayment)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><DollarSign className="w-3 h-3 inline mr-1" /> Process</button>
              <button onClick={() => setShowPayment(null)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}