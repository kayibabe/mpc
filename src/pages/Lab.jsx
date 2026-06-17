import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FlaskConical, Plus, Save, AlertTriangle, ClipboardCheck, Square, CheckSquare, Play, ArrowRight, CheckCircle, GitBranch } from "lucide-react";
import PatientJourneyTimeline from "@/components/PatientJourneyTimeline";
import DepartmentDashboard from "@/components/DepartmentDashboard";
import ExpiryAlerts from "@/components/ExpiryAlerts";

export default function Lab() {
  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patient_id: "", visit_id: "", tests: "", specimen_type: "", priority: "routine", clinical_notes: "" });
  const [resultForm, setResultForm] = useState(null);
  const [results, setResults] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [labJourneys, setLabJourneys] = useState([]);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [o, p, jList] = await Promise.all([
          base44.entities.LabOrder.list("-created_date", 100),
          base44.entities.Patient.list("-created_date", 200),
          base44.entities.PatientJourney.filter({ current_stage: { $in: ["LAB_PENDING", "LAB_PROCESSING"] }, status: "active" }, "-created_date", 30),
        ]);
        setOrders(o);
        setPatients(p);
        setLabJourneys(jList);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getPatientName = (pid) => {
    const p = patients.find(pt => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.LabOrder.create({ ...form, order_date: new Date().toISOString(), status: "ordered" });
    const o = await base44.entities.LabOrder.list("-created_date", 100);
    setOrders(o);
    setShowForm(false);
  };

  const updateStatus = async (id, status) => {
    await base44.entities.LabOrder.update(id, { status });
    setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
  };

  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const bulkUpdateStatus = async (status) => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    for (const id of selectedIds) await base44.entities.LabOrder.update(id, { status });
    setOrders(orders.map(o => selectedIds.includes(o.id) ? { ...o, status } : o));
    setSelectedIds([]);
    setBulkBusy(false);
  };

  const saveResult = async (orderId) => {
    const r = results[orderId];
    if (!r?.test_name || !r?.result_value) return;

    // Critical result flagging
    let isCritical = false;
    try {
      const refRange = r.reference_range || "";
      const val = parseFloat(r.result_value);
      if (!isNaN(val) && refRange) {
        const rangeMatch = refRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
        if (rangeMatch) {
          const low = parseFloat(rangeMatch[1]);
          const high = parseFloat(rangeMatch[2]);
          if (val < low * 0.5 || val > high * 1.5) isCritical = true;
        }
      }
    } catch (_) {}

    await base44.entities.LabResult.create({
      lab_order_id: orderId, patient_id: orders.find(o => o.id === orderId)?.patient_id,
      ...r, status: isCritical ? "critical" : "final",
    });
    await base44.entities.LabOrder.update(orderId, { status: isCritical ? "critical" : "completed" });

    // Notify on critical result
    if (isCritical) {
      try {
        await base44.functions.invoke("notifyLabResultReady", {
          lab_order_id: orderId,
          patient_id: orders.find(o => o.id === orderId)?.patient_id,
          critical: true,
        });
      } catch (_) {}
    }

    setResultForm(null);
    setResults({});
    const o = await base44.entities.LabOrder.list("-created_date", 100);
    setOrders(o);
  };

  const transitionWorkflow = async (journeyId, nextStage, notes = "") => {
    setTransitioning(true);
    try {
      await base44.functions.invoke('handleWorkflowStageChange', { journey_id: journeyId, next_stage: nextStage, notes });
      const jList = await base44.entities.PatientJourney.filter({ current_stage: { $in: ["LAB_PENDING", "LAB_PROCESSING"] }, status: "active" }, "-created_date", 30);
      setLabJourneys(jList);
    } catch (e) {
      alert("Workflow transition failed: " + (e.response?.data?.error || e.message));
    } finally {
      setTransitioning(false);
    }
  };

  const statusColors = {
    ordered: "bg-chart-4/10 text-chart-4",
    collected: "bg-chart-1/10 text-chart-1",
    in_progress: "bg-chart-1/10 text-chart-1",
    completed: "bg-chart-2/10 text-chart-2",
    verified: "bg-chart-3/10 text-chart-3",
    critical: "bg-destructive/10 text-destructive font-bold",
    cancelled: "bg-destructive/10 text-destructive",
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Laboratory</h2>
          <p className="text-sm text-muted-foreground mt-1">Lab orders, specimen tracking, and results entry</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm">
          <Plus className="w-4 h-4" /> New Lab Order
        </button>
      </div>

      <DepartmentDashboard department="lab" />
      <ExpiryAlerts department="laboratory" />

      {/* Lab Workflow Queue */}
      {labJourneys.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 shadow-sm mb-6 p-4">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2"><GitBranch className="w-4 h-4 text-primary" /> Lab Queue ({labJourneys.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {labJourneys.map(j => (
              <div key={j.id} className="p-3 border border-border rounded-lg bg-muted/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{getPatientName(j.patient_id)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    j.current_stage === "LAB_PROCESSING" ? "bg-chart-1/10 text-chart-1" : "bg-chart-4/10 text-chart-4"
                  }`}>{j.current_stage?.replace(/_/g, " ")}</span>
                </div>
                <div className="mb-2"><PatientJourneyTimeline journeyId={j.id} compact /></div>
                <div className="flex gap-1 flex-wrap">
                  {j.current_stage === "LAB_PENDING" && (
                    <button onClick={() => transitionWorkflow(j.id, "LAB_PROCESSING", "Started processing")} disabled={transitioning} className="px-2 py-1 bg-chart-1/10 text-chart-1 rounded text-xs font-medium hover:bg-chart-1/20">
                      <Play className="w-3 h-3 inline mr-0.5" /> Start
                    </button>
                  )}
                  <button onClick={() => transitionWorkflow(j.id, "CONSULTATION", "Lab results ready")} disabled={transitioning} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20">
                    <ArrowRight className="w-3 h-3 inline mr-0.5" /> Return to Doctor
                  </button>
                  <button onClick={() => transitionWorkflow(j.id, "COMPLETED", "Lab complete")} disabled={transitioning} className="px-2 py-1 bg-chart-3/10 text-chart-3 rounded text-xs font-medium hover:bg-chart-3/20">
                    <CheckCircle className="w-3 h-3 inline mr-0.5" /> Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-sm mb-6">
          <h3 className="font-heading text-lg font-semibold mb-4">New Lab Order</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Patient *</label>
                <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})}>
                  <option value="">Select patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.mrn})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tests *</label>
                <input required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. FBC, Malaria RDT, HIV, Urea" value={form.tests} onChange={e => setForm({...form, tests: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
                <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                  <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Specimen Type</label>
                <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.specimen_type} onChange={e => setForm({...form, specimen_type: e.target.value})}>
                  <option value="">Select</option>
                  <option value="blood">Blood</option><option value="urine">Urine</option><option value="stool">Stool</option><option value="sputum">Sputum</option><option value="swab">Swab</option><option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Clinical Notes</label>
              <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} value={form.clinical_notes} onChange={e => setForm({...form, clinical_notes: e.target.value})} />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Create Order</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl mx-6 mt-4 p-3 flex items-center gap-3">
          <span className="text-sm font-medium text-primary">{selectedIds.length} selected</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => bulkUpdateStatus("in_progress")} disabled={bulkBusy} className="px-3 py-1.5 bg-chart-1 text-white rounded text-xs font-medium hover:bg-chart-1/90 disabled:opacity-50 flex items-center gap-1"><Play className="w-3 h-3" /> Bulk Start</button>
            <button onClick={() => bulkUpdateStatus("verified")} disabled={bulkBusy} className="px-3 py-1.5 bg-chart-3 text-white rounded text-xs font-medium hover:bg-chart-3/90 disabled:opacity-50 flex items-center gap-1"><ClipboardCheck className="w-3 h-3" /> Bulk Verify</button>
            <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 border border-border rounded text-xs font-medium hover:bg-muted">Clear</button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border/60 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground w-10">
                  <button onClick={() => { const pending = orders.filter(o => o.status === "ordered"); setSelectedIds(selectedIds.length === pending.length ? [] : pending.map(o => o.id)); }} className="p-0.5 rounded hover:bg-muted">
                    {selectedIds.length > 0 && selectedIds.length === orders.filter(o => o.status === "ordered").length ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Patient</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tests</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Priority</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    {o.status === "ordered" && (
                      <button onClick={() => toggleSelect(o.id)} className="p-0.5 rounded hover:bg-muted">
                        {selectedIds.includes(o.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4">{new Date(o.created_date).toLocaleDateString("en-GB")}</td>
                  <td className="py-3 px-4 font-medium">{getPatientName(o.patient_id)}</td>
                  <td className="py-3 px-4">{o.tests}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.priority === "stat" ? "bg-destructive/10 text-destructive" : o.priority === "urgent" ? "bg-chart-4/10 text-chart-4" : "bg-muted text-muted-foreground"}`}>{o.priority}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[o.status] || ""}`}>{o.status}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      {o.status === "ordered" && (
                        <button onClick={async () => {
                          const barcode = `SPC-${Date.now().toString(36).toUpperCase()}`;
                          await base44.entities.LabOrder.update(o.id, { status: "collected", collected_at: new Date().toISOString(), specimen_barcode: barcode });
                          const oList = await base44.entities.LabOrder.list("-created_date", 100);
                          setOrders(oList);
                        }} className="p-1.5 rounded hover:bg-chart-4/10 text-chart-4 text-xs" title="Collect specimen & assign barcode">Collect</button>
                      )}
                      {o.status === "collected" && <button onClick={() => updateStatus(o.id, "in_progress")} className="p-1.5 rounded hover:bg-chart-1/10 text-chart-1 text-xs">Start</button>}
                      {o.status === "in_progress" && <button onClick={() => { setResultForm(o.id); setResults({...results, [o.id]: { test_name: "", result_value: "", unit: "", reference_range: "" }}); }} className="p-1.5 rounded hover:bg-chart-2/10 text-chart-2 text-xs"><ClipboardCheck className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No lab orders.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {resultForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setResultForm(null)} />
          <div className="relative bg-card rounded-xl border border-border/60 p-6 shadow-2xl w-full max-w-md mx-4">
            <h3 className="font-heading text-lg font-semibold mb-4">Enter Lab Result</h3>
            <div className="space-y-3">
              {["test_name", "result_value", "unit", "reference_range"].map(f => (
                <div key={f}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 capitalize">{f.replace(/_/g, " ")}</label>
                  <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={results[resultForm]?.[f] || ""} onChange={e => setResults({...results, [resultForm]: {...results[resultForm], [f]: e.target.value}})} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => saveResult(resultForm)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"><Save className="w-4 h-4 inline mr-1" /> Save Result</button>
              <button onClick={() => setResultForm(null)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}