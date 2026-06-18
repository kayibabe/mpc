import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BedDouble, Plus, Save, Building, DoorOpen, FileText, Loader2, LayoutDashboard, ArrowRightLeft, AlertCircle } from "lucide-react";
import WardTransferModal from "@/components/WardTransferModal";
import IncidentReportForm from "@/components/IncidentReportForm";
import DepartmentDashboard from "@/components/DepartmentDashboard";
import InpatientDashboard from "@/components/InpatientDashboard";
import WardBedDashboard from "@/components/WardBedDashboard";
import PageHeader from "@/components/ui/PageHeader";

export default function Inpatient() {
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAdmit, setShowAdmit] = useState(false);
  const [admitForm, setAdmitForm] = useState({ patient_id: "", bed_id: "", ward_id: "", admission_type: "elective", diagnosis_on_admission: "" });
  const [showWardForm, setShowWardForm] = useState(false);
  const [wardForm, setWardForm] = useState({ name: "", floor: "", type: "general", total_beds: "0" });
  const [showBedForm, setShowBedForm] = useState(false);
  const [bedForm, setBedForm] = useState({ bed_number: "", ward_id: "", type: "general", rate_per_day: "0" });
  const [dischargeSummary, setDischargeSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [w, b, a, p] = await Promise.all([
          base44.entities.Ward.list("", 50),
          base44.entities.Bed.list("", 200),
          base44.entities.Admission.filter({ status: "admitted" }, "-created_date", 50),
          base44.entities.Patient.list("-created_date", 200),
        ]);
        setWards(w);
        setBeds(b);
        setAdmissions(a);
        setPatients(p);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();

    // Subscribe to real-time bed status updates
    const unsubscribeBeds = base44.entities.Bed.subscribe((event) => {
      if (event.type === "update") {
        setBeds(prev => prev.map(b => b.id === event.id ? event.data : b));
      }
    });

    // Subscribe to real-time admission updates
    const unsubscribeAdmissions = base44.entities.Admission.subscribe((event) => {
      if (event.type === "update" || event.type === "create") {
        // Re-load admissions to keep in sync
        base44.entities.Admission.filter({ status: "admitted" }, "-created_date", 50)
          .then(a => setAdmissions(a))
          .catch(e => console.error("Failed to refresh admissions:", e));
      }
    });

    return () => {
      unsubscribeBeds();
      unsubscribeAdmissions();
    };
  }, []);

  const getPatientName = (pid) => { const p = patients.find(pt => pt.id === pid); return p ? `${p.first_name} ${p.last_name}` : "Unknown"; };
  const getWardName = (wid) => wards.find(w => w.id === wid)?.name || "—";
  const getBedNumber = (bid) => beds.find(b => b.id === bid)?.bed_number || "—";
  const availableBeds = beds.filter(b => b.status === "available");
  const occupiedBeds = beds.filter(b => b.status === "occupied");
  const getWardBeds = (wid) => beds.filter(b => b.ward_id === wid);

  const addWard = async (e) => {
    e.preventDefault();
    await base44.entities.Ward.create({ ...wardForm, total_beds: Number(wardForm.total_beds) });
    const w = await base44.entities.Ward.list("", 50);
    setWards(w);
    setShowWardForm(false);
  };

  const addBed = async (e) => {
    e.preventDefault();
    await base44.entities.Bed.create({ ...bedForm, rate_per_day: Number(bedForm.rate_per_day) });
    const b = await base44.entities.Bed.list("", 200);
    setBeds(b);
    setShowBedForm(false);
  };

  const admitPatient = async (e) => {
    e.preventDefault();
    if (!admitForm.bed_id) return;
    await base44.entities.Admission.create({ ...admitForm, admission_date: new Date().toISOString(), status: "admitted" });
    await base44.entities.Bed.update(admitForm.bed_id, { status: "occupied" });
    const [a, b] = await Promise.all([
      base44.entities.Admission.filter({ status: "admitted" }, "-created_date", 50),
      base44.entities.Bed.list("", 200),
    ]);
    setAdmissions(a);
    setBeds(b);
    setShowAdmit(false);
  };

  const dischargePatient = async (admissionId, bedId) => {
    await base44.entities.Admission.update(admissionId, { status: "discharged" });
    await base44.entities.Discharge.create({ admission_id: admissionId, patient_id: admissions.find(a => a.id === admissionId)?.patient_id, discharge_type: "normal", discharge_date: new Date().toISOString() });
    if (bedId) await base44.entities.Bed.update(bedId, { status: "available" });
    const [a, b] = await Promise.all([
      base44.entities.Admission.filter({ status: "admitted" }, "-created_date", 50),
      base44.entities.Bed.list("", 200),
    ]);
    setAdmissions(a);
    setBeds(b);
  };

  const generateSummary = async (admissionId) => {
    // Validate admission exists
    const admission = admissions.find(a => a.id === admissionId);
    if (!admission) {
      alert("Admission record not found. Please refresh and try again.");
      return;
    }
    setSummaryLoading(true);
    try {
      const { data } = await base44.functions.invoke('generateDischargeSummary', { admission_id: admissionId });
      if (!data || !data.structured_summary) {
        throw new Error("Invalid response from discharge summary generator");
      }
      setDischargeSummary(data);
    } catch (e) {
      alert("Failed to generate summary: " + (e.response?.data?.error || e.message));
      setSummaryLoading(false);
    } finally {
      setSummaryLoading(false);
    }
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const bedStatusColors = { available: "bg-chart-2/10 text-chart-2 border-chart-2/30", occupied: "bg-destructive/10 text-destructive border-destructive/30", reserved: "bg-chart-4/10 text-chart-4 border-chart-4/30", cleaning: "bg-chart-2/10 text-chart-2 border-chart-2/30", maintenance: "bg-triage-semi/10 text-triage-semi border-triage-semi/30" };
  const bedStatusCycle = { available: "reserved", reserved: "cleaning", cleaning: "maintenance", maintenance: "available" };

  const toggleBedStatus = async (bedId, currentStatus) => {
    const next = bedStatusCycle[currentStatus];
    if (!next) return;
    await base44.entities.Bed.update(bedId, { status: next });
    setBeds(beds.map(b => b.id === bedId ? { ...b, status: next } : b));
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Inpatient Management" subtitle="Ward, bed, and admission management" icon={BedDouble}>
        <button onClick={() => { setShowWardForm(true); setActiveTab("beds"); }} className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"><Building className="w-4 h-4" /> Add Ward</button>
        <button onClick={() => { setShowBedForm(true); setActiveTab("beds"); }} className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"><DoorOpen className="w-4 h-4" /> Add Bed</button>
        <button onClick={() => setShowAdmit(!showAdmit)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm"><Plus className="w-4 h-4" /> Admit Patient</button>
      </PageHeader>

      {showAdmit && (
        <div className="bg-white rounded-lg border border-border p-6">
          <h3 className="font-heading text-lg font-semibold mb-4">Admit Patient</h3>
          <form onSubmit={admitPatient} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Patient *</label><select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={admitForm.patient_id} onChange={e => setAdmitForm({...admitForm, patient_id: e.target.value})}><option value="">Select</option>{patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Ward</label><select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={admitForm.ward_id} onChange={e => setAdmitForm({...admitForm, ward_id: e.target.value, bed_id: ""})}><option value="">Select</option>{wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Bed</label><select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={admitForm.bed_id} onChange={e => setAdmitForm({...admitForm, bed_id: e.target.value})}><option value="">Select</option>{beds.filter(b => b.status === "available" && (admitForm.ward_id ? b.ward_id === admitForm.ward_id : true)).map(b => <option key={b.id} value={b.id}>{b.bed_number} ({getWardName(b.ward_id)})</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Admission Type</label><select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={admitForm.admission_type} onChange={e => setAdmitForm({...admitForm, admission_type: e.target.value})}><option value="elective">Elective</option><option value="emergency">Emergency</option><option value="transfer">Transfer</option><option value="maternity">Maternity</option></select></div>
            </div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">Diagnosis on Admission</label><textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} value={admitForm.diagnosis_on_admission} onChange={e => setAdmitForm({...admitForm, diagnosis_on_admission: e.target.value})} /></div>
            <div className="flex gap-3"><button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Save className="w-3 h-3 inline mr-1" /> Admit</button><button type="button" onClick={() => setShowAdmit(false)} className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button></div>
          </form>
        </div>
      )}

      {showWardForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/40" onClick={() => setShowWardForm(false)} /><div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-sm mx-4"><h3 className="font-heading text-lg font-semibold mb-4">Add Ward</h3><form onSubmit={addWard} className="space-y-3"><div><label className="block text-xs text-muted-foreground mb-1">Name *</label><input required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={wardForm.name} onChange={e => setWardForm({...wardForm, name: e.target.value})} /></div><div><label className="block text-xs text-muted-foreground mb-1">Floor</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={wardForm.floor} onChange={e => setWardForm({...wardForm, floor: e.target.value})} /></div><div><label className="block text-xs text-muted-foreground mb-1">Type</label><select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={wardForm.type} onChange={e => setWardForm({...wardForm, type: e.target.value})}><option value="general">General</option><option value="private">Private</option><option value="maternity">Maternity</option><option value="icu">ICU</option><option value="isolation">Isolation</option><option value="paediatric">Paediatric</option></select></div><div className="flex gap-3 pt-2"><button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Save</button><button type="button" onClick={() => setShowWardForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button></div></form></div></div>
      )}

      {showBedForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/40" onClick={() => setShowBedForm(false)} /><div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-sm mx-4"><h3 className="font-heading text-lg font-semibold mb-4">Add Bed</h3><form onSubmit={addBed} className="space-y-3"><div><label className="block text-xs text-muted-foreground mb-1">Bed Number *</label><input required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={bedForm.bed_number} onChange={e => setBedForm({...bedForm, bed_number: e.target.value})} /></div><div><label className="block text-xs text-muted-foreground mb-1">Ward *</label><select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={bedForm.ward_id} onChange={e => setBedForm({...bedForm, ward_id: e.target.value})}><option value="">Select</option>{wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div><div><label className="block text-xs text-muted-foreground mb-1">Type</label><select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={bedForm.type} onChange={e => setBedForm({...bedForm, type: e.target.value})}><option value="general">General</option><option value="private">Private</option><option value="maternity">Maternity</option><option value="icu">ICU</option><option value="isolation">Isolation</option></select></div><div><label className="block text-xs text-muted-foreground mb-1">Rate/Day (MWK)</label><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={bedForm.rate_per_day} onChange={e => setBedForm({...bedForm, rate_per_day: e.target.value})} /></div><div className="flex gap-3 pt-2"><button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Save</button><button type="button" onClick={() => setShowBedForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button></div></form></div></div>
      )}

      <DepartmentDashboard department="inpatient" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Building className="w-5 h-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Wards</p><p className="text-xl font-bold">{wards.length}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-chart-2/10 flex items-center justify-center"><BedDouble className="w-5 h-5 text-chart-2" /></div><div><p className="text-sm text-muted-foreground">Beds Available</p><p className="text-xl font-bold">{availableBeds.length}/{beds.length}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center"><BedDouble className="w-5 h-5 text-destructive" /></div><div><p className="text-sm text-muted-foreground">Admitted Patients</p><p className="text-xl font-bold">{admissions.length}</p></div></div></div>
      </div>

      <div className="bg-white rounded-lg border border-border">
        <div className="border-b border-border flex">
          {["dashboard", "ward-view", "beds", "admissions"].map(t => <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-3 text-sm font-medium capitalize ${activeTab === t ? "border-b-2 border-primary text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>)}
        </div>
        <div className="p-4">
          {activeTab === "dashboard" && <InpatientDashboard />}
          {activeTab === "ward-view" && <WardBedDashboard />}

          {activeTab === "beds" && (
            <div>
              {wards.map(w => {
                const wardBeds = getWardBeds(w.id);
                return (
                  <div key={w.id} className="mb-4">
                    <h4 className="font-heading font-semibold text-sm mb-2">{w.name} <span className="text-muted-foreground font-normal">({w.type} • Floor {w.floor || "—"})</span></h4>
                    <div className="flex flex-wrap gap-2">
                      {wardBeds.map(b => (
                        <button
                          key={b.id}
                          onClick={() => b.status !== "occupied" && toggleBedStatus(b.id, b.status)}
                          disabled={b.status === "occupied"}
                          title={b.status === "occupied" ? "Occupied — discharge first" : `Click to change: ${b.status} → ${bedStatusCycle[b.status]}`}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-sm ${bedStatusColors[b.status] || "bg-muted text-muted-foreground"} ${b.status !== "occupied" ? "cursor-pointer hover:scale-105" : "cursor-not-allowed opacity-70"}`}
                        >
                          {b.bed_number}
                          {b.status !== "occupied" && <span className="ml-1 text-[9px] opacity-60">↻</span>}
                        </button>
                      ))}
                      {wardBeds.length === 0 && <span className="text-xs text-muted-foreground py-1">No beds</span>}
                    </div>
                  </div>
                );
              })}
              {wards.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No wards configured. Add a ward first.</p>}
            </div>
          )}

          {activeTab === "admissions" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium text-muted-foreground">Patient</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Ward</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Bed</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Admitted</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Actions</th></tr></thead>
              <tbody>
                {admissions.map(a => (
                  <tr key={a.id} className="border-b border-border/40">
                    <td className="py-2.5 px-3 font-medium">{getPatientName(a.patient_id)}</td>
                    <td className="py-2.5 px-3">{getWardName(a.ward_id)}</td>
                    <td className="py-2.5 px-3">{getBedNumber(a.bed_id)}</td>
                    <td className="py-2.5 px-3">{new Date(a.admission_date).toLocaleDateString("en-GB")}</td>
                    <td className="py-2.5 px-3 capitalize">{a.admission_type}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => { setSelectedAdmission(a); setShowTransferModal(true); }} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20"><ArrowRightLeft className="w-3 h-3 inline mr-0.5" /> Transfer</button>
                        <button onClick={() => { setSelectedAdmission(a); setShowIncidentForm(true); }} className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium hover:bg-destructive/20"><AlertCircle className="w-3 h-3 inline mr-0.5" /> Report</button>
                        <button onClick={() => dischargePatient(a.id, a.bed_id)} className="px-2 py-1 bg-chart-2/10 text-chart-2 rounded text-xs font-medium hover:bg-chart-2/20">Discharge</button>
                        <button onClick={() => generateSummary(a.id)} className="px-2 py-1 bg-chart-1/10 text-chart-1 rounded text-xs font-medium hover:bg-chart-1/20" disabled={summaryLoading}><FileText className="w-3 h-3 inline mr-0.5" /> Summary</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {admissions.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No current admissions.</td></tr>}
              </tbody></table>
            </div>
          )}
        </div>
      </div>

      {dischargeSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDischargeSummary(null)} />
          <div className="relative bg-white rounded-lg p-6 shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold">Discharge Summary</h3>
              <button onClick={() => setDischargeSummary(null)} className="p-1 rounded-lg hover:bg-muted">✕</button>
            </div>
            {summaryLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-xl">
                  <h4 className="font-heading font-semibold text-sm mb-2">Patient Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> {dischargeSummary.structured_summary?.patient?.name}</div>
                    <div><span className="text-muted-foreground">MRN:</span> {dischargeSummary.structured_summary?.patient?.mrn}</div>
                    <div><span className="text-muted-foreground">Gender:</span> {dischargeSummary.structured_summary?.patient?.gender}</div>
                    <div><span className="text-muted-foreground">Blood Group:</span> {dischargeSummary.structured_summary?.patient?.blood_group}</div>
                  </div>
                </div>
                {dischargeSummary.structured_summary?.clinical_summary?.diagnoses?.length > 0 && (
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <h4 className="font-heading font-semibold text-sm mb-2">Diagnoses</h4>
                    {dischargeSummary.structured_summary.clinical_summary.diagnoses.map((d, i) => (
                      <div key={i} className="text-sm flex justify-between py-1 border-b border-border/40 last:border-0">
                        <span>{d.name}</span>
                        <span className="text-muted-foreground text-xs">{d.icd10} • {d.type} • {d.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                {dischargeSummary.structured_summary?.investigations?.lab_orders?.length > 0 && (
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <h4 className="font-heading font-semibold text-sm mb-2">Investigations ({dischargeSummary.structured_summary.investigations.total_lab_orders} total)</h4>
                    {dischargeSummary.structured_summary.investigations.lab_orders.map((l, i) => (
                      <div key={i} className="text-sm flex justify-between py-1 border-b border-border/40 last:border-0">
                        <span className="truncate max-w-xs">{l.tests}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'completed' || l.status === 'verified' ? 'bg-chart-2/10 text-chart-2' : 'bg-muted text-muted-foreground'}`}>{l.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                {dischargeSummary.narrative_summary && (
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
                    <h4 className="font-heading font-semibold text-sm mb-2 text-primary">Narrative Summary</h4>
                    <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{dischargeSummary.narrative_summary}</div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-right">Generated by {dischargeSummary.generated_by} on {new Date(dischargeSummary.generated_at).toLocaleString("en-GB")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ward Transfer Modal */}
      {showTransferModal && selectedAdmission && (
        <WardTransferModal
          patient={patients.find(p => p.id === selectedAdmission.patient_id)}
          admission={selectedAdmission}
          onComplete={async () => {
            setShowTransferModal(false);
            const updated = await base44.entities.Admission.filter({ status: "admitted" }, "-created_date", 50);
            setAdmissions(updated);
            const b = await base44.entities.Bed.list("", 200);
            setBeds(b);
          }}
          onCancel={() => setShowTransferModal(false)}
        />
      )}

      {/* Incident Report Form */}
      {showIncidentForm && selectedAdmission && (
        <IncidentReportForm
          patientId={selectedAdmission.patient_id}
          visitId={selectedAdmission.visit_id}
          onComplete={async () => {
            setShowIncidentForm(false);
            alert("Incident report submitted for review");
          }}
          onCancel={() => setShowIncidentForm(false)}
        />
      )}
    </div>
  );
}