import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, GitBranch } from "lucide-react";
import moment from "moment";
import ShiftCalendar from "@/components/ShiftCalendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(moment());
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [apps, pats] = await Promise.all([
          base44.entities.Appointment.list("-appointment_date", 500),
          base44.entities.Patient.list("", 300),
        ]);
        setAppointments(apps);
        setPatients(pats);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const getPatientName = (pid) => {
    const p = patients.find((pt) => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const startOfMonth = currentDate.clone().startOf("month");
  const endOfMonth = currentDate.clone().endOf("month");
  const startDay = startOfMonth.day();
  const daysInMonth = endOfMonth.date();

  // Build calendar grid
  const cells = [];
  // Empty cells before month start
  for (let i = 0; i < startDay; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(startOfMonth.clone().date(d));
  }

  const getAppointmentsForDay = (day) => {
    if (!day) return [];
    const dayStr = day.format("YYYY-MM-DD");
    return appointments.filter((a) => a.appointment_date === dayStr);
  };

  const prevMonth = () => setCurrentDate(currentDate.clone().subtract(1, "month"));
  const nextMonth = () => setCurrentDate(currentDate.clone().add(1, "month"));

  const statusColors = {
    scheduled: "bg-chart-1/15 text-chart-1 border-chart-1/30",
    checked_in: "bg-chart-2/15 text-chart-2 border-chart-2/30",
    in_progress: "bg-chart-4/15 text-chart-4 border-chart-4/30",
    completed: "bg-chart-3/15 text-chart-3 border-chart-3/30",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
    no_show: "bg-muted text-muted-foreground border-border",
  };

  const typeLabels = {
    new: "New",
    follow_up: "Follow-up",
    anc: "ANC",
    postnatal: "PNC",
    procedure: "Procedure",
    surgery: "Surgery",
    emergency: "ER",
    review: "Review",
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
          <h2 className="section-title">Calendar</h2>
          <p className="text-sm text-muted-foreground mt-1">All clinic appointments synced across departments</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-heading text-lg font-semibold min-w-[160px] text-center">
            {currentDate.format("MMMM YYYY")}
          </h3>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border border-border rounded-xl overflow-hidden">
        {cells.map((day, idx) => {
          const isToday = day && day.isSame(moment(), "day");
          const dayApps = getAppointmentsForDay(day);

          return (
            <div
              key={idx}
              className={`min-h-[100px] p-1.5 border-b border-r border-border/50 ${
                !day ? "bg-muted/20" : "bg-card"
              } ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
            >
              {day && (
                <>
                  <div
                    className={`text-xs font-medium mb-1 w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {day.date()}
                  </div>
                  <div className="space-y-0.5 max-h-[80px] overflow-y-auto">
                    {dayApps.slice(0, 3).map((app) => (
                      <div
                        key={app.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColors[app.status] || statusColors.scheduled} truncate`}
                        title={`${getPatientName(app.patient_id)} - ${typeLabels[app.type] || app.type} (${app.appointment_time})`}
                      >
                        {app.appointment_time?.slice(0, 5)} {getPatientName(app.patient_id)}
                      </div>
                    ))}
                    {dayApps.length > 3 && (
                      <p className="text-[10px] text-muted-foreground px-1">+{dayApps.length - 3} more</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Shift Calendar */}
      <div className="mt-8">
        <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-primary" /> Shift Calendar
        </h3>
        <ShiftCalendar />
      </div>

      {/* Upcoming appointments list */}
      <div className="mt-8">
        <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary" /> Today's Appointments
        </h3>
        {(() => {
          const todayStr = moment().format("YYYY-MM-DD");
          const todayApps = appointments.filter((a) => a.appointment_date === todayStr);
          if (todayApps.length === 0) {
            return <p className="text-sm text-muted-foreground py-6 text-center bg-card rounded-xl border border-border/60">No appointments scheduled for today.</p>;
          }
          return (
            <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Time</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Patient</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Priority</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayApps
                    .sort((a, b) => (a.appointment_time || "").localeCompare(b.appointment_time || ""))
                    .map((app) => (
                      <tr key={app.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-medium">{app.appointment_time || "—"}</td>
                        <td className="py-2.5 px-4">{getPatientName(app.patient_id)}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {typeLabels[app.type] || app.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            app.priority === "emergency" ? "bg-destructive/10 text-destructive" :
                            app.priority === "urgent" ? "bg-chart-2/10 text-chart-2" :
                            "bg-muted text-muted-foreground"
                          }`}>{app.priority}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[app.status] || ""}`}>
                            {app.status?.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}