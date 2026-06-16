import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Scan, Plus, Save, FileImage, Upload } from "lucide-react";

export default function Imaging() {
  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patient_id: "", study_type: "xray", body_part: "", clinical_indication: "", priority: "routine" });
  const [resultForm, setResultForm] = useState(null);
  const [resultData, setResultData] = useState({ findings: "", impression: "" });

  useEffect(() => {
    async function load() {
      try {
        const [o, p] = await Promise.all([
          base44.entities.ImagingOrder.list("-created_date", 100),
          base44.entities.Patient.list("-created_date", 200),
        ]);
        setOrders(o);
        setPatients(p);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getPatientName = (pid) => patients.find(p => p.id === pid) ? `${patients.find(p => p.id === pid).first_name} ${patients.find(p => p.id === pid).last_name}` : "Unknown";

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.ImagingOrder.create({ ...form, order_date: new Date().toISOString(), status: "ordered" });
    const o = await base44.entities.ImagingOrder.list("-created_date", 100);
    setOrders(o);
    setShowForm(false);
  };

  const updateStatus = async (id, status) => {
    await base44.entities.ImagingOrder.update(id, { status });
    setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
  };

  const saveResult = async (orderId) => {
    if (!resultData.findings) return;
    await base44.entities.ImagingResult.create({
      imaging_order_id: orderId, patient_id: orders.find(o => o.id === orderId)?.patient_id,
      ...resultData, status: "reported", reported_date: new Date().toISOString(),
    });
    await base44.entities.ImagingOrder.update(orderId, { status: "completed" });
    setResultForm(null);
    setResultData({ findings: "", impression: "" });
    const o = await base44.entities.ImagingOrder.list("-created_date", 100);
    setOrders(o);
  };

  const statusColors = { ordered: "bg-chart-4/10 text-chart-4", scheduled: "bg-chart-1/10 text-chart-1", in_progress: "bg-chart-1/10 text-chart-1", completed: "bg-chart-2/10 text-chart-2", reported: "bg-chart-3/10 text-chart-3", cancelled: "bg-destructive/10 text-destructive" };
  const studyLabels = { xray: "X-Ray", ultrasound: "Ultrasound", ct_scan: "CT Scan", mri: "MRI", mammography: "Mammography", other: "Other" };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Imaging & Radiology</h2>
          <p className="text-sm text-muted-foreground mt-1">Imaging orders, study tracking, and result reporting</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm">
          <Plus className="w-4 h-4" /> New Imaging Order
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-sm mb-6">
          <h3 className="font-heading text-lg font-semibold mb-4">New Imaging Order</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Patient *</label>
                <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})}>
                  <option value="">Select patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Study Type *</label>
                <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.study_type} onChange={e => setForm({...form, study_type: e.target.value})}>
                  {Object.entries(studyLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Body Part</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.body_part} onChange={e => setForm({...form, body_part: e.target.value})} placeholder="e.g. Chest, Abdomen" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
                <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                  <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Clinical Indication</label>
              <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} value={form.clinical_indication} onChange={e => setForm({...form, clinical_indication: e.target.value})} />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Create Order</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border/60 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Patient</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Study</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Body Part</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Priority</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">{new Date(o.created_date).toLocaleDateString("en-GB")}</td>
                  <td className="py-3 px-4 font-medium">{getPatientName(o.patient_id)}</td>
                  <td className="py-3 px-4">{studyLabels[o.study_type] || o.study_type}</td>
                  <td className="py-3 px-4">{o.body_part || "—"}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.priority === "stat" ? "bg-destructive/10 text-destructive" : o.priority === "urgent" ? "bg-chart-4/10 text-chart-4" : "bg-muted text-muted-foreground"}`}>{o.priority}</span>
                  </td>
                  <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[o.status] || ""}`}>{o.status}</span></td>
                  <td className="py-3 px-4">
                    {o.status === "ordered" && <button onClick={() => updateStatus(o.id, "in_progress")} className="p-1.5 rounded hover:bg-chart-1/10 text-chart-1 text-xs">Start</button>}
                    {o.status === "in_progress" && <button onClick={() => setResultForm(o.id)} className="p-1.5 rounded hover:bg-chart-2/10 text-chart-2 text-xs"><FileImage className="w-4 h-4" /></button>}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No imaging orders.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {resultForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setResultForm(null)} />
          <div className="relative bg-card rounded-xl border border-border/60 p-6 shadow-2xl w-full max-w-lg mx-4">
            <h3 className="font-heading text-lg font-semibold mb-4">Enter Imaging Report</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Findings *</label><textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={4} value={resultData.findings} onChange={e => setResultData({...resultData, findings: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Impression</label><textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={3} value={resultData.impression} onChange={e => setResultData({...resultData, impression: e.target.value})} /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => saveResult(resultForm)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"><Save className="w-4 h-4 inline mr-1" /> Save Report</button>
              <button onClick={() => setResultForm(null)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}