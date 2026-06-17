import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  ClipboardList, Plus, CheckCircle, Circle, Clock, AlertTriangle,
  Trash2, Search, Filter, X, ChevronDown, User, Heart, Syringe,
  Droplets, Footprints, Bandage, Utensils, Monitor, BookOpen, FileText, MoreHorizontal
} from "lucide-react";

const CATEGORY_CONFIG = {
  vitals: { label: "Vitals", icon: Heart, color: "bg-chart-3/10 text-chart-3 border-chart-3/20" },
  medication: { label: "Medication", icon: Syringe, color: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
  hygiene: { label: "Hygiene", icon: Droplets, color: "bg-chart-1/10 text-chart-1 border-chart-1/20" },
  mobilization: { label: "Mobilize", icon: Footprints, color: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  wound_care: { label: "Wound Care", icon: Bandage, color: "bg-destructive/10 text-destructive border-destructive/20" },
  feeding: { label: "Feeding", icon: Utensils, color: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
  monitoring: { label: "Monitoring", icon: Monitor, color: "bg-chart-1/10 text-chart-1 border-chart-1/20" },
  education: { label: "Education", icon: BookOpen, color: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  documentation: { label: "Document", icon: FileText, color: "bg-muted text-muted-foreground" },
  other: { label: "Other", icon: MoreHorizontal, color: "bg-muted text-muted-foreground" },
};

const PRIORITY_COLORS = {
  routine: "border-l-chart-3",
  urgent: "border-l-chart-2",
  stat: "border-l-destructive",
};

export default function NurseTasklist() {
  const [tasks, setTasks] = useState([]);
  const [patients, setPatients] = useState([]);
  const [nursingPatients, setNursingPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | pending | completed
  const [filterCategory, setFilterCategory] = useState("all");

  const [form, setForm] = useState({
    title: "", patient_id: "", visit_id: "", category: "vitals",
    priority: "routine", due_date: "", notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [t, p, journeys] = await Promise.all([
        base44.entities.NurseTask.list("-created_date", 200),
        base44.entities.Patient.list("-created_date", 200),
        base44.entities.PatientJourney.filter(
          { current_stage: "NURSING_ADMINISTRATION", status: "active" }, "-created_date", 50
        ),
      ]);
      setTasks(t);
      setPatients(p);
      setNursingPatients(journeys);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getPatientName = (pid) => {
    if (!pid) return null;
    const p = patients.find(pt => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : pid?.slice(0, 8);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = { ...form, status: "pending" };
    if (payload.due_date) payload.due_date = new Date(payload.due_date).toISOString();
    if (!payload.due_date) delete payload.due_date;
    if (!payload.patient_id) { delete payload.patient_id; delete payload.visit_id; }
    await base44.entities.NurseTask.create(payload);
    setForm({ title: "", patient_id: "", visit_id: "", category: "vitals", priority: "routine", due_date: "", notes: "" });
    setShowForm(false);
    loadData();
  };

  const handleToggleStatus = async (task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    const updates = { status: newStatus };
    if (newStatus === "completed") updates.completed_date = new Date().toISOString();
    else updates.completed_date = null;
    await base44.entities.NurseTask.update(task.id, updates);
    setTasks(tasks.map(t => t.id === task.id ? { ...t, ...updates } : t));
  };

  const handleDelete = async (taskId) => {
    await base44.entities.NurseTask.delete(taskId);
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (filter === "pending") result = result.filter(t => t.status !== "completed" && t.status !== "cancelled");
    if (filter === "completed") result = result.filter(t => t.status === "completed");
    if (filterCategory !== "all") result = result.filter(t => t.category === filterCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        getPatientName(t.patient_id)?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, filter, filterCategory, search]);

  // Group by status
  const pendingTasks = filteredTasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const completedTasks = filteredTasks.filter(t => t.status === "completed");

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h4 className="font-heading font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" /> Nursing Task List
          </h4>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-destructive/10 text-destructive">
            {pendingTasks.length} pending
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-clinical-normal/10 text-clinical-normal">
            {completedTasks.length} done
          </span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90"
        >
          <Plus className="w-3.5 h-3.5" /> Add Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <select
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
        <select
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Pending ({pendingTasks.length})
          </p>
          <div className="space-y-1.5">
            {pendingTasks.map(task => {
              const cat = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.other;
              const CatIcon = cat.icon;
              const patientName = getPatientName(task.patient_id);
              const isOverdue = task.due_date && new Date(task.due_date) < new Date();
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-all ${PRIORITY_COLORS[task.priority] || ""} border-border/60`}
                >
                  <button
                    onClick={() => handleToggleStatus(task)}
                    className="flex-shrink-0 text-muted-foreground hover:text-clinical-normal transition-colors"
                  >
                    <Circle className="w-5 h-5" />
                  </button>
                  <div className={`p-1.5 rounded-lg ${cat.color} flex-shrink-0`}>
                    <CatIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${cat.color}`}>
                        {cat.label}
                      </span>
                      {patientName && (
                        <span className="flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5" /> {patientName}
                        </span>
                      )}
                      {task.assigned_to_name && (
                        <span className="text-muted-foreground/70">· {task.assigned_to_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.due_date && (
                      <span className={`text-[10px] font-medium flex items-center gap-1 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                        <Clock className="w-3 h-3" />
                        {new Date(task.due_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {task.priority !== "routine" && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        task.priority === "stat" ? "bg-destructive/10 text-destructive" : "bg-chart-2/10 text-chart-2"
                      }`}>{task.priority}</span>
                    )}
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3 text-clinical-normal" /> Completed ({completedTasks.length})
          </p>
          <div className="space-y-1.5">
            {completedTasks.slice(0, 15).map(task => {
              const cat = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.other;
              const CatIcon = cat.icon;
              return (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-muted/20">
                  <button
                    onClick={() => handleToggleStatus(task)}
                    className="flex-shrink-0 text-clinical-normal"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <div className={`p-1.5 rounded-lg opacity-60 ${cat.color} flex-shrink-0`}>
                    <CatIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-through text-muted-foreground">{task.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold">{cat.label}</span>
                      {getPatientName(task.patient_id) && (
                        <span className="flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5" /> {getPatientName(task.patient_id)}
                        </span>
                      )}
                      {task.completed_date && (
                        <span>· {new Date(task.completed_date).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filteredTasks.length === 0 && (
        <div className="py-12 text-center">
          <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {filter !== "all" || filterCategory !== "all" || search ? "No tasks match your filters." : "No tasks yet."}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Create tasks for vitals, medication administration, wound care, and more.
          </p>
        </div>
      )}

      {/* Create Task Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" /> New Nursing Task
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Task Title *</label>
                <input
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Check vitals for bed 3, Change wound dressing..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="stat">STAT</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Patient (optional)</label>
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={form.patient_id}
                  onChange={e => {
                    const pid = e.target.value;
                    const j = nursingPatients.find(j => j.patient_id === pid);
                    setForm({ ...form, patient_id: pid, visit_id: j?.visit_id || "" });
                  }}
                >
                  <option value="">None (general task)</option>
                  {nursingPatients.map(j => (
                    <option key={j.patient_id} value={j.patient_id}>
                      {getPatientName(j.patient_id)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date/Time</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none h-20"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional instructions..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                  <Plus className="w-3.5 h-3.5 inline mr-1" /> Create Task
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}