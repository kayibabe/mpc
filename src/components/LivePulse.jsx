import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Activity, Users, Clock, BedDouble } from "lucide-react";

export default function LivePulse({ compact = false, prominent = false }) {
  const [stats, setStats] = useState({ activeVisits: 0, waiting: 0, occupiedBeds: 0 });
  const [pulse, setPulse] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    async function fetchLive() {
      try {
        const [visits, beds] = await Promise.all([
          base44.entities.Visit.filter(
            { queue_status: { $in: ["waiting", "triaged", "in_consultation", "in_lab", "in_pharmacy"] } },
            "",
            100
          ),
          base44.entities.Bed.filter({ status: "occupied" }, "", 100),
        ]);
        setStats({
          activeVisits: visits.length,
          waiting: visits.filter(v => v.queue_status === "waiting").length,
          occupiedBeds: beds.length,
        });
      } catch (_) {}
    }

    fetchLive();
    intervalRef.current = setInterval(fetchLive, 30000);

    // Pulse animation trigger
    const pulseInterval = setInterval(() => {
      setPulse(p => !p);
    }, 1200);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(pulseInterval);
    };
  }, []);

  if (prominent) {
    return (
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-chart-3/5 via-primary/5 to-transparent px-5 py-4">
          <div className="flex items-center gap-5">
            {/* ECG + label */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <svg width="52" height="24" viewBox="0 0 96 48" className="flex-shrink-0">
                <defs>
                  <linearGradient id="ecgGradientP" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--chart-3))" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" />
                  </linearGradient>
                  <filter id="glowP">
                    <feGaussianBlur stdDeviation="1.2" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <path
                  d="M0 30 L18 30 L24 30 L30 6 L36 30 L42 30 L45 30 L51 42 L57 30 L63 30 L69 30 L75 18 L81 30 L87 30 L96 30"
                  fill="none"
                  stroke="url(#ecgGradientP)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glowP)"
                  className="animate-pulse"
                  style={{ animationDuration: "1.8s" }}
                />
              </svg>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${pulse ? "bg-chart-3 shadow-[0_0_6px_hsl(var(--chart-3))]" : "bg-chart-3/40"} transition-all duration-300`} />
                  <span className="text-[11px] font-bold text-chart-3 tracking-widest uppercase">Live HIMS</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Real-time clinic monitor</p>
              </div>
            </div>

            <div className="w-px h-10 bg-border/60 flex-shrink-0" />

            {/* Stats */}
            <div className="flex items-center gap-6 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-primary" />
                </span>
                <div>
                  <p className="text-xl font-bold text-foreground leading-none">{stats.activeVisits}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Active patients</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-chart-2/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-chart-2" />
                </span>
                <div>
                  <p className="text-xl font-bold text-chart-2 leading-none">{stats.waiting}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Waiting</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                  <BedDouble className="w-4 h-4 text-chart-4" />
                </span>
                <div>
                  <p className="text-xl font-bold text-chart-4 leading-none">{stats.occupiedBeds}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Occupied beds</p>
                </div>
              </div>
            </div>

            <Activity className={`w-5 h-5 text-chart-3 transition-all duration-300 flex-shrink-0 ${pulse ? "scale-110" : "scale-100"}`} />
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* ECG wave */}
        <svg width="32" height="16" viewBox="0 0 64 32" className="flex-shrink-0">
          <defs>
            <linearGradient id="ecgGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--chart-3))" />
              <stop offset="100%" stopColor="hsl(var(--primary))" />
            </linearGradient>
          </defs>
          <path
            d="M0 20 L12 20 L16 20 L20 4 L24 20 L28 20 L30 20 L34 28 L38 20 L42 20 L46 20 L50 12 L54 20 L58 20 L64 20"
            fill="none"
            stroke="url(#ecgGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-pulse"
            style={{ animationDuration: "1.8s" }}
          />
        </svg>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${pulse ? "bg-chart-3 scale-125" : "bg-chart-3/60"} transition-all duration-300`} />
          <span className="text-[10px] font-semibold text-chart-3 tracking-wide uppercase">Live</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
      {/* Header with ECG */}
      <div className="bg-gradient-to-r from-chart-3/5 via-primary/5 to-transparent px-4 py-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="48" height="24" viewBox="0 0 96 48" className="flex-shrink-0">
              <defs>
                <linearGradient id="ecgGradientFull" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--chart-3))" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="1.2" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <path
                d="M0 30 L18 30 L24 30 L30 6 L36 30 L42 30 L45 30 L51 42 L57 30 L63 30 L69 30 L75 18 L81 30 L87 30 L96 30"
                fill="none"
                stroke="url(#ecgGradientFull)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glow)"
                className="animate-pulse"
                style={{ animationDuration: "1.8s" }}
              />
            </svg>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${pulse ? "bg-chart-3 shadow-[0_0_6px_hsl(var(--chart-3))]" : "bg-chart-3/40"} transition-all duration-300`} />
                <span className="text-[11px] font-bold text-chart-3 tracking-widest uppercase">Live HIMS</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Real-time clinic monitor</p>
            </div>
          </div>
          <Activity className={`w-5 h-5 text-chart-3 transition-all duration-300 ${pulse ? "scale-110" : "scale-100"}`} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x divide-border/40">
        <div className="p-3 text-center">
          <Users className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{stats.activeVisits}</p>
          <p className="text-[10px] text-muted-foreground">Active</p>
        </div>
        <div className="p-3 text-center">
          <Clock className="w-3.5 h-3.5 text-chart-2 mx-auto mb-1" />
          <p className="text-lg font-bold text-chart-2">{stats.waiting}</p>
          <p className="text-[10px] text-muted-foreground">Waiting</p>
        </div>
        <div className="p-3 text-center">
          <BedDouble className="w-3.5 h-3.5 text-chart-4 mx-auto mb-1" />
          <p className="text-lg font-bold text-chart-4">{stats.occupiedBeds}</p>
          <p className="text-[10px] text-muted-foreground">Beds</p>
        </div>
      </div>
    </div>
  );
}