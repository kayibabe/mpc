import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, Users, Clock, ClipboardCheck } from "lucide-react";

const SHIFT_TYPES = {
  reception: { label: "Reception", color: "bg-primary", text: "text-primary" },
  nursing: { label: "Nursing", color: "bg-chart-4", text: "text-chart-4" },
  clinical: { label: "Clinical", color: "bg-chart-1", text: "text-chart-1" },
  lab: { label: "Lab", color: "bg-chart-3", text: "text-chart-3" },
  pharmacy: { label: "Pharmacy", color: "bg-chart-2", text: "text-chart-2" },
  billing: { label: "Billing", color: "bg-chart-5", text: "text-chart-5" },
  admin: { label: "Admin", color: "bg-accent", text: "text-accent" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
  return days;
}

export default function ShiftCalendar({ compact = false }) {
  const [handovers, setHandovers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    async function load() {
      try {
        const startOfMonth = new Date(year, month, 1).toISOString();
        const endOfMonth = new Date(year, month + 1, 1).toISOString();
        const [h, u] = await Promise.all([
          base44.entities.ShiftHandoverLog.filter(
            { handover_date: { $gte: startOfMonth, $lt: endOfMonth } },
            "-handover_date",
            200
          ),
          base44.entities.User.list("", 50),
        ]);
        setHandovers(h);
        setUsers(u);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [year, month]);

  const userMap = useMemo(() => {
    const map = {};
    users.forEach(u => { map[u.id] = u.full_name || u.email || u.id.slice(0, 8); });
    return map;
  }, [users]);

  // Group handovers by date
  const handoversByDate = useMemo(() => {
    const map = {};
    handovers.forEach(h => {
      const date = h.handover_date?.slice(0, 10);
      if (!date) return;
      if (!map[date]) map[date] = [];
      map[date].push(h);
    });
    return map;
  }, [handovers]);

  const days = getMonthDays(year, month);
  const monthLabel = viewDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const selectedHandovers = selectedDate ? handoversByDate[selectedDate] || [] : [];

  if (compact) {
    // Mini calendar strip for next 7 days
    const next7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() + i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const dayHandovers = handoversByDate[dateStr] || [];
      return { date: d, dateStr, count: dayHandovers.length, handovers: dayHandovers };
    });

    return (
      <div className="bg-card rounded-xl border border-border/60 p-3">
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" /> Upcoming Shifts
        </h4>
        <div className="grid grid-cols-7 gap-1">
          {next7.map(({ date, dateStr, count }) => {
            const isToday = dateStr === today;
            return (
              <div key={dateStr} className={`text-center rounded-lg p-1.5 ${isToday ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/20"}`}>
                <p className="text-[9px] text-muted-foreground">{DAYS[date.getDay()]}</p>
                <p className={`text-xs font-bold ${isToday ? "text-primary" : ""}`}>{date.getDate()}</p>
                {count > 0 && <div className="mt-0.5 flex justify-center gap-0.5">{Array.from({ length: Math.min(count, 3) }, (_, i) => <span key={i} className="w-1 h-1 rounded-full bg-primary/60" />)}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="font-heading text-sm font-semibold">{monthLabel}</h3>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border/40">
        {DAYS.map(d => (
          <div key={d} className="text-center py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="aspect-square p-1" />;

          const dateStr = date.toISOString().slice(0, 10);
          const dayHandovers = handoversByDate[dateStr] || [];
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`aspect-square p-1 flex flex-col items-center justify-start rounded-lg m-0.5 transition-colors relative
                ${isToday ? "ring-1 ring-primary/50 bg-primary/5" : "hover:bg-muted/50"}
                ${isSelected ? "bg-primary/10 ring-2 ring-primary" : ""}`}
            >
              <span className={`text-xs font-medium ${isToday ? "text-primary font-bold" : ""}`}>{date.getDate()}</span>
              {dayHandovers.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
                  {[...new Set(dayHandovers.map(h => h.shift_type))].slice(0, 3).map(type => (
                    <span key={type} className={`w-1.5 h-1.5 rounded-full ${SHIFT_TYPES[type]?.color || "bg-muted-foreground"}`} title={SHIFT_TYPES[type]?.label || type} />
                  ))}
                  {dayHandovers.length > 3 && <span className="text-[8px] text-muted-foreground leading-none">+{dayHandovers.length - 3}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date details */}
      {selectedDate && (
        <div className="border-t border-border p-4 bg-muted/10">
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
            <ClipboardCheck className="w-3.5 h-3.5 text-primary" />
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            {" "}({selectedHandovers.length} shift{selectedHandovers.length !== 1 ? "s" : ""})
          </h4>
          {selectedHandovers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No shift handovers on this date.</p>
          ) : (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {selectedHandovers.map(h => (
                <div key={h.id} className={`flex items-center justify-between p-2 rounded-lg border border-border/40 bg-card text-xs ${h.acknowledged ? "" : "border-l-2 border-l-chart-2"}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SHIFT_TYPES[h.shift_type]?.color || "bg-muted"}`} />
                    <span className="font-medium truncate">{SHIFT_TYPES[h.shift_type]?.label || h.shift_type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] shrink-0">
                    <span className="text-muted-foreground">
                      {userMap[h.handover_from_user_id] || "?"} → {h.handover_to_user_id ? userMap[h.handover_to_user_id] || "?" : "?"}
                    </span>
                    {h.acknowledged ? (
                      <span className="px-1.5 py-0.5 bg-chart-3/10 text-chart-3 rounded-full font-medium">Ack'd</span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-chart-2/10 text-chart-2 rounded-full font-medium">Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="border-t border-border px-4 py-2 flex flex-wrap gap-3">
        {Object.entries(SHIFT_TYPES).map(([key, { label, color }]) => (
          <div key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}