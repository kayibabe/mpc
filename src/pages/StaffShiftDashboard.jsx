import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  Users, Clock, CheckCircle, Calendar, RefreshCw
} from "lucide-react";
import ShiftHandoffNotes from "@/components/ShiftHandoffNotes";
import PageHeader from "@/components/ui/PageHeader";

const SHIFT_TIMES = {
  morning: { start: "06:00", end: "14:00", label: "Morning" },
  afternoon: { start: "14:00", end: "22:00", label: "Afternoon" },
  night: { start: "22:00", end: "06:00", label: "Night" },
  weekend: { start: "08:00", end: "16:00", label: "Weekend" },
  on_call: { start: "00:00", end: "23:59", label: "On-Call" },
};

const DEPARTMENTS = ["clinical", "lab", "imaging", "pharmacy", "nursing", "inpatient", "theatre", "emergency"];
const DEPT_LABELS = {
  clinical: "Clinical", lab: "Lab", imaging: "Imaging", pharmacy: "Pharmacy",
  nursing: "Nursing", inpatient: "Inpatient", theatre: "Theatre", emergency: "Emergency"
};

export default function StaffShiftDashboard() {
  const [schedules, setSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterDept, setFilterDept] = useState("all");
  const [searchDr, setSearchDr] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [scheduleData, userData] = await Promise.all([
        base44.entities.DoctorSchedule.list("-schedule_date", 500),
        base44.entities.User.list("", 100),
      ]);
      setSchedules(scheduleData);
      setUsers(userData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Get today's and upcoming shifts
  const todayShifts = useMemo(() => {
    return schedules
      .filter(s => s.schedule_date === selectedDate && s.status !== "cancelled")
      .filter(s => filterDept === "all" || s.department === filterDept)
      .filter(s => searchDr === "" || (s.doctor_name || "").toLowerCase().includes(searchDr.toLowerCase()))
      .sort((a, b) => {
        const deptOrder = { clinical: 0, lab: 1, imaging: 2, pharmacy: 3, nursing: 4, inpatient: 5, theatre: 6, emergency: 7 };
        return (deptOrder[a.department] ?? 99) - (deptOrder[b.department] ?? 99);
      });
  }, [schedules, selectedDate, filterDept, searchDr]);

  const groupedByDept = useMemo(() => {
    const grouped = {};
    todayShifts.forEach(shift => {
      if (!grouped[shift.department]) grouped[shift.department] = [];
      grouped[shift.department].push(shift);
    });
    return grouped;
  }, [todayShifts]);

  const currentShifts = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    return todayShifts.filter(s => {
      const start = s.shift_start_time || "06:00";
      const end = s.shift_end_time || "14:00";
      // Simple time comparison
      return currentTime >= start && currentTime <= end;
    });
  }, [todayShifts]);

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const dateObj = new Date(selectedDate);
  const dayLabel = dateObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="page-container">
      <PageHeader title="Staff Shift Dashboard" subtitle="Real-time staff coverage & handoff tracking" icon={Users} className="mb-6">
        <button onClick={loadData} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </PageHeader>

      {/* Date & Filters */}
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm font-medium ml-2">{dayLabel}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="text"
            placeholder="Search doctor..."
            value={searchDr}
            onChange={e => setSearchDr(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs w-40"
          />
          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
          >
            <option value="all">All Depts</option>
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{DEPT_LABELS[d]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Currently On Duty */}
      {currentShifts.length > 0 && (
        <div className="bg-gradient-to-r from-primary/5 to-primary/2 border border-primary/20 rounded-xl p-5 shadow-sm mb-6">
          <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" /> Currently On Duty ({currentShifts.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentShifts.map(s => (
              <div key={s.id} className="bg-white/50 rounded-lg p-3 border border-primary/20">
                <p className="text-sm font-semibold">{s.doctor_name}</p>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium text-xs">{DEPT_LABELS[s.department]}</span>
                  <Clock className="w-3 h-3" />
                  <span>{s.shift_start_time}–{s.shift_end_time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Shifts by Department */}
      <div className="space-y-5 mb-6">
        {Object.keys(groupedByDept)
          .sort((a, b) => (DEPARTMENTS.indexOf(a) ?? 99) - (DEPARTMENTS.indexOf(b) ?? 99))
          .map(dept => (
            <div key={dept} className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
              <div className="bg-muted/40 px-4 py-3 border-b border-border">
                <h4 className="font-semibold text-sm">{DEPT_LABELS[dept]} ({groupedByDept[dept].length} staff)</h4>
              </div>
              <div className="divide-y divide-border/40">
                {groupedByDept[dept].map(shift => {
                  const isCurrentShift = currentShifts.some(s => s.id === shift.id);
                  return (
                    <div
                      key={shift.id}
                      className={`flex items-center justify-between p-4 hover:bg-muted/20 transition-colors ${
                        isCurrentShift ? "bg-primary/5 border-l-[4px] border-l-primary" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{shift.doctor_name}</p>
                          {shift.specialty && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {shift.specialty}
                            </span>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            shift.shift_type === "on_call" ? "bg-destructive/10 text-destructive" : "bg-chart-1/10 text-chart-1"
                          }`}>
                            {SHIFT_TIMES[shift.shift_type].label} ({shift.shift_start_time}–{shift.shift_end_time})
                          </span>
                          {isCurrentShift && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" /> Active
                            </span>
                          )}
                        </div>
                        {shift.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic">{shift.notes}</p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-4 ${
                          shift.status === "scheduled" ? "bg-chart-4/10 text-chart-4" :
                          shift.status === "confirmed" ? "bg-chart-3/10 text-chart-3" :
                          shift.status === "swapped" ? "bg-chart-2/10 text-chart-2" :
                          "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {shift.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      {/* No shifts message */}
      {todayShifts.length === 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-12 shadow-sm text-center">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No shifts scheduled for {dayLabel}.</p>
        </div>
      )}

      {/* Handoff Notes */}
      <div className="mt-8">
        <ShiftHandoffNotes />
      </div>
    </div>
  );
}