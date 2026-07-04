import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, UserPlus, ClipboardCheck, Stethoscope, Microscope, Pill, BedDouble, Receipt, Siren } from "lucide-react";

const ACTIONS = [
  { label: "Register Patient", path: "/reception",  icon: UserPlus,      color: "#0891B2", roles: ["admin", "user", "receptionist", "nurse"] },
  { label: "Triage",           path: "/triage",      icon: ClipboardCheck, color: "#F59E0B", roles: ["admin", "user", "receptionist", "nurse"] },
  { label: "New Consultation", path: "/clinical",    icon: Stethoscope,   color: "#059669", roles: ["admin", "user", "doctor", "clinician"] },
  { label: "Lab Orders",       path: "/lab",         icon: Microscope,    color: "#2B7CBF", roles: ["admin", "user", "doctor", "clinician", "lab_technician"] },
  { label: "Pharmacy",         path: "/pharmacy",    icon: Pill,          color: "#7C3AED", roles: ["admin", "user", "doctor", "clinician", "pharmacist"] },
  { label: "Admit Patient",    path: "/inpatient",   icon: BedDouble,     color: "#9333EA", roles: ["admin", "user", "nurse", "midwife", "doctor", "clinician"] },
  { label: "Create Invoice",   path: "/billing",     icon: Receipt,       color: "#D97706", roles: ["admin", "user", "cashier", "receptionist"] },
  { label: "Surge Monitor",    path: "/surge",       icon: Siren,         color: "#DC2626", roles: ["admin", "user", "doctor", "nurse", "receptionist"] },
];

export default function QuickActionMenu({ userRole = "user" }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const visible = ACTIONS.filter(a => a.roles.includes(userRole));
  if (visible.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        aria-label="Quick actions"
      >
        <Zap className="w-4 h-4" />
        <span className="hidden sm:inline">Quick Actions</span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-60 bg-card border border-border rounded-xl shadow-lg z-50 p-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-1">
            {visible.map(({ label, path, icon: Icon, color }) => (
              <button
                key={path}
                onClick={() => { navigate(path); setOpen(false); }}
                className="flex flex-col items-center gap-2 px-2 py-3 rounded-xl text-center text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ background: `${color}18` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.8} />
                </span>
                <span className="text-[10.5px] leading-tight text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
