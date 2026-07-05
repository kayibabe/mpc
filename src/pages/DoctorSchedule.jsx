import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  Calendar, Plus, Edit2, X,
  ChevronLeft, ChevronRight, Save, Trash2
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import PageHeader from "@/components/ui/PageHeader";

const SHIFT_TIMES = {
  morning: { start: "06:00", end: "14:00", label: "Morning (6am–2pm)" },
  afternoon: { start: "14:00", end: "22:00", label: "Afternoon (2pm–10pm)" },
  night: { start: "22:00", end: "06:00", label: "Night (10pm–6am)" },
  weekend: { start: "08:00", end: "16:00", label: "Weekend (8am–4pm)" },
  on_call: { start: "00:00", end: "23:59", label: "On-Call (24h)" },
};

const DEPARTMENTS = ["reception", "clinical", "lab", "imaging", "pharmacy", "nursing", "inpatient", "maternal", "theatre", "emergency"];
const DEPARTMENT_LABELS = {
  reception: "Reception", clinical: "Clinical", lab: "Laboratory", imaging: "Imaging",
  pharmacy: "Pharmacy", nursing: "Nursing", inpatient: "Inpatient", maternal: "Maternal",
  theatre: "Theatre", emergency: "Emergency"
};

export default function DoctorSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("week"); // week, month, list
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [searchDoctor, setSearchDoctor] = useState("");

  const [form, setForm] = useState({
    doctor_id: "", doctor_name: "", schedule_date: "", shift_type: "morning",
    department: "clinical", ward_id: "", ward_name: "", specialty: "", notes: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [scheduleData, doctorData, wardData] = await Promise.all([
        base44.entities.DoctorSchedule.list("-schedule_date", 500),
        base44.entities.User.list("", 100),
        base44.entities.Ward.list("", 50),
      ]);
      setSchedules(scheduleData);
      setDoctors(doctorData);
      setWards(wardData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.doctor_id || !form.schedule_date || !form.shift_type) {
      toast({ title: "Required fields missing", description: "Doctor, date, and shift type are required.", variant: "destructive" });
      return;
    }

    try {
      if (editingId) {
        await base44.entities.DoctorSchedule.update(editingId, {
          ...form,
          shift_start_time: SHIFT_TIMES[form.shift_type].start,
          shift_end_time: SHIFT_TIMES[form.shift_type].end,
        });
      } else {
        await base44.entities.DoctorSchedule.create({
          ...form,
          shift_start_time: SHIFT_TIMES[form.shift_type].start,
          shift_end_time: SHIFT_TIMES[form.shift_type].end,
          status: "scheduled",
        });
      }
      loadData();
      setShowForm(false);
      setEditingId(null);
      setForm({ doctor_id: "", doctor_name: "", schedule_date: "", shift_type: "morning", department: "clinical", ward_id: "", ward_name: "", specialty: "", notes: "" });
    } catch (e) {
      toast({ title: "Save failed", description: e.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const handleEdit = (schedule) => {
    setEditingId(schedule.id);
    setForm(schedule);
    setShowForm(true);
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const handleDelete = (id) => setDeleteConfirmId(id);

  const doDelete = async () => {
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await base44.entities.DoctorSchedule.delete(id);
      loadData();
    } catch (e) {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const weekStart = new Date(currentDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const dateMatch = view === "week"
        ? weekDays.some(d => d.toISOString().slice(0, 10) === s.schedule_date)
        : view === "month"
        ? new Date(s.schedule_date).getMonth() === currentDate.getMonth() && new Date(s.schedule_date).getFullYear() === currentDate.getFullYear()
        : true;
      const deptMatch = filterDepartment === "all" || s.department === filterDepartment;
      const doctorMatch = searchDoctor === "" || (s.doctor_name || "").toLowerCase().includes(searchDoctor.toLowerCase());
      return dateMatch && deptMatch && doctorMatch;
    });
  }, [schedules, view, currentDate, weekStart, filterDepartment, searchDoctor]);

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Group by date and department for week/month view
  const schedulesByDateDept = {};
  filteredSchedules.forEach(s => {
    const key = `${s.schedule_date}|${s.department}`;
    if (!schedulesByDateDept[key]) schedulesByDateDept[key] = [];
    schedulesByDateDept[key].push(s);
  });

  // For list view: group by date
  const schedulesByDate = {};
  filteredSchedules.forEach(s => {
    if (!schedulesByDate[s.schedule_date]) schedulesByDate[s.schedule_date] = [];
    schedulesByDate[s.schedule_date].push(s);
  });

  return (
    <div className="page-container">
      <PageHeader title="Doctor Schedule" subtitle="Clinical shifts & ward rotations" icon={Calendar} className="mb-6">
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ doctor_id: "", doctor_name: "", schedule_date: "", shift_type: "morning", department: "clinical", ward_id: "", ward_name: "", specialty: "", notes: "" }); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add Schedule
        </button>
      </PageHeader>

      {/* Controls */}
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 border-r border-border pr-4">
          {["week", "month", "list"].map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - (view === "week" ? 7 : 30)); setCurrentDate(d); }} className="p-1 rounded hover:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {view === "week" ? `${weekStart.toLocaleDateString("en-GB")} – ${new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("en-GB")}` : currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + (view === "week" ? 7 : 30)); setCurrentDate(d); }} className="p-1 rounded hover:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="text"
            placeholder="Search doctor..."
            value={searchDoctor}
            onChange={e => setSearchDoctor(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs w-40"
          />
          <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs">
            <option value="all">All Departments</option>
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Week View */}
      {view === "week" && (
        <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground min-w-[140px]">Department</th>
                  {weekDays.map((d, i) => (
                    <th key={i} className="text-center py-3 px-2 font-semibold text-muted-foreground">
                      <div className="text-[10px] uppercase">{d.toLocaleDateString("en-GB", { weekday: "short" })}</div>
                      <div className="text-xs font-bold">{d.getDate()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEPARTMENTS.map(dept => (
                  <tr key={dept} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-3 px-4 font-medium text-sm">{DEPARTMENT_LABELS[dept]}</td>
                    {weekDays.map((d, i) => {
                      const dateStr = d.toISOString().slice(0, 10);
                      const daySchedules = schedulesByDateDept[`${dateStr}|${dept}`] || [];
                      return (
                        <td key={i} className="border-l border-border/30 px-2 py-3 text-center">
                          {daySchedules.length > 0 ? (
                            <div className="space-y-1">
                              {daySchedules.map(s => (
                                <div
                                  key={s.id}
                                  className="text-[10px] p-1.5 rounded-lg bg-primary/10 text-primary font-medium cursor-pointer hover:bg-primary/20 group relative"
                                  onClick={() => handleEdit(s)}
                                >
                                  <div className="truncate">{s.doctor_name}</div>
                                  <div className="text-[9px] text-muted-foreground">{s.shift_type}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Month View */}
      {view === "month" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {DEPARTMENTS.map(dept => {
            const deptSchedules = filteredSchedules.filter(s => s.department === dept);
            return (
              <div key={dept} className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden p-4">
                <h3 className="font-semibold text-sm mb-3">{DEPARTMENT_LABELS[dept]}</h3>
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {deptSchedules.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No schedules this month</p>
                  ) : (
                    deptSchedules.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border border-border/40 hover:bg-muted/30 cursor-pointer group" onClick={() => handleEdit(s)}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium">{s.doctor_name}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(s.schedule_date).toLocaleDateString("en-GB")} • {s.shift_type}</p>
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          s.status === "scheduled" ? "bg-primary/10 text-primary" :
                          s.status === "confirmed" ? "bg-chart-3/10 text-chart-3" :
                          s.status === "swapped" ? "bg-chart-2/10 text-chart-2" :
                          s.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-muted"
                        }`}>{s.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
          {Object.keys(schedulesByDate)
            .sort()
            .map(dateStr => (
              <div key={dateStr}>
                <div className="bg-muted/40 px-4 py-2.5 border-b border-border sticky top-0 z-10">
                  <p className="font-semibold text-sm">{new Date(dateStr).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                <div className="divide-y divide-border/40">
                  {schedulesByDate[dateStr].map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-sm font-semibold">{s.doctor_name}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{s.shift_type}</span>
                          <span className="text-[10px] text-muted-foreground">{SHIFT_TIMES[s.shift_type].label}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-chart-1/10 text-chart-1 font-medium">{DEPARTMENT_LABELS[s.department]}</span>
                          {s.ward_name && <span className="text-[10px] text-muted-foreground">({s.ward_name})</span>}
                        </div>
                        {s.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">{s.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          s.status === "scheduled" ? "bg-primary/10 text-primary" :
                          s.status === "confirmed" ? "bg-chart-3/10 text-chart-3" :
                          s.status === "swapped" ? "bg-chart-2/10 text-chart-2" :
                          s.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-muted"
                        }`}>{s.status}</span>
                        <button onClick={() => handleEdit(s)} className="p-1.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          {filteredSchedules.length === 0 && (
            <div className="py-12 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No schedules found.</p>
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> {editingId ? "Edit" : "Add"} Schedule
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-medium">Doctor *</label>
                <select
                  required
                  value={form.doctor_id}
                  onChange={e => {
                    const doc = doctors.find(d => d.id === e.target.value);
                    setForm({ ...form, doctor_id: e.target.value, doctor_name: doc ? doc.full_name : "" });
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select doctor</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-medium">Schedule Date *</label>
                <input
                  type="date"
                  required
                  value={form.schedule_date}
                  onChange={e => setForm({ ...form, schedule_date: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 font-medium">Shift Type *</label>
                  <select
                    required
                    value={form.shift_type}
                    onChange={e => setForm({ ...form, shift_type: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {Object.entries(SHIFT_TIMES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 font-medium">Department *</label>
                  <select
                    required
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 font-medium">Ward</label>
                  <select
                    value={form.ward_id}
                    onChange={e => {
                      const ward = wards.find(w => w.id === e.target.value);
                      setForm({ ...form, ward_id: e.target.value, ward_name: ward ? ward.name : "" });
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">No specific ward</option>
                    {wards.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 font-medium">Specialty</label>
                  <input
                    type="text"
                    value={form.specialty}
                    onChange={e => setForm({ ...form, specialty: e.target.value })}
                    placeholder="e.g. Surgery"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-medium">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Special instructions or swap notes"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm"
                >
                  <Save className="w-4 h-4" /> {editingId ? "Update" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the schedule entry. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive hover:bg-destructive/90 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}