import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { UserCircle, Calendar, FlaskConical, Receipt, Baby, Clock, ChevronRight } from "lucide-react";

export default function PatientPortal() {
  const [phone, setPhone] = useState("");
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [maternalVisits, setMaternalVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const patients = await base44.entities.Patient.filter({ phone }, "-created_date", 1);
      if (patients.length === 0) {
        setPatient(null);
        setLoading(false);
        return;
      }
      const p = patients[0];
      setPatient(p);
      const [a, inv, lab, m] = await Promise.all([
        base44.entities.Appointment.filter({ patient_id: p.id }, "-appointment_date", 20),
        base44.entities.Invoice.filter({ patient_id: p.id }, "-created_date", 20),
        base44.entities.LabResult.filter({ patient_id: p.id }, "-created_date", 20),
        base44.entities.MaternalVisit.filter({ patient_id: p.id }, "-created_date", 10),
      ]);
      setAppointments(a);
      setInvoices(inv);
      setLabResults(lab);
      setMaternalVisits(m);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="page-container max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <UserCircle className="w-8 h-8 text-primary" />
        </div>
        <h2 className="section-title">Patient Portal</h2>
        <p className="text-sm text-muted-foreground mt-2">View your appointments, results, and billing history</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          type="tel"
          required
          className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
          placeholder="Enter your registered phone number..."
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
        <button type="submit" disabled={loading} className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50">
          {loading ? "Searching..." : "View Records"}
        </button>
      </form>

      {searched && !patient && !loading && (
        <div className="text-center py-12 bg-card rounded-xl border border-border/60">
          <p className="text-muted-foreground">No patient found with that phone number.</p>
          <p className="text-sm text-muted-foreground mt-1">Please visit the clinic reception to register.</p>
        </div>
      )}

      {patient && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {patient.first_name?.[0]}{patient.last_name?.[0]}
              </div>
              <div>
                <h3 className="font-heading font-semibold text-lg">{patient.first_name} {patient.last_name}</h3>
                <p className="text-sm text-muted-foreground font-mono">MRN: {patient.mrn || "Pending"} • {patient.phone}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: Calendar, label: "Appointments", count: appointments.length, color: "text-chart-1", bg: "bg-chart-1/10" },
              { icon: FlaskConical, label: "Lab Results", count: labResults.length, color: "text-chart-3", bg: "bg-chart-3/10" },
              { icon: Receipt, label: "Invoices", count: invoices.length, color: "text-chart-5", bg: "bg-chart-5/10" },
              { icon: Baby, label: "ANC Visits", count: maternalVisits.length, color: "text-chart-2", bg: "bg-chart-2/10" },
            ].map(s => (
              <div key={s.label} className="stat-card flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
                <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.count}</p></div>
              </div>
            ))}
          </div>

          {appointments.length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Upcoming Appointments</h4>
              <div className="divide-y divide-border">
                {appointments.map(a => (
                  <div key={a.id} className="py-3 flex items-center justify-between">
                    <div><p className="font-medium text-sm">{a.appointment_date} at {a.appointment_time}</p><p className="text-xs text-muted-foreground capitalize">{a.type?.replace(/_/g, " ")}</p></div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === "scheduled" ? "bg-chart-1/10 text-chart-1" : a.status === "completed" ? "bg-chart-2/10 text-chart-2" : "bg-muted text-muted-foreground"}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {labResults.length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary" /> Lab Results</h4>
              <div className="divide-y divide-border">
                {labResults.map(r => (
                  <div key={r.id} className="py-3">
                    <div className="flex items-center justify-between"><p className="font-medium text-sm">{r.test_name}</p><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.is_critical ? "bg-destructive/10 text-destructive" : "bg-chart-2/10 text-chart-2"}`}>{r.status}</span></div>
                    <p className="text-sm mt-1"><span className="font-semibold">{r.result_value}</span> {r.unit && <span className="text-muted-foreground">{r.unit}</span>}</p>
                    {r.reference_range && <p className="text-xs text-muted-foreground mt-0.5">Reference: {r.reference_range}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {invoices.length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" /> Billing History</h4>
              <div className="divide-y divide-border">
                {invoices.map(inv => (
                  <div key={inv.id} className="py-3 flex items-center justify-between">
                    <div><p className="font-medium text-sm">{inv.invoice_number}</p><p className="text-xs text-muted-foreground">{new Date(inv.created_date).toLocaleDateString("en-GB")}</p></div>
                    <div className="text-right"><p className="font-semibold text-sm">MWK {inv.total_amount?.toLocaleString()}</p><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.status === "paid" ? "bg-chart-2/10 text-chart-2" : "bg-chart-4/10 text-chart-4"}`}>{inv.status}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {maternalVisits.length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><Baby className="w-4 h-4 text-primary" /> Pregnancy Records</h4>
              <div className="divide-y divide-border">
                {maternalVisits.map(v => (
                  <div key={v.id} className="py-3">
                    <p className="font-medium text-sm">ANC Visit #{v.anc_visit_number} — {new Date(v.visit_date).toLocaleDateString("en-GB")}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{v.gestational_age_weeks} weeks</span>
                      <span>G{v.gravida}P{v.para}</span>
                      {v.edd && <span>EDD: {v.edd}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}