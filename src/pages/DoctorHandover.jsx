import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowRightLeft, Plus, Check, Clock, User, Stethoscope, AlertTriangle, Users, Search, X, Save, Loader2, ClipboardList, ShieldCheck, ClipboardPen, FileDown, RefreshCw, Bookmark, Copy } from "lucide-react";
import StaffComplianceDashboard from "@/components/StaffComplianceDashboard";

const SHIFT_TYPES = [
  { value: "morning", label: "Morning (06:00–14:00)", color: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  { value: "afternoon", label: "Afternoon (14:00–22:00)", color: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
  { value: "night", label: "Night (22:00–06:00)", color: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  { value: "weekend", label: "Weekend Cover", color: "bg-chart-1/10 text-chart-1 border-chart-1/20" },
  { value: "on_call", label: "On Call", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

export default function DoctorHandover() {
  const [tab, setTab] = useState("handover");
  const [handovers, setHandovers] = useState([]);
  const [users, setUsers] = useState([]);
  const [patients, setPatients] = useState([]);
  const [activePatients, setActivePatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({
    to_doctor_id: "",
    shift_type: "morning",
    critical_cases: "",
    pending_investigations: "",
    pending_consults: "",
    treatment_updates: "",
    discharge_planning: "",
    new_admissions: "",
    incidents: "",
    general_notes: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [h, u, p, admissions, templateList] = await Promise.all([
          base44.entities.DoctorHandover.list("-created_date", 50),
          base44.entities.User.list("", 50),
          base44.entities.Patient.list("-created_date", 200),
          base44.entities.Admission.filter({ status: "admitted" }, "-created_date", 100),
          base44.entities.HandoverTemplate.filter({ is_active: true }, "name", 20),
        ]);
        setHandovers(h);
        setUsers(u);
        setPatients(p);
        setActivePatients(admissions);
        setTemplates(templateList || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getUserName = (id) => {
    const u = users.find(u => u.id === id);
    return u ? (u.full_name || u.email) : id?.slice(0, 8) || "Unknown";
  };

  const getPatientName = (id) => {
    const p = patients.find(p => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : id?.slice(0, 8) || "Unknown";
  };

  const acknowledgeHandover = async (id) => {
    await base44.entities.DoctorHandover.update(id, {
      acknowledged: true,
      acknowledged_date: new Date().toISOString(),
      status: "acknowledged",
    });
    setHandovers(handovers.map(h => h.id === id ? { ...h, acknowledged: true, status: "acknowledged" } : h));
  };

  const submitHandover = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const activePatientsJson = JSON.stringify(selectedPatients.map(pid => {
        const p = patients.find(pt => pt.id === pid);
        const adm = activePatients.find(a => a.patient_id === pid);
        return {
          patient_id: pid,
          name: p ? `${p.first_name} ${p.last_name}` : pid,
          mrn: p?.mrn || "",
          ward: adm?.ward_id || "",
          diagnosis: adm?.diagnosis_on_admission || "",
        };
      }));

      await base44.entities.DoctorHandover.create({
        ...form,
        active_patients: activePatientsJson,
        linked_patient_ids: JSON.stringify(selectedPatients),
        handover_date: new Date().toISOString(),
      });

      const h = await base44.entities.DoctorHandover.list("-created_date", 50);
      setHandovers(h);
      setShowForm(false);
      setSelectedPatients([]);
      setForm({
        to_doctor_id: "", shift_type: "morning", critical_cases: "",
        pending_investigations: "", pending_consults: "", treatment_updates: "",
        discharge_planning: "", new_admissions: "", incidents: "", general_notes: "",
      });
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const togglePatient = (pid) => {
    setSelectedPatients(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  const filteredPatients = patients.filter(p => {
    if (!patientSearch) return true;
    const q = patientSearch.toLowerCase();
    return (
      p.first_name?.toLowerCase().includes(q) ||
      p.last_name?.toLowerCase().includes(q) ||
      p.mrn?.toLowerCase().includes(q)
    );
  });

  const shiftColor = (type) => SHIFT_TYPES.find(s => s.value === type)?.color || "";

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const applyTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    const t = templates.find(tmpl => tmpl.id === templateId);
    if (!t) return;
    setForm({
      ...form,
      shift_type: t.shift_type || form.shift_type,
      critical_cases: t.critical_cases || form.critical_cases,
      pending_investigations: t.pending_investigations || form.pending_investigations,
      pending_consults: t.pending_consults || form.pending_consults,
      treatment_updates: t.treatment_updates || form.treatment_updates,
      discharge_planning: t.discharge_planning || form.discharge_planning,
      new_admissions: t.new_admissions || form.new_admissions,
      incidents: t.incidents || form.incidents,
      general_notes: t.general_notes || form.general_notes,
    });
  };

  const syncShiftReports = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await base44.functions.invoke("syncShiftReports", {});
      setSyncResult(data);
    } catch (e) {
      setSyncResult({ error: "Sync failed" });
    } finally {
      setSyncing(false);
    }
  };

  const exportHandoverCSV = async () => {
    setExporting(true);
    try {
      const response = await base44.functions.invoke("exportHandoverReport", {});
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doctor-handover-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

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
          <h2 className="section-title">Doctor Shift Handover</h2>
          <p className="text-sm text-muted-foreground mt-1">Clinical shift handover with patient handoff & compliance tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncShiftReports}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Syncing..." : "Sync Reports"}
          </button>
          <button
            onClick={exportHandoverCSV}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Export CSV
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setTab("handover"); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Handover
          </button>
        </div>
        {syncResult && !syncResult.error && (
          <div className="mt-2 p-2.5 bg-chart-3/5 border border-chart-3/20 rounded-lg text-xs text-chart-3">
            Synced {syncResult.synced_count} handover{ syncResult.synced_count !== 1 ? 's' : ''}
            {syncResult.skipped_count > 0 && ` (${syncResult.skipped_count} skipped)`}
          </div>
        )}
        {syncResult?.error && (
          <div className="mt-2 p-2.5 bg-destructive/5 border border-destructive/20 rounded-lg text-xs text-destructive">
            {syncResult.error}
          </div>
        )}
      </div>

      <div className="mb-4 border-b border-border flex gap-1">
        {[
          { key: "handover", label: "Handover Logs", icon: ClipboardList },
          { key: "active", label: "Active Patients", icon: Users },
          { key: "compliance", label: "Compliance", icon: ShieldCheck },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* New Handover Form */}
      {showForm && (
        <form onSubmit={submitHandover} className="mb-6 p-5 bg-muted/30 rounded-xl space-y-4 border border-border/50">
          <h4 className="font-heading font-semibold flex items-center gap-2">
            <ClipboardPen className="w-4 h-4 text-primary" /> New Clinical Handover
          </h4>

          {/* Quick Template Selector */}
          {templates.length > 0 && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <label className="block text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-primary" /> Quick Template
              </label>
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                  value={selectedTemplate}
                  onChange={e => applyTemplate(e.target.value)}
                >
                  <option value="">Select a handover template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.shift_type})</option>
                  ))}
                </select>
                {selectedTemplate && (
                  <button
                    type="button"
                    onClick={() => { setSelectedTemplate(""); }}
                    className="px-2.5 py-2 rounded-lg border border-border text-xs hover:bg-muted flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              {selectedTemplate && (
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Template applied — all sections pre-filled. Edit as needed.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">Handover To *</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.to_doctor_id}
                onChange={e => setForm({...form, to_doctor_id: e.target.value})}
                required
              >
                <option value="">Select receiving doctor</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">Shift Type *</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.shift_type}
                onChange={e => setForm({...form, shift_type: e.target.value})}
              >
                {SHIFT_TYPES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Patient Selection */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1 font-medium">
              Active Patients ({selectedPatients.length} selected)
            </label>
            <div className="border border-border rounded-lg bg-background p-2 max-h-[200px] overflow-y-auto">
              <div className="mb-2 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  className="w-full pl-8 pr-3 py-1.5 rounded border border-border text-xs bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Search patients..."
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                />
              </div>
              <div className="space-y-0.5">
                {filteredPatients.slice(0, 30).map(p => (
                  <label key={p.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedPatients.includes(p.id)}
                      onChange={() => togglePatient(p.id)}
                      className="rounded"
                    />
                    <span className="font-medium">{p.first_name} {p.last_name}</span>
                    <span className="text-muted-foreground">{p.mrn && `MRN: ${p.mrn}`}</span>
                    {activePatients.some(a => a.patient_id === p.id) && (
                      <span className="ml-auto px-1.5 py-0.5 rounded bg-clinical-normal/10 text-clinical-normal text-[10px] font-medium">Admitted</span>
                    )}
                  </label>
                ))}
                {filteredPatients.length === 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">No patients found.</p>
                )}
              </div>
            </div>
          </div>

          {/* Clinical Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: "critical_cases", label: "Critical Cases / ICU", placeholder: "Patients requiring immediate attention..." },
              { key: "pending_investigations", label: "Pending Investigations", placeholder: "Lab/imaging orders awaiting results..." },
              { key: "pending_consults", label: "Pending Specialist Consults", placeholder: "Awaiting specialist review..." },
              { key: "treatment_updates", label: "Treatment Plan Updates", placeholder: "Changes made during this shift..." },
              { key: "discharge_planning", label: "Discharge Planning", placeholder: "Patients ready or near discharge..." },
              { key: "new_admissions", label: "New Admissions This Shift", placeholder: "Patients admitted during shift..." },
              { key: "incidents", label: "Incidents / Adverse Events", placeholder: "Any clinical incidents to report..." },
              { key: "general_notes", label: "General Notes", placeholder: "Any other important information..." },
            ].map(f => (
              <div key={f.key} className={f.key === "general_notes" || f.key === "critical_cases" ? "md:col-span-2" : ""}>
                <label className="block text-xs text-muted-foreground mb-0.5 font-medium">{f.label}</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                  rows={2}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm({...form, [f.key]: e.target.value})}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !form.to_doctor_id}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Submit Handover
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Handover Logs Tab */}
      {tab === "handover" && (
        <div>
          {handovers.length === 0 ? (
            <div className="py-16 text-center">
              <ArrowRightLeft className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No doctor handover logs yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Click "New Handover" to create the first one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {handovers.map(h => {
                const parsedActive = h.active_patients ? JSON.parse(h.active_patients) : [];
                return (
                  <div key={h.id} className={`p-4 rounded-xl border transition-all ${
                    h.acknowledged
                      ? "bg-clinical-normal/5 border-clinical-normal/20"
                      : "bg-chart-2/5 border-chart-2/20"
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <ArrowRightLeft className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm">
                            {getUserName(h.from_doctor_id || h.created_by_id)} → {getUserName(h.to_doctor_id)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(h.handover_date).toLocaleString("en-GB", {
                            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${shiftColor(h.shift_type)}`}>
                            {h.shift_type}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.acknowledged ? (
                          <span className="flex items-center gap-1 text-clinical-normal text-xs font-medium">
                            <Check className="w-3.5 h-3.5" /> Acknowledged
                          </span>
                        ) : (
                          <button
                            onClick={() => acknowledgeHandover(h.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-chart-3/10 text-chart-3 rounded-lg text-xs font-medium hover:bg-chart-3/20"
                          >
                            <Check className="w-3.5 h-3.5" /> Acknowledge
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Active Patients */}
                    {parsedActive.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                          <Users className="w-3 h-3 inline mr-1" /> Active Patients ({parsedActive.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {parsedActive.map((p, i) => (
                            <span key={i} className="px-2 py-1 rounded-lg bg-muted/50 text-xs font-medium">
                              {p.name || p.patient_id?.slice(0, 8)}
                              {p.ward && <span className="text-muted-foreground ml-1">· {p.ward}</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
                      {h.critical_cases && (
                        <p className="text-destructive"><AlertTriangle className="w-3 h-3 inline mr-1" />Critical: {h.critical_cases.slice(0, 120)}{h.critical_cases.length > 120 && "..."}</p>
                      )}
                      {h.pending_investigations && (
                        <p className="text-chart-2"><Clock className="w-3 h-3 inline mr-1" />Pending: {h.pending_investigations.slice(0, 120)}{h.pending_investigations.length > 120 && "..."}</p>
                      )}
                      {h.treatment_updates && (
                        <p className="text-primary"><Stethoscope className="w-3 h-3 inline mr-1" />Updates: {h.treatment_updates.slice(0, 120)}{h.treatment_updates.length > 120 && "..."}</p>
                      )}
                      {h.general_notes && (
                        <p className="text-muted-foreground">{h.general_notes.slice(0, 120)}{h.general_notes.length > 120 && "..."}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Active Patients Tab */}
      {tab === "active" && (
        <div>
          <h4 className="font-heading font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Currently Admitted Patients ({activePatients.length})
          </h4>
          {activePatients.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No patients currently admitted.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Patient</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">MRN</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Ward</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Admission</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Diagnosis</th>
                  </tr>
                </thead>
                <tbody>
                  {activePatients.map(a => {
                    const p = patients.find(pt => pt.id === a.patient_id);
                    return (
                      <tr key={a.id} className="border-b border-border/40 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">
                          {p ? `${p.first_name} ${p.last_name}` : a.patient_id?.slice(0, 8)}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">{p?.mrn || "—"}</td>
                        <td className="py-2 px-3">{a.ward_id || "—"}</td>
                        <td className="py-2 px-3 text-xs">
                          {new Date(a.admission_date).toLocaleDateString("en-GB")}
                          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary">
                            {a.admission_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs">{a.diagnosis_on_admission || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Compliance Tab */}
      {tab === "compliance" && <StaffComplianceDashboard />}
    </div>
  );
}