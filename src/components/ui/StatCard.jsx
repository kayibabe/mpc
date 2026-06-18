import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * Polished equal-height KPI stat card with a tinted icon badge.
 * Usage:
 *   <StatCard label="Patients" value={42} icon={Users} to="/reception" />
 *   <StatCard label="Low Stock" value={3} icon={Pill} color="warning" />
 *
 * color: "default" | "primary" | "warning" | "critical" | "success" | "accent"
 */
const TONES = {
  default: { iconBg: "bg-slate-100", iconColor: "text-slate-600", gradient: "from-slate-50 to-white", border: "border-slate-200", value: "text-foreground" },
  primary: { iconBg: "bg-primary/10", iconColor: "text-primary", gradient: "from-primary/5 to-white", border: "border-primary/20", value: "text-foreground" },
  accent: { iconBg: "bg-accent/10", iconColor: "text-accent", gradient: "from-accent/5 to-white", border: "border-accent/20", value: "text-foreground" },
  warning: { iconBg: "bg-amber-100", iconColor: "text-amber-600", gradient: "from-amber-50 to-white", border: "border-amber-200 hover:border-amber-300", value: "text-amber-600" },
  critical: { iconBg: "bg-red-100", iconColor: "text-red-600", gradient: "from-red-50 to-white", border: "border-red-200 hover:border-red-300", value: "text-clinical-critical" },
  success: { iconBg: "bg-emerald-100", iconColor: "text-emerald-600", gradient: "from-emerald-50 to-white", border: "border-emerald-200", value: "text-emerald-600" },
};

export default function StatCard({ label, value, sub, icon: Icon, to, color = "default", className = "" }) {
  const t = TONES[color] || TONES.default;

  const content = (
    <div className={`relative overflow-hidden bg-white rounded-xl border ${t.border} hover:border-opacity-80 p-5 shadow-sm hover:shadow-md transition-all duration-200 ${to ? "cursor-pointer" : ""} group h-full ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient} opacity-60`} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          {Icon && (
            <div className={`w-10 h-10 rounded-xl ${t.iconBg} ring-1 ring-inset ring-black/[0.03] flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-200`}>
              <Icon className={t.iconColor} style={{ width: "19px", height: "19px" }} strokeWidth={2.25} />
            </div>
          )}
          {to && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />}
        </div>
        <p className={`text-3xl font-bold tracking-tight font-mono tabular-nums leading-none mb-1.5 ${t.value}`}>{value}</p>
        <p className="text-xs font-semibold text-muted-foreground leading-tight">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/70 mt-1">{sub}</p>}
      </div>
    </div>
  );

  if (to) return <Link to={to} className="block h-full">{content}</Link>;
  return content;
}