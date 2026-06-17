import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  ClipboardCheck, AlertTriangle, Clock, Heart, Thermometer, Activity,
  Users, ArrowRight, ChevronDown, ChevronUp, Filter, RefreshCw, CheckCircle
} from "lucide-react";

const PRIORITY_CONFIG = {
  emergency: { label: "Emergency", color: "bg-triage-emergency", text: "text-triage-emergency", bg: "bg-triage-emergency/10", border: "border-triage-emergency" },
  urgent: { label: "Urgent", color: "bg-triage-urgent", text: "text-triage-urgent", bg: "bg-triage-urgent/10", border: "border-triage-urgent" },
  normal: { label: "Routine", color: "bg-triage-routine", text: "text-triage-routine", bg: "bg-triage-routine/10", border: "border-triage-routine" },
};

export default function TriageSummary() {
  const [patients, setPatients] = useState([]);
  const [vitalsMap, setVitalsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [bulkPriority, setBulkPriority] = useState("normal");
  const [triaging, setTriaging] = useState(false);

  const load = async () => {
    try {
      const [visits, patientsData, vitals] = await Promise.all([
        base44.entities.Visit.filter(
          { queue_status: { $in: ["waiting", "triaged"] } },
          "created_date",
          100
        ),
        base44.entities.Patient.list("", 300),
        base44.entities.VitalSigns.list("-created_date", 300),
      ]);

      const patientMap = {};
      patientsData.forEach(p => { patientMap[p.id] = p; });

      const latestVitals = {};
      vitals.forEach(v => {
        if (!latestVitals[v.visit_id] || new Date(v.created_date) > new Date(latestVitals[v.visit_id].created_date)) {
          latestVitals[v.visit_id] = v;
        }
      });
      setVitalsMap(latestVitals);

      const mapped = visits.map(v => {
        const p = patientMap[v.patient_id];
        return {
          id: v.id,
          patientId: v.patient_id,
          name: p ? `${p.first_name} ${p.last_name}` : v.patient_id?.slice(0, 8) || "Unknown",
          mrn: p?.mrn || "",
          age: p?.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth)) / 31557600000) : null,
          gender: p?.gender || "",
          priority: v.priority || "normal",
          status: v.queue_status,
          waitMinutes: Math.round((Date.now() - new Date(v.created_date).getTime()) / 60000),
          paymentType: v.payment_type,
          visitType: v.visit_type,
        };
      }).sort((a, b) => {
        const prio = { emergency: 0, urgent: 1, normal: 2 };
        const diff = (prio[a.priority] ?? 2) - (prio[b.priority] ?? 2);
        if (diff !== 0) return diff;
        return a.waitMinutes - b.waitMinutes;
      });

      setPatients(mapped);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.Visit.subscribe((event) => {
      if (event.type === "create" || event.type === "update") {
        load();
      }
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const filtered = priorityFilter === "all"
    ? patients
    : patients.filter(p => p.priority === priorityFilter);

  const stats = {
    total: patients.length,
    emergency: patients.filter(p => p.priority === "emergency").length,
    urgent: patients.filter(p => p.priority === "urgent").length,
    normal: patients.filter(p => p.priority === "normal").length,
    avgWait: patients.length > 0 ? Math.round(patients.reduce((s, p) => s + p.waitMinutes, 0) / patients.length) : 0,
    triaged: patients.filter(p => p.status === "triaged").length,
    waiting: patients.filter(p => p.status === "waiting").length,
  };

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selected.length === filtered.length) setSelected([]);
    else setSelected(filtered.map(p => p.id));
  };

  const handleBulkTriage = async () => {
    if (selected.length === 0) return;
    setTriaging(true);
    try {
      const { data } = await base44.functions.invoke("bulkTriage", {
        journey_ids: selected,
        priority: bulkPriority,
        notes: `Bulk triaged as ${bulkPriority} from Triage Summary`,
      });
      if (data.success) {
        setSelected([]);
        load();
      }
    } catch (e) {
      alert("Bulk triage failed: " + (e.response?.data?.error || e.message));
    } finally {
      setTriaging(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Triage Summary</h2>
          <p className="text-sm text-muted-foreground mt-1">Real-time overview of waiting patients</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="stat-card text-center">
          <p className="text-3xl font-bold font-mono">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Waiting</p>
        </div>
        <div className="stat-card text-center border-l-[3px] border-l-triage-emergency">
          <p className="text-3xl font-bold text-triage-emergency font-mono">{stats.emergency}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-triage-emergency" /> Emergency
          </p>
        </div>
        <div className="stat-card text-center border-l-[3px] border-l-triage-urgent">
          <p className="text-3xl font-bold text-triage-urgent font-mono">{stats.urgent}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-triage-urgent" /> Urgent
          </p>
        </div>
        <div className="stat-card text-center border-l-[3px] border-l-triage-routine">
          <p className="text-3xl font-bold text-triage-routine font-mono">{stats.normal}</p>
          <p className="text-xs text-muted-foreground mt-1">Routine</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold font-mono">{stats.avgWait}</p>
          <p className="text-xs text-muted-foreground mt-1">Avg Wait (min)</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold font-mono">{stats.triaged}</p>
          <p className="text-xs text-muted-foreground mt-1">Already Triaged</p>
        </div>
      </div>

      {/* Filters + Bulk Actions */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg p-1">
          {[{ key: "all", label: "All" }, { key: "emergency", label: "Emergency" }, { key: "urgent", label: "Urgent" }, { key: "normal", label: "Routine" }].map(f => (
            <button
              key={f.key}
              onClick={() => setPriorityFilter(f.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                priorityFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {selected.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">{selected.length} selected</span>
            <select
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={bulkPriority}
              onChange={e => setBulkPriority(e.target.value)}
            >
              <option value="emergency">Emergency</option>
              <option value="urgent">Urgent</option>
              <option value="normal">Routine</option>
            </select>
            <button
              onClick={handleBulkTriage}
              disabled={triaging}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {triaging ? "Triaging..." : "Bulk Triage"}
            </button>
          </div>
        )}
      </div>

      {/* Patient List */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No patients matching filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4">
                    <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">#</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Patient</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">MRN</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Age/Gender</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Priority</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Wait</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Vitals</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((p, idx) => {
                  const conf = PRIORITY_CONFIG[p.priority] || PRIORITY_CONFIG.normal;
                  const vitals = vitalsMap[p.id];
                  const isSelected = selected.includes(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-muted/30 transition-colors border-l-[3px] ${
                        isSelected ? "bg-primary/5 border-l-primary" : conf.border
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(p.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{p.visitType?.replace(/_/g, " ")}</p>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{p.mrn || "—"}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">
                        {p.age !== null ? `${p.age}y` : "—"} / {p.gender?.charAt(0)?.toUpperCase() || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${conf.text} ${conf.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${conf.color}`} />
                          {conf.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          p.status === "triaged" ? "bg-chart-3/10 text-chart-3" : "bg-muted text-muted-foreground"
                        }`}>
                          {p.status === "triaged" ? "Triaged" : "Waiting"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`font-mono text-xs font-medium ${
                          p.waitMinutes > 60 ? "text-triage-urgent" :
                          p.waitMinutes > 30 ? "text-chart-2" : "text-muted-foreground"
                        }`}>
                          {p.waitMinutes < 60
                            ? `${p.waitMinutes}m`
                            : `${Math.floor(p.waitMinutes / 60)}h ${p.waitMinutes % 60}m`
                          }
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {vitals ? (
                          <div className="flex items-center gap-2 text-[11px]">
                            {vitals.heart_rate && (
                              <span className={`flex items-center gap-0.5 ${vitals.heart_rate > 100 ? "text-triage-urgent font-semibold" : "text-muted-foreground"}`}>
                                <Heart className="w-3 h-3" /> {vitals.heart_rate}
                              </span>
                            )}
                            {vitals.temperature && (
                              <span className={`flex items-center gap-0.5 ${vitals.temperature > 38 ? "text-triage-urgent font-semibold" : "text-muted-foreground"}`}>
                                <Thermometer className="w-3 h-3" /> {vitals.temperature}°
                              </span>
                            )}
                            {vitals.spo2 && (
                              <span className={`flex items-center gap-0.5 ${vitals.spo2 < 95 ? "text-triage-emergency font-semibold" : "text-muted-foreground"}`}>
                                <Activity className="w-3 h-3" /> {vitals.spo2}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[10px] capitalize text-muted-foreground">{p.paymentType}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}