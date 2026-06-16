import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, UserPlus, ChevronDown, Check, Clock, Phone, MapPin, Users, RefreshCw } from "lucide-react";
import InsuranceVerifier from "@/components/InsuranceVerifier";

export default function Reception() {
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", date_of_birth: "", gender: "male", phone: "",
    national_id: "", blood_group: "", district: "", village: "", landmark: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    insurance_scheme: "", insurance_member_number: "", payment_type: "cash",
    visit_type: "outpatient", priority: "normal",
  });

  useEffect(() => {
    async function load() {
      try {
        const [p, v] = await Promise.all([
          base44.entities.Patient.list("-created_date", 200),
          base44.entities.Visit.list("-created_date", 50),
        ]);
        setPatients(p);
        setVisits(v);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    p.mrn?.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search)
  );

  const syncPatient = async (patientId) => {
    try {
      const { data } = await base44.functions.invoke('syncPatientRecords', { patient_id: patientId });
      alert(`Synced: ${data.updates_applied?.visits || 0} visits, ${data.updates_applied?.invoices || 0} invoices updated.`);
    } catch (e) { console.error(e); }
  };

  const schemes = ["MASM", "Liberty Health", "MRA", "PSMAS", "Madison", "Resolution Health", "Britam", "Old Mutual", "CHAM"];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const mrn = `ZCP-${String(patients.length + 1).padStart(6, "0")}`;
    try {
      const patient = await base44.entities.Patient.create({
        ...form, mrn,
        insurance_scheme: form.payment_type === "scheme" || form.payment_type === "both" ? form.insurance_scheme : "",
      });
      await base44.entities.Visit.create({
        patient_id: patient.id,
        visit_date: new Date().toISOString(),
        visit_type: form.visit_type,
        payment_type: form.payment_type,
        scheme_name: form.insurance_scheme,
        priority: form.priority,
        queue_status: "waiting",
        checked_in_by: "reception",
      });
      const [p, v] = await Promise.all([
        base44.entities.Patient.list("-created_date", 200),
        base44.entities.Visit.list("-created_date", 50),
      ]);
      setPatients(p);
      setVisits(v);
      setShowForm(false);
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Reception</h2>
          <p className="text-sm text-muted-foreground mt-1">Patient registration, search, and queue management</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
          <UserPlus className="w-4 h-4" /> Register Patient
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-sm mb-6">
          <h3 className="font-heading text-lg font-semibold mb-5">New Patient Registration</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">First Name *</label>
                <input required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Last Name *</label>
                <input required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Date of Birth</label>
                <input type="date" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Gender *</label>
                <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                  <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Phone *</label>
                <input required type="tel" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">National ID</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.national_id} onChange={e => setForm({...form, national_id: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">District</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.district} onChange={e => setForm({...form, district: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Village/Area</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.village} onChange={e => setForm({...form, village: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Landmark</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.landmark} onChange={e => setForm({...form, landmark: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Emergency Contact Name</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.emergency_contact_name} onChange={e => setForm({...form, emergency_contact_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Emergency Contact Phone</label>
                <input type="tel" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.emergency_contact_phone} onChange={e => setForm({...form, emergency_contact_phone: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Visit Type *</label>
                <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.visit_type} onChange={e => setForm({...form, visit_type: e.target.value})}>
                  <option value="outpatient">Outpatient (OPD)</option>
                  <option value="inpatient">Inpatient (IPD)</option>
                  <option value="emergency">Emergency</option>
                  <option value="anc">ANC Visit</option>
                  <option value="postnatal">Postnatal</option>
                  <option value="procedure">Procedure</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Type *</label>
                <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.payment_type} onChange={e => setForm({...form, payment_type: e.target.value})}>
                  <option value="cash">Cash / Self-pay</option>
                  <option value="scheme">Medical Aid Scheme</option>
                  <option value="both">Both (Scheme + Co-pay)</option>
                </select>
              </div>
              {(form.payment_type === "scheme" || form.payment_type === "both") && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Scheme</label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.insurance_scheme} onChange={e => setForm({...form, insurance_scheme: e.target.value})}>
                    <option value="">Select scheme</option>
                    {schemes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">Register & Check In</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border/60 shadow-sm mb-6">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search patients by name, MRN, or phone..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border/60 shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="font-heading font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Patients ({filteredPatients.length})</h3>
          </div>
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {filteredPatients.map(p => (
              <div key={p.id} className="p-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.mrn || "No MRN"} • {p.phone}</p>
                    {p.district && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {p.district}{p.village ? `, ${p.village}` : ""}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.insurance_scheme ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {p.insurance_scheme || "Self-pay"}
                  </span>
                  <button onClick={() => syncPatient(p.id)} className="ml-2 p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Sync patient records across system">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <InsuranceVerifier 
                  patientId={p.id} 
                  patientName={`${p.first_name} ${p.last_name}`}
                  schemeName={p.insurance_scheme}
                  memberNumber={p.insurance_member_number}
                />
              </div>
            ))}
            {filteredPatients.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No patients found.</p>}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border/60 shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="font-heading font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Today's Queue ({visits.length})</h3>
          </div>
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {visits.map(v => (
              <div key={v.id} className="p-3 hover:bg-muted/40 transition-colors flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium capitalize">{v.visit_type}</p>
                  <p className="text-xs text-muted-foreground">{new Date(v.created_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} • {v.payment_type}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  v.queue_status === "completed" ? "bg-chart-2/10 text-chart-2" :
                  v.queue_status === "in_consultation" ? "bg-chart-1/10 text-chart-1" :
                  v.queue_status === "waiting" ? "bg-chart-4/10 text-chart-4" :
                  "bg-muted text-muted-foreground"
                }`}>{v.queue_status}</span>
              </div>
            ))}
            {visits.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Queue is empty.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}