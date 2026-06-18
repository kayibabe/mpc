import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, Plus, Save, Users, UserPlus, Upload, FileBarChart, Settings, Building2, Loader2, ClipboardList, Filter, X, Clock, TrendingUp, Trash2, DollarSign, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import WasteManagement from "@/components/WasteManagement";
import ShiftManagement from "@/components/ShiftManagement";
import StaffPerformance from "@/components/StaffPerformance";
import CashierShiftAudit from "@/components/CashierShiftAudit";
import DHIS2ReportsDownloads from "@/components/AdminDashboard/DHIS2ReportsDownloads";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [exports, setExports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilter, setAuditFilter] = useState({ entity_type: "", action: "", limit: 100 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "user" });
  const [updatingRole, setUpdatingRole] = useState(null);
  const [editingUser, setEditingUser] = useState(null); // { id, full_name }
  const [editingName, setEditingName] = useState("");
  const [editingScheme, setEditingScheme] = useState(null);
  const [schemeEditForm, setSchemeEditForm] = useState({});

  const STAFF_ROLES = [
    { value: "user", label: "User (Default)" },
    { value: "admin", label: "Admin" },
    { value: "doctor", label: "Doctor" },
    { value: "clinician", label: "Clinician" },
    { value: "nurse", label: "Nurse" },
    { value: "midwife", label: "Midwife" },
    { value: "pharmacist", label: "Pharmacist" },
    { value: "lab_technician", label: "Lab Technician" },
    { value: "radiographer", label: "Radiographer" },
    { value: "cashier", label: "Cashier" },
    { value: "receptionist", label: "Receptionist" },
    { value: "surgical_lead", label: "Surgical Lead" },
    { value: "store_manager", label: "Store Manager" },
  ];
  const [showSchemeForm, setShowSchemeForm] = useState(false);
  const [schemeForm, setSchemeForm] = useState({ name: "", code: "", contact_phone: "", contact_email: "", coverage_details: "" });
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', title, message }
  const [userSearch, setUserSearch] = useState("");

  const showToast = (type, title, message) => {
    setToast({ type, title, message });
    setTimeout(() => setToast(null), 6000);
  };

  useEffect(() => {
    async function load() {
      try {
        const [u, s, e, a] = await Promise.all([
          base44.entities.User.list("", 100),
          base44.entities.MedicalAidScheme.list("", 50),
          base44.entities.DHIS2Export.list("-created_date", 20),
          base44.entities.AuditLog.list("-created_date", 100),
        ]);
        setUsers(u);
        setSchemes(s);
        setExports(e);
        setAuditLogs(a);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const inviteUser = async (e) => {
    e.preventDefault();
    try {
      // Platform only accepts "user" or "admin" at invite time; role is updated after registration
      const inviteRole = ["admin"].includes(inviteForm.role) ? "admin" : "user";
      await base44.users.inviteUser(inviteForm.email, inviteRole);
      const roleLabel = STAFF_ROLES.find(r => r.value === inviteForm.role)?.label || inviteForm.role;
      const sentEmail = inviteForm.email;
      setInviteForm({ email: "", role: "user" });
      setShowInvite(false);
      showToast("success", "Invitation Sent!", `An invite email was sent to ${sentEmail}. Once they register, update their role to "${roleLabel}" using the dropdown in the users table.`);
    } catch (err) {
      showToast("error", "Invite Failed", err.message);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    setUpdatingRole(userId);
    try {
      await base44.entities.User.update(userId, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      showToast("error", "Role Update Failed", err.message);
    } finally {
      setUpdatingRole(null);
    }
  };

  const startEditName = (u) => {
    setEditingUser(u.id);
    setEditingName(u.display_name || u.full_name || "");
  };

  const saveEditName = async (userId) => {
    try {
      await base44.entities.User.update(userId, { display_name: editingName });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, display_name: editingName } : u));
    } catch (err) {
      showToast("error", "Name Update Failed", err.message);
    } finally {
      setEditingUser(null);
    }
  };

  const addScheme = async (e) => {
    e.preventDefault();
    await base44.entities.MedicalAidScheme.create(schemeForm);
    const s = await base44.entities.MedicalAidScheme.list("", 50);
    setSchemes(s);
    setShowSchemeForm(false);
    setSchemeForm({ name: "", code: "", contact_phone: "", contact_email: "", coverage_details: "" });
  };

  const startEditScheme = (scheme) => {
    setEditingScheme(scheme.id);
    setSchemeEditForm(scheme);
  };

  const saveEditScheme = async () => {
    try {
      await base44.entities.MedicalAidScheme.update(editingScheme, schemeEditForm);
      const s = await base44.entities.MedicalAidScheme.list("", 50);
      setSchemes(s);
      setEditingScheme(null);
    } catch (err) {
      showToast("error", "Update Failed", err.message);
    }
  };

  const refreshAuditLogs = async () => {
    const filters = {};
    if (auditFilter.entity_type) filters.entity_type = auditFilter.entity_type;
    if (auditFilter.action) filters.action = auditFilter.action;
    const a = await base44.entities.AuditLog.list("-created_date", auditFilter.limit);
    setAuditLogs(a);
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    if (auditFilter.entity_type && log.entity_type !== auditFilter.entity_type) return false;
    if (auditFilter.action && log.action !== auditFilter.action) return false;
    return true;
  });

  const generateDHIS2Export = async () => {
    setExporting(true);
    try {
      const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      await base44.functions.invoke('generateDHIS2Report', { period, report_type: 'aggregate_monthly' });
      const e = await base44.entities.DHIS2Export.list("-created_date", 20);
      setExports(e);
    } catch (err) {
      showToast("error", "Export Failed", err.response?.data?.error || err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="section-title">Administration</h2><p className="text-sm text-muted-foreground mt-1">User management, scheme configuration, DHIS2 exports</p></div>
      </div>

      <div className="bg-card rounded-xl border border-border/60 shadow-sm">
        <div className="border-b border-border flex">
          {[
            { key: "users", icon: Users, label: "Users" },
            { key: "schemes", icon: Building2, label: "Medical Aid Schemes" },
            { key: "shifts", icon: Clock, label: "Shift Management" },
            { key: "performance", icon: TrendingUp, label: "Staff Performance" },
            { key: "dhis2", icon: FileBarChart, label: "DHIS2 Exports" },
            { key: "audit", icon: ClipboardList, label: "Audit Log" },
            { key: "waste", icon: Trash2, label: "Waste Management" },
            { key: "cashier-audit", icon: DollarSign, label: "Cashier Audit" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}><tab.icon className="w-4 h-4" />{tab.label}</button>
          ))}
        </div>
        <div className="p-5">
          {activeTab === "users" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">{users.filter(u => !userSearch || u.display_name?.toLowerCase().includes(userSearch.toLowerCase()) || u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()) || u.role?.toLowerCase().includes(userSearch.toLowerCase())).length} of {users.length} users</p>
                <button onClick={() => setShowInvite(!showInvite)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><UserPlus className="w-4 h-4" /> Invite User</button>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search by name, email, or role..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>

              {showInvite && (
                <form onSubmit={inviteUser} className="mb-4 p-4 bg-muted/30 rounded-xl flex flex-col sm:flex-row gap-3">
                  <div className="flex-1"><label className="block text-xs text-muted-foreground mb-1">Email *</label><input type="email" required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} placeholder="user@example.com" /></div>
                  <div><label className="block text-xs text-muted-foreground mb-1">Role</label><select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={inviteForm.role} onChange={e => setInviteForm({...inviteForm, role: e.target.value})}>{STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
                  <div className="flex items-end gap-2"><button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Send Invite</button><button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button></div>
                </form>
              )}

              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Email</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Role</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Joined</th></tr></thead><tbody>
                {users.filter(u => !userSearch || u.display_name?.toLowerCase().includes(userSearch.toLowerCase()) || u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()) || u.role?.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                  <tr key={u.id} className="border-b border-border/40">
                    <td className="py-2.5 px-3 font-medium">
                      {editingUser === u.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            className="rounded border border-border bg-background px-2 py-1 text-sm w-36"
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveEditName(u.id); if (e.key === "Escape") setEditingUser(null); }}
                          />
                          <button onClick={() => saveEditName(u.id)} className="text-xs text-primary font-medium hover:underline">Save</button>
                          <button onClick={() => setEditingUser(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <span
                          className="cursor-pointer hover:text-primary transition-colors"
                          title="Click to edit"
                          onClick={() => startEditName(u)}
                        >
                          {u.display_name || u.full_name || <span className="text-muted-foreground italic">—</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{u.email}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <select
                          className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium"
                          value={u.role || "user"}
                          onChange={e => updateUserRole(u.id, e.target.value)}
                          disabled={updatingRole === u.id}
                        >
                          {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        {updatingRole === u.id && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{new Date(u.created_date).toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody></table></div>
            </div>
          )}

          {activeTab === "schemes" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">{schemes.length} configured schemes</p>
                <button onClick={() => setShowSchemeForm(!showSchemeForm)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Add Scheme</button>
              </div>

              {showSchemeForm && (
                <form onSubmit={addScheme} className="mb-4 p-4 bg-muted/30 rounded-xl space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div><label className="block text-xs text-muted-foreground mb-1">Name *</label><input required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={schemeForm.name} onChange={e => setSchemeForm({...schemeForm, name: e.target.value})} /></div>
                    <div><label className="block text-xs text-muted-foreground mb-1">Code *</label><input required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={schemeForm.code} onChange={e => setSchemeForm({...schemeForm, code: e.target.value})} /></div>
                    <div><label className="block text-xs text-muted-foreground mb-1">Phone</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={schemeForm.contact_phone} onChange={e => setSchemeForm({...schemeForm, contact_phone: e.target.value})} /></div>
                    <div><label className="block text-xs text-muted-foreground mb-1">Email</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={schemeForm.contact_email} onChange={e => setSchemeForm({...schemeForm, contact_email: e.target.value})} /></div>
                    <div className="md:col-span-2"><label className="block text-xs text-muted-foreground mb-1">Coverage Details</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={schemeForm.coverage_details} onChange={e => setSchemeForm({...schemeForm, coverage_details: e.target.value})} /></div>
                  </div>
                  <div className="flex gap-3"><button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Save className="w-3 h-3 inline mr-1" /> Save</button><button type="button" onClick={() => setShowSchemeForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button></div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {schemes.map(s => (
                  <button key={s.id} onClick={() => startEditScheme(s)} className="p-4 border border-border rounded-xl hover:border-primary/30 hover:shadow-md transition-all text-left cursor-pointer">
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                    {s.contact_phone && <p className="text-xs text-muted-foreground mt-1">{s.contact_phone}</p>}
                    {s.contact_email && <p className="text-xs text-muted-foreground">{s.contact_email}</p>}
                  </button>
                ))}
                {schemes.length === 0 && <p className="col-span-3 py-8 text-center text-sm text-muted-foreground">No schemes configured.</p>}
              </div>
            </div>
          )}

          {activeTab === "shifts" && <ShiftManagement />}

          {activeTab === "performance" && <StaffPerformance />}

          {activeTab === "dhis2" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <div></div>
                <button onClick={generateDHIS2Export} disabled={exporting} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">{exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {exporting ? "Generating..." : "Generate Export"}</button>
              </div>
              <DHIS2ReportsDownloads />
            </div>
          )}

          {activeTab === "waste" && <WasteManagement />}

          {activeTab === "cashier-audit" && <CashierShiftAudit />}

          {activeTab === "audit" && (
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <p className="text-sm text-muted-foreground">{filteredAuditLogs.length} log entries</p>
                <div className="flex items-center gap-2 ml-auto">
                  <select className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" value={auditFilter.entity_type} onChange={e => setAuditFilter({...auditFilter, entity_type: e.target.value})}>
                    <option value="">All Entities</option>
                    <option value="Patient">Patient</option>
                    <option value="Visit">Visit</option>
                    <option value="Appointment">Appointment</option>
                    <option value="Consultation">Consultation</option>
                    <option value="LabOrder">LabOrder</option>
                    <option value="Prescription">Prescription</option>
                    <option value="Invoice">Invoice</option>
                    <option value="Drug">Drug</option>
                    <option value="Admission">Admission</option>
                    <option value="Discharge">Discharge</option>
                    <option value="PatientJourney">PatientJourney</option>
                    <option value="ShiftHandoverLog">ShiftHandoverLog</option>
                  </select>
                  <select className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" value={auditFilter.action} onChange={e => setAuditFilter({...auditFilter, action: e.target.value})}>
                    <option value="">All Actions</option>
                    <option value="create">Create</option>
                    <option value="update">Update</option>
                    <option value="delete">Delete</option>
                  </select>
                  <button onClick={() => setAuditFilter({ entity_type: "", action: "", limit: 100 })} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
                  <button onClick={refreshAuditLogs} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">Refresh</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium text-muted-foreground">Time</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">User</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Action</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Entity</th><th className="text-left py-2 px-3 font-medium text-muted-foreground">Details</th></tr></thead>
                  <tbody>
                    {filteredAuditLogs.slice(0, auditFilter.limit).map(log => {
                      let changesParsed = null;
                      try { changesParsed = log.changes ? JSON.parse(log.changes) : null; } catch (e) {}
                      return (
                        <tr key={log.id} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="py-2.5 px-3 text-xs whitespace-nowrap">{new Date(log.timestamp || log.created_date).toLocaleString("en-GB")}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-xs">{log.user_id?.slice(0, 8)}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              log.action === 'create' ? 'bg-chart-2/10 text-chart-2' :
                              log.action === 'update' ? 'bg-chart-1/10 text-chart-1' :
                              log.action === 'delete' ? 'bg-destructive/10 text-destructive' :
                              'bg-muted text-muted-foreground'
                            }`}>{log.action}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium">{log.entity_type}</span>
                            {log.entity_id && <span className="text-xs text-muted-foreground block font-mono">{log.entity_id.slice(0, 8)}</span>}
                          </td>
                          <td className="py-2.5 px-3 text-xs max-w-xs">
                            {changesParsed ? (
                              <details className="cursor-pointer">
                                <summary className="text-primary hover:underline">
                                  {log.action === 'update' && changesParsed.changed_fields
                                    ? `${changesParsed.changed_fields.length} fields changed`
                                    : 'View details'}
                                </summary>
                                <pre className="mt-1 p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">{JSON.stringify(changesParsed, null, 2)}</pre>
                              </details>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredAuditLogs.length === 0 && (
                      <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No audit log entries found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Scheme Modal */}
      {editingScheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingScheme(null)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-card rounded-xl border border-border shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold">Edit Scheme</h3>
              <button onClick={() => setEditingScheme(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Name</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={schemeEditForm.name || ""} onChange={e => setSchemeEditForm({...schemeEditForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Code</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={schemeEditForm.code || ""} onChange={e => setSchemeEditForm({...schemeEditForm, code: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Phone</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={schemeEditForm.contact_phone || ""} onChange={e => setSchemeEditForm({...schemeEditForm, contact_phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Email</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={schemeEditForm.contact_email || ""} onChange={e => setSchemeEditForm({...schemeEditForm, contact_email: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Coverage Details</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={schemeEditForm.coverage_details || ""} onChange={e => setSchemeEditForm({...schemeEditForm, coverage_details: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveEditScheme} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Save Changes</button>
              <button onClick={() => setEditingScheme(null)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 max-w-sm w-full shadow-2xl rounded-2xl border overflow-hidden ${
          toast.type === "success" ? "bg-white border-emerald-200" : "bg-white border-red-200"
        }`}>
          <div className={`h-1 w-full ${toast.type === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
          <div className="p-4 flex items-start gap-3">
            <div className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
              toast.type === "success" ? "bg-emerald-100" : "bg-red-100"
            }`}>
              {toast.type === "success"
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                : <AlertCircle className="w-5 h-5 text-red-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${toast.type === "success" ? "text-emerald-900" : "text-red-900"}`}>
                {toast.title}
              </p>
              <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{toast.message}</p>
              {toast.type === "success" && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <Mail className="w-3.5 h-3.5" /> Check their inbox for the invite link
                </div>
              )}
            </div>
            <button onClick={() => setToast(null)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}