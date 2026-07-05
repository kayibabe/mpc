import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { UserCircle, Calendar, FlaskConical, Receipt, Baby, Clock, Pill, Syringe, FileText, Edit3, Plus, Save, X } from "lucide-react";

const TABS = [
  { key: "overview", label: "Overview", icon: UserCircle },
  { key: "appointments", label: "Appointments", icon: Calendar },
  { key: "visits", label: "Visits", icon: Clock },
  { key: "labs", label: "Lab Results", icon: FlaskConical },
  { key: "medications", label: "Medications", icon: Pill },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "immunizations", label: "Immunizations", icon: Syringe },
  { key: "maternal", label: "ANC", icon: Baby },
];

export default function PatientPortal() {
  const [phone, setPhone] = useState("");
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Data states
  const [appointments, setAppointments] = useState([]);
  const [visits, setVisits] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [immunizations, setImmunizations] = useState([]);
  const [maternalVisits, setMaternalVisits] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);

  // Self-booking state
  const [showBooking, setShowBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState({ appointment_date: "", appointment_time: "", type: "follow_up", department: "", notes: "" });
  const [bookingResult, setBookingResult] = useState(null);

  // Profile edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ phone: "", emergency_contact_name: "", emergency_contact_phone: "", district: "", village: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    setActiveTab("overview");
    try {
      const patients = await base44.entities.Patient.filter({ phone }, "-created_date", 1);
      if (patients.length === 0) {
        setPatient(null);
        setLoading(false);
        return;
      }
      const p = patients[0];
      setPatient(p);
      setEditForm({ phone: p.phone || "", emergency_contact_name: p.emergency_contact_name || "", emergency_contact_phone: p.emergency_contact_phone || "", district: p.district || "", village: p.village || "" });
      const [a, v, inv, lab, presc, imm, m, diag] = await Promise.all([
        base44.entities.Appointment.filter({ patient_id: p.id }, "-appointment_date", 30),
        base44.entities.Visit.filter({ patient_id: p.id }, "-visit_date", 30),
        base44.entities.Invoice.filter({ patient_id: p.id }, "-created_date", 30),
        base44.entities.LabResult.filter({ patient_id: p.id }, "-created_date", 30),
        base44.entities.Prescription.filter({ patient_id: p.id }, "-created_date", 20),
        base44.entities.Immunization.filter({ patient_id: p.id }, "-created_date", 20),
        base44.entities.MaternalVisit.filter({ patient_id: p.id }, "-created_date", 10),
        base44.entities.Diagnosis.filter({ patient_id: p.id }, "-created_date", 30),
      ]);
      setAppointments(a);
      setVisits(v);
      setInvoices(inv);
      setLabResults(lab);
      setPrescriptions(presc);
      setImmunizations(imm);
      setMaternalVisits(m);
      setDiagnoses(diag);

      // Fetch prescription items
      const allItems = [];
      for (const pr of presc) {
        const items = await base44.entities.PrescriptionItem.filter({ prescription_id: pr.id }, "", 50);
        allItems.push(...items);
      }
      setPrescriptionItems(allItems);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setBookingResult(null);
    try {
      await base44.entities.Appointment.create({
        patient_id: patient.id,
        appointment_date: bookingForm.appointment_date,
        appointment_time: bookingForm.appointment_time,
        type: bookingForm.type,
        department: bookingForm.department,
        notes: bookingForm.notes,
        status: "scheduled",
        priority: "normal",
      });
      setBookingResult({ success: true, message: "Appointment booked successfully!" });
      setBookingForm({ appointment_date: "", appointment_time: "", type: "follow_up", department: "", notes: "" });
      const a = await base44.entities.Appointment.filter({ patient_id: patient.id }, "-appointment_date", 30);
      setAppointments(a);
      setTimeout(() => setBookingResult(null), 4000);
    } catch (e) {
      setBookingResult({ success: false, message: "Booking failed. Please try again." });
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await base44.entities.Patient.update(patient.id, editForm);
      setPatient({ ...patient, ...editForm });
      setEditing(false);
    } catch (e) { console.error(e); }
    finally { setSavingProfile(false); }
  };

  const statusColors = {
    scheduled: "bg-chart-1/10 text-chart-1",
    checked_in: "bg-primary/10 text-primary",
    in_progress: "bg-chart-2/10 text-chart-2",
    completed: "bg-chart-3/10 text-chart-3",
    cancelled: "bg-destructive/10 text-destructive",
    no_show: "bg-muted text-muted-foreground",
    pending: "bg-chart-4/10 text-chart-4",
    paid: "bg-chart-3/10 text-chart-3",
    partial: "bg-chart-2/10 text-chart-2",
    active: "bg-primary/10 text-primary",
    resolved: "bg-chart-3/10 text-chart-3",
    chronic: "bg-chart-2/10 text-chart-2",
  };

  const visitTypeLabel = (t) => ({ outpatient: "OPD", inpatient: "IPD", emergency: "ER", anc: "ANC", postnatal: "PNC", procedure: "PROC" }[t] || t);

  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <UserCircle className="w-8 h-8 text-primary" />
        </div>
        <h2 className="section-title">Patient Portal</h2>
        <p className="text-sm text-muted-foreground mt-2">View your records, book appointments, and manage your profile</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
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
        <div className="text-center py-16 bg-card rounded-xl border border-border/60">
          <UserCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No patient found with that phone number.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Please visit the clinic reception to register.</p>
        </div>
      )}

      {patient && (
        <div className="space-y-5">
          {/* Profile Header */}
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                  {patient.first_name?.[0]}{patient.last_name?.[0]}
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg">{patient.first_name} {patient.last_name}</h3>
                  <p className="text-sm text-muted-foreground">MRN: {patient.mrn || "Pending"} • {patient.gender} • {patient.blood_group || "N/A"}</p>
                  <p className="text-sm text-muted-foreground">{patient.phone} • {patient.district || "N/A"}{patient.village ? `, ${patient.village}` : ""}</p>
                </div>
              </div>
              <button onClick={() => setEditing(!editing)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {/* Inline Profile Edit */}
            {editing && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">Phone</label>
                    <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">Emergency Contact Name</label>
                    <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={editForm.emergency_contact_name} onChange={e => setEditForm({...editForm, emergency_contact_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">Emergency Contact Phone</label>
                    <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={editForm.emergency_contact_phone} onChange={e => setEditForm({...editForm, emergency_contact_phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">District</label>
                    <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={editForm.district} onChange={e => setEditForm({...editForm, district: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">Village</label>
                    <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={editForm.village} onChange={e => setEditForm({...editForm, village: e.target.value})} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleSaveProfile} disabled={savingProfile} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50">
                    <Save className="w-3 h-3" /> {savingProfile ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => { setEditing(false); setEditForm({ phone: patient.phone || "", emergency_contact_name: patient.emergency_contact_name || "", emergency_contact_phone: patient.emergency_contact_phone || "", district: patient.district || "", village: patient.village || "" }); }} className="px-4 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tab Bar */}
          <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <div className="border-b border-border flex overflow-x-auto">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3.5 py-3 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    activeTab === t.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* OVERVIEW */}
              {activeTab === "overview" && (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {[
                      { icon: Calendar, label: "Appointments", value: appointments.length, color: "text-chart-1", bg: "bg-chart-1/10" },
                      { icon: Clock, label: "Visits", value: visits.length, color: "text-primary", bg: "bg-primary/10" },
                      { icon: FlaskConical, label: "Lab Results", value: labResults.length, color: "text-chart-3", bg: "bg-chart-3/10" },
                      { icon: Receipt, label: "Invoices", value: invoices.length, color: "text-chart-5", bg: "bg-chart-5/10" },
                      { icon: Pill, label: "Prescriptions", value: prescriptions.length, color: "text-chart-2", bg: "bg-chart-2/10" },
                      { icon: Syringe, label: "Immunizations", value: immunizations.length, color: "text-chart-4", bg: "bg-chart-4/10" },
                      { icon: FileText, label: "Diagnoses", value: diagnoses.length, color: "text-destructive", bg: "bg-destructive/10" },
                      { icon: Baby, label: "ANC Visits", value: maternalVisits.length, color: "text-chart-2", bg: "bg-chart-2/10" },
                    ].map(s => (
                      <button key={s.label} onClick={() => setActiveTab(TABS.find(t => t.label.toLowerCase().replace(" ", "") === s.label.toLowerCase().replace(" ", ""))?.key || s.label.toLowerCase().replace("/", ""))} className="stat-card flex items-center gap-3 text-left hover:shadow-md transition-shadow">
                        <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
                        <div className="min-w-0"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
                      </button>
                    ))}
                  </div>

                  {/* Quick Book */}
                  <button onClick={() => { setShowBooking(true); }} className="w-full py-3 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Book an Appointment
                  </button>
                </div>
              )}

              {/* APPOINTMENTS */}
              {activeTab === "appointments" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-heading font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Appointments</h4>
                    <button onClick={() => setShowBooking(true)} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Book
                    </button>
                  </div>
                  {appointments.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No appointments yet.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {appointments.map(a => (
                        <div key={a.id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{a.appointment_date} at {a.appointment_time}</p>
                            <p className="text-xs text-muted-foreground capitalize">{a.type?.replace(/_/g, " ")} {a.department ? `• ${a.department}` : ""}</p>
                            {a.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{a.notes}</p>}
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] || "bg-muted text-muted-foreground"}`}>{a.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* VISITS */}
              {activeTab === "visits" && (
                <div>
                  <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Visit History</h4>
                  {visits.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No visits recorded yet.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {visits.map(v => {
                        const visitDiagnoses = diagnoses.filter(d => d.visit_id === v.id);
                        return (
                          <div key={v.id} className="py-3">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{new Date(v.visit_date || v.created_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary`}>{visitTypeLabel(v.visit_type)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground capitalize">Payment: {v.payment_type} • Status: {v.queue_status?.replace(/_/g, " ")}</p>
                            {visitDiagnoses.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {visitDiagnoses.map(d => (
                                  <span key={d.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">{d.diagnosis_name} ({d.type})</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* LAB RESULTS */}
              {activeTab === "labs" && (
                <div>
                  <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary" /> Lab Results</h4>
                  {labResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No lab results yet.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {labResults.map(r => (
                        <div key={r.id} className="py-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{r.test_name}</p>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.is_critical ? "bg-destructive/10 text-destructive" : "bg-chart-3/10 text-chart-3"}`}>{r.status}</span>
                          </div>
                          <p className="text-sm mt-1"><span className="font-semibold font-mono">{r.result_value}</span> {r.unit && <span className="text-muted-foreground">{r.unit}</span>}</p>
                          {r.reference_range && <p className="text-xs text-muted-foreground mt-0.5">Reference: {r.reference_range}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* MEDICATIONS */}
              {activeTab === "medications" && (
                <div>
                  <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><Pill className="w-4 h-4 text-primary" /> Prescriptions</h4>
                  {prescriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No prescriptions yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {prescriptions.map(pr => {
                        const items = prescriptionItems.filter(i => i.prescription_id === pr.id);
                        return (
                          <div key={pr.id} className="bg-muted/20 rounded-lg p-4 border border-border/40">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-muted-foreground">{new Date(pr.created_date).toLocaleDateString("en-GB")}</p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pr.status === "completed" ? "bg-chart-3/10 text-chart-3" : pr.status === "partial" ? "bg-chart-2/10 text-chart-2" : "bg-chart-4/10 text-chart-4"}`}>{pr.status}</span>
                            </div>
                            {items.length > 0 && (
                              <div className="space-y-1.5">
                                {items.map(item => (
                                  <div key={item.id} className="flex items-center justify-between text-sm bg-white/50 rounded px-3 py-2">
                                    <div>
                                      <span className="font-medium">{item.drug_name}</span>
                                      <span className="text-muted-foreground text-xs ml-2">{item.dosage} • {item.frequency} • {item.duration}</span>
                                    </div>
                                    <span className={`text-xs font-medium capitalize ${item.status === "dispensed" ? "text-chart-3" : item.status === "partial" ? "text-chart-2" : "text-muted-foreground"}`}>{item.status}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {pr.notes && <p className="text-xs text-muted-foreground mt-2 italic">{pr.notes}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* BILLING */}
              {activeTab === "billing" && (
                <div>
                  <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" /> Billing History</h4>
                  {invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No invoices yet.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {invoices.map(inv => (
                        <div key={inv.id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{inv.invoice_number}</p>
                            <p className="text-xs text-muted-foreground">{new Date(inv.created_date).toLocaleDateString("en-GB")} • {inv.payment_type}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm">MWK {inv.total_amount?.toLocaleString()}</p>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || "bg-muted text-muted-foreground"}`}>{inv.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* IMMUNIZATIONS */}
              {activeTab === "immunizations" && (
                <div>
                  <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><Syringe className="w-4 h-4 text-primary" /> Immunization Records</h4>
                  {immunizations.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No immunization records yet.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {immunizations.map(imm => (
                        <div key={imm.id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{imm.vaccine_name}</p>
                            <p className="text-xs text-muted-foreground">Dose #{imm.dose_number || 1} • {imm.site || imm.route || "N/A"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{imm.administered_date ? new Date(imm.administered_date).toLocaleDateString("en-GB") : "Pending"}</p>
                            {imm.next_due_date && <p className="text-xs text-primary font-medium">Next: {imm.next_due_date}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* MATERNAL */}
              {activeTab === "maternal" && (
                <div>
                  <h4 className="font-heading font-semibold mb-4 flex items-center gap-2"><Baby className="w-4 h-4 text-primary" /> ANC Visits</h4>
                  {maternalVisits.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No ANC records yet.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {maternalVisits.map(v => (
                        <div key={v.id} className="py-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">ANC #{v.anc_visit_number} — {new Date(v.visit_date).toLocaleDateString("en-GB")}</p>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.risk_level === "high" ? "bg-destructive/10 text-destructive" : "bg-chart-3/10 text-chart-3"}`}>{v.risk_level || "normal"} risk</span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{v.gestational_age_weeks} weeks</span>
                            <span>G{v.gravida}P{v.para}</span>
                            {v.edd && <span>EDD: {v.edd}</span>}
                            {v.delivery_outcome && <span>Outcome: {v.delivery_outcome}</span>}
                          </div>
                          {v.fundal_height && <p className="text-xs text-muted-foreground">FH: {v.fundal_height}cm</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowBooking(false)} />
          <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold">Book Appointment</h3>
              <button onClick={() => setShowBooking(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            {bookingResult && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${bookingResult.success ? "bg-chart-3/10 text-chart-3 border border-chart-3/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                {bookingResult.message}
              </div>
            )}

            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
                <input type="date" required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={bookingForm.appointment_date} onChange={e => setBookingForm({...bookingForm, appointment_date: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Time *</label>
                <input type="time" required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={bookingForm.appointment_time} onChange={e => setBookingForm({...bookingForm, appointment_time: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Type *</label>
                <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={bookingForm.type} onChange={e => setBookingForm({...bookingForm, type: e.target.value})}>
                  <option value="new">New</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="anc">ANC</option>
                  <option value="postnatal">Postnatal</option>
                  <option value="procedure">Procedure</option>
                  <option value="review">Review</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Department</label>
                <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={bookingForm.department} onChange={e => setBookingForm({...bookingForm, department: e.target.value})}>
                  <option value="">Any</option>
                  <option value="General">General</option>
                  <option value="ANC">ANC</option>
                  <option value="Paediatrics">Paediatrics</option>
                  <option value="Surgery">Surgery</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-20 resize-none" value={bookingForm.notes} onChange={e => setBookingForm({...bookingForm, notes: e.target.value})} placeholder="Reason for visit..." />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                  <Save className="w-3.5 h-3.5 inline mr-1" /> Book Appointment
                </button>
                <button type="button" onClick={() => setShowBooking(false)} className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}