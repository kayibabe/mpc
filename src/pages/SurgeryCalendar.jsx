import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, User, AlertCircle, X, Search, CheckCircle, Calendar, ClipboardCheck, Activity, Package } from "lucide-react";
import moment from "moment";
import SurgicalChecklist from "@/components/SurgicalChecklist";
import AnesthesiaLog from "@/components/AnesthesiaLog";
import SurgicalRequisitionModal from "@/components/SurgicalRequisitionModal";
import BookingRequisitionStatus from "@/components/BookingRequisitionStatus";

const THEATER_LABELS = {
  theatre_1: "Theatre 1",
  theatre_2: "Theatre 2",
  minor_theatre: "Minor Theatre",
  maternity_theatre: "Maternity Theatre",
  emergency_theatre: "Emergency Theatre",
};

const THEATER_COLORS = {
  theatre_1: "border-l-chart-1 bg-chart-1/5",
  theatre_2: "border-l-chart-3 bg-chart-3/5",
  minor_theatre: "border-l-chart-4 bg-chart-4/5",
  maternity_theatre: "border-l-chart-5 bg-chart-5/5",
  emergency_theatre: "border-l-destructive bg-destructive/5",
};

const STATUS_COLORS = {
  scheduled: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  confirmed: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  in_progress: "bg-chart-2/10 text-chart-2 border-chart-2/20 animate-pulse",
  completed: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20 line-through",
  postponed: "bg-chart-2/10 text-chart-2 border-chart-2/20",
};

const PRIORITY_INDICATORS = {
  emergency: "bg-destructive text-destructive-foreground",
  urgent: "bg-chart-2 text-white",
  elective: "bg-muted text-muted-foreground",
};

export default function SurgeryCalendar() {
  const [date, setDate] = useState(moment());
  const [bookings, setBookings] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [form, setForm] = useState({
    patient_id: "", theater_room: "theatre_1", procedure_name: "",
    procedure_category: "general", scheduled_date: date.format("YYYY-MM-DD"),
    start_time: "08:00", end_time: "10:00", estimated_duration_minutes: 120,
    priority: "elective", anaesthesia_type: "general",
    preop_notes: "", surgeon_name: "", anaesthetist_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [activeModal, setActiveModal] = useState(null); // "checklist" | "anesthesia" | "requisition"
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dayStr = date.format("YYYY-MM-DD");
      const [b, p] = await Promise.all([
        base44.entities.SurgicalBooking.filter({ scheduled_date: dayStr }, "start_time", 100),
        base44.entities.Patient.list("", 300),
      ]);
      setBookings(b);
      setPatients(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getPatientName = (pid) => {
    const p = patients.find(pt => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const checkConflict = (theater, start, end, excludeId) => {
    return bookings.find(b =>
      b.theater_room === theater &&
      b.id !== excludeId &&
      b.status !== "cancelled" &&
      b.start_time < end &&
      b.end_time > start
    );
  };

  const handleTimeChange = (field, value) => {
    const newForm = { ...form, [field]: value };
    if (newForm.start_time && newForm.end_time) {
      const startMin = timeToMinutes(newForm.start_time);
      const endMin = timeToMinutes(newForm.end_time);
      if (endMin > startMin) {
        newForm.estimated_duration_minutes = endMin - startMin;
      }
    }
    setForm(newForm);
    if (field === "start_time" || field === "end_time" || field === "theater_room") {
      const c = checkConflict(newForm.theater_room, newForm.start_time, newForm.end_time);
      setConflict(c || null);
    }
  };

  const timeToMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const saveBooking = async (e) => {
    e.preventDefault();
    if (!form.patient_id || !form.procedure_name || !form.start_time || !form.end_time) return;
    const c = checkConflict(form.theater_room, form.start_time, form.end_time);
    if (c) {
      alert(`⚠️ Scheduling Conflict\n\n${getPatientName(c.patient_id)} — ${c.procedure_name} is already booked in ${THEATER_LABELS[c.theater_room]} at ${c.start_time}–${c.end_time}.`);
      return;
    }
    setSaving(true);
    try {
      const patient = patients.find(p => p.id === form.patient_id);
      await base44.entities.SurgicalBooking.create({
        ...form,
        patient_id: form.patient_id,
        scheduled_date: date.format("YYYY-MM-DD"),
        booked_by_name: "Surgery Desk",
        status: "scheduled",
      });
      setForm({
        patient_id: "", theater_room: "theatre_1", procedure_name: "",
        procedure_category: "general", scheduled_date: date.format("YYYY-MM-DD"),
        start_time: "08:00", end_time: "10:00", estimated_duration_minutes: 120,
        priority: "elective", anaesthesia_type: "general",
        preop_notes: "", surgeon_name: "", anaesthetist_name: "",
      });
      setPatientSearch("");
      setShowForm(false);
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to save booking: " + (e.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (booking, newStatus) => {
    await base44.entities.SurgicalBooking.update(booking.id, { status: newStatus });
    await loadData();
  };

  const filteredPatients = patientSearch
    ? patients.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.mrn?.toLowerCase().includes(patientSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  const theaterKeys = Object.keys(THEATER_LABELS);
  const theaterBookings = {};
  theaterKeys.forEach(k => { theaterBookings[k] = bookings.filter(b => b.theater_room === k && b.status !== "cancelled"); });

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Theatre Bookings</h2>
          <p className="text-sm text-muted-foreground mt-1">Surgical schedule — {date.format("dddd, D MMMM YYYY")}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setDate(moment()); loadData(); }} className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted">Today</button>
          <div className="flex items-center gap-1">
            <button onClick={() => setDate(date.clone().subtract(1, "day"))} className="p-1.5 rounded-lg hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
            <input type="date" className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={date.format("YYYY-MM-DD")} onChange={e => setDate(moment(e.target.value))} />
            <button onClick={() => setDate(date.clone().add(1, "day"))} className="p-1.5 rounded-lg hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm">
            <Plus className="w-4 h-4" /> Book Surgery
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : bookings.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/60 shadow-sm p-12 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">No surgical bookings for {date.format("D MMMM YYYY")}.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Book First Surgery
          </button>
        </div>
      ) : (
        /* Theater Calendar Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {theaterKeys.map(theater => {
            const list = theaterBookings[theater] || [];
            return (
              <div key={theater} className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
                <div className={`px-4 py-3 border-b border-border/40 font-heading text-sm font-bold ${THEATER_COLORS[theater] || ""}`}>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {THEATER_LABELS[theater]}
                  </div>
                  <span className="text-[10px] font-normal text-muted-foreground mt-0.5 block">{list.length} case{list.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
                  {list.length === 0 ? (
                    <div className="p-6 text-center">
                      <Clock className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">No bookings</p>
                    </div>
                  ) : (
                    list.map(b => (
                      <div key={b.id} className="p-3 hover:bg-muted/20 transition-colors group">
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{b.procedure_name}</p>
                            <p className="text-xs text-muted-foreground">{getPatientName(b.patient_id)}</p>
                          </div>
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITY_INDICATORS[b.priority] || PRIORITY_INDICATORS.elective}`}>
                            {b.priority?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Clock className="w-3 h-3" />
                          <span>{b.start_time} – {b.end_time}</span>
                          {b.estimated_duration_minutes && (
                            <span className="text-[10px]">({b.estimated_duration_minutes} min)</span>
                          )}
                        </div>
                        {(b.surgeon_name || b.anaesthetist_name) && (
                          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground mb-2">
                            {b.surgeon_name && <span className="flex items-center gap-1"><User className="w-2.5 h-2.5" />{b.surgeon_name}</span>}
                            {b.anaesthetist_name && <span className="flex items-center gap-1"><User className="w-2.5 h-2.5" />{b.anaesthetist_name}</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <BookingRequisitionStatus bookingId={b.id} onRequestClick={() => { setSelectedBooking(b); setActiveModal("requisition"); }} key={refreshTrigger} />
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${STATUS_COLORS[b.status] || ""}`}>
                            {b.status?.replace(/_/g, " ")}
                          </span>
                          {b.anaesthesia_type && (
                            <span className="text-[10px] text-muted-foreground">
                              {b.anaesthesia_type}
                            </span>
                          )}
                          <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setSelectedBooking(b); setActiveModal("requisition"); }} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium" title="Request Supplies">
                              <Package className="w-3 h-3" />
                            </button>
                            <button onClick={() => { setSelectedBooking(b); setActiveModal("checklist"); }} className="px-1.5 py-0.5 bg-chart-4/10 text-chart-4 rounded text-[10px] font-medium" title="WHO Checklist">
                              <ClipboardCheck className="w-3 h-3" />
                            </button>
                            <button onClick={() => { setSelectedBooking(b); setActiveModal("anesthesia"); }} className="px-1.5 py-0.5 bg-chart-5/10 text-chart-5 rounded text-[10px] font-medium" title="Anaesthesia Log">
                              <Activity className="w-3 h-3" />
                            </button>
                            {b.status === "scheduled" && (
                              <button onClick={() => updateStatus(b, "in_progress")} className="px-1.5 py-0.5 bg-chart-2/10 text-chart-2 rounded text-[10px] font-medium" title="Start">
                                <CheckCircle className="w-3 h-3" />
                              </button>
                            )}
                            {b.status === "in_progress" && (
                              <button onClick={() => updateStatus(b, "completed")} className="px-1.5 py-0.5 bg-chart-3/10 text-chart-3 rounded text-[10px] font-medium" title="Complete">
                                <CheckCircle className="w-3 h-3" />
                              </button>
                            )}
                            {b.status !== "cancelled" && b.status !== "completed" && (
                              <button onClick={() => updateStatus(b, "cancelled")} className="px-1.5 py-0.5 bg-destructive/10 text-destructive rounded text-[10px] font-medium" title="Cancel">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Requisition Modal */}
      {activeModal === "requisition" && selectedBooking && (
        <SurgicalRequisitionModal
          booking={selectedBooking}
          onClose={() => { setActiveModal(null); setSelectedBooking(null); }}
          onSuccess={() => { setRefreshTrigger(prev => prev + 1); }}
        />
      )}

      {/* Checklist Modal */}
      {activeModal === "checklist" && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setActiveModal(null); setSelectedBooking(null); }} />
          <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold">WHO Surgical Safety Checklist</h3>
              <button onClick={() => { setActiveModal(null); setSelectedBooking(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {getPatientName(selectedBooking.patient_id)} — {selectedBooking.procedure_name} ({THEATER_LABELS[selectedBooking.theater_room]})
            </p>
            <SurgicalChecklist
              bookingId={selectedBooking.id}
              patientId={selectedBooking.patient_id}
              patientName={getPatientName(selectedBooking.patient_id)}
              onComplete={() => { setActiveModal(null); setSelectedBooking(null); }}
            />
          </div>
        </div>
      )}

      {/* Anesthesia Log Modal */}
      {activeModal === "anesthesia" && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setActiveModal(null); setSelectedBooking(null); }} />
          <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold">Anaesthesia Log</h3>
              <button onClick={() => { setActiveModal(null); setSelectedBooking(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {getPatientName(selectedBooking.patient_id)} — {selectedBooking.procedure_name}
            </p>
            <AnesthesiaLog
              bookingId={selectedBooking.id}
              patientId={selectedBooking.patient_id}
              booking={selectedBooking}
              onComplete={() => { setActiveModal(null); setSelectedBooking(null); }}
            />
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowForm(false); setConflict(null); }} />
          <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-xl mx-4 max-h-[85vh] overflow-y-auto">
            <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Book Surgery — {date.format("D MMMM YYYY")}
            </h3>
            <form onSubmit={saveBooking} className="space-y-4">
              {/* Patient Search */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Patient *</label>
                {form.patient_id ? (
                  <div className="flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                    <span className="text-sm font-medium flex-1">{getPatientName(form.patient_id)}</span>
                    <button type="button" onClick={() => { setForm({...form, patient_id: ""}); setPatientSearch(""); }} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Search patient by name or MRN..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} autoFocus />
                    </div>
                    {filteredPatients.length > 0 && (
                      <div className="mt-1 border border-border rounded-lg bg-card shadow-sm max-h-[180px] overflow-y-auto">
                        {filteredPatients.map(p => (
                          <button key={p.id} type="button" onClick={() => { setForm({...form, patient_id: p.id}); setPatientSearch(""); }} className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm border-b border-border/40 last:border-b-0">
                            {p.first_name} {p.last_name}
                            {p.mrn && <span className="text-xs text-muted-foreground ml-2">MRN: {p.mrn}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Theatre *</label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.theater_room} onChange={e => handleTimeChange("theater_room", e.target.value)}>
                    {Object.entries(THEATER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                    <option value="elective">Elective</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Procedure *</label>
                <input required className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.procedure_name} onChange={e => setForm({...form, procedure_name: e.target.value})} placeholder="e.g. Appendectomy" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.procedure_category} onChange={e => setForm({...form, procedure_category: e.target.value})}>
                    <option value="general">General</option><option value="orthopaedic">Orthopaedic</option>
                    <option value="obstetric">Obstetric</option><option value="gynaecology">Gynaecology</option>
                    <option value="urology">Urology</option><option value="ent">ENT</option>
                    <option value="ophthalmology">Ophthalmology</option><option value="paediatric">Paediatric</option>
                    <option value="emergency">Emergency</option><option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Anaesthesia</label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.anaesthesia_type} onChange={e => setForm({...form, anaesthesia_type: e.target.value})}>
                    <option value="general">General</option><option value="spinal">Spinal</option>
                    <option value="epidural">Epidural</option><option value="regional">Regional Block</option>
                    <option value="local">Local</option><option value="sedation">Sedation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Start Time *</label>
                  <input type="time" required className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.start_time} onChange={e => handleTimeChange("start_time", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">End Time *</label>
                  <input type="time" required className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.end_time} onChange={e => handleTimeChange("end_time", e.target.value)} />
                </div>
              </div>
              {form.estimated_duration_minutes > 0 && (
                <p className="text-[10px] text-muted-foreground">Estimated duration: {Math.floor(form.estimated_duration_minutes / 60)}h {form.estimated_duration_minutes % 60}m</p>
              )}

              {/* Conflict Warning */}
              {conflict && (
                <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-destructive">Scheduling Conflict</p>
                    <p className="text-xs text-muted-foreground">
                      {getPatientName(conflict.patient_id)} — {conflict.procedure_name} ({conflict.start_time}–{conflict.end_time})
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Surgeon</label>
                  <input className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.surgeon_name} onChange={e => setForm({...form, surgeon_name: e.target.value})} placeholder="Surgeon name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Anaesthetist</label>
                  <input className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.anaesthetist_name} onChange={e => setForm({...form, anaesthetist_name: e.target.value})} placeholder="Anaesthetist name" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Pre-op Notes</label>
                <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} value={form.preop_notes} onChange={e => setForm({...form, preop_notes: e.target.value})} placeholder="Special instructions, allergies, lab results..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving || !!conflict} className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 shadow-sm">
                  {saving ? "Booking..." : conflict ? "Resolve Conflict First" : "Book Surgery"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setConflict(null); }} className="px-4 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}