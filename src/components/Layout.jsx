import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import LivePulse from "@/components/LivePulse";

import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, FlaskConical,
  Scan, Pill, BedDouble, Baby, Receipt, Shield, UserCircle,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Activity,
  Bell, Search, ClipboardPen, Monitor, FileBarChart, Trash2, PenTool,
  ArrowRightLeft, ShieldCheck, ClipboardCheck, Scissors, GitBranch, Clock, Zap,
  TrendingUp, Package, MessageSquare, FileText, CheckCircle
} from "lucide-react";

const ALL_NAV_GROUPS = [
  {
    label: "Clinical",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["admin", "user"] },
      { label: "Reception", path: "/reception", icon: Users, roles: ["admin", "user"] },
      { label: "Appointments", path: "/appointments", icon: CalendarDays, roles: ["admin", "user"] },
      { label: "Clinical", path: "/clinical", icon: Stethoscope, roles: ["admin", "user"] },
      { label: "Nursing", path: "/nursing", icon: ClipboardPen, roles: ["admin", "user"] },
      { label: "Laboratory", path: "/lab", icon: FlaskConical, roles: ["admin", "user"] },
      { label: "Imaging", path: "/imaging", icon: Scan, roles: ["admin", "user"] },
      { label: "Radiology Reports", path: "/radiology-reports", icon: FileText, roles: ["admin", "user"] },
      { label: "Pharmacy", path: "/pharmacy", icon: Pill, roles: ["admin", "user"] },
      { label: "Inpatient", path: "/inpatient", icon: BedDouble, roles: ["admin", "user"] },
      { label: "Discharge Checklist", path: "/discharge-checklist", icon: CheckCircle, roles: ["admin", "user"] },
      { label: "Maternal", path: "/maternal", icon: Baby, roles: ["admin", "user"] },
      { label: "Billing", path: "/billing", icon: Receipt, roles: ["admin", "user"] },
      { label: "Insurance", path: "/insurance-claims", icon: FileBarChart, roles: ["admin", "user"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Calendar", path: "/calendar", icon: CalendarDays, roles: ["admin", "user"] },
      { label: "Doctor Schedule", path: "/doctor-schedule", icon: Clock, roles: ["admin", "user"] },
      { label: "Staff Shifts", path: "/staff-shifts", icon: Zap, roles: ["admin", "user"] },
      { label: "Queue Display", path: "/queue", icon: Monitor, roles: ["admin", "user"] },
      { label: "Triage", path: "/triage", icon: ClipboardCheck, roles: ["admin", "user"] },
      { label: "Journey Map", path: "/journey-map", icon: GitBranch, roles: ["admin", "user"] },
      { label: "Theatre Calendar", path: "/surgery-calendar", icon: Scissors, roles: ["admin", "user"] },
      { label: "MoH Reports", path: "/moh-reports", icon: FileBarChart, roles: ["admin"] },
      { label: "Physician Perf.", path: "/physician-performance", icon: Stethoscope, roles: ["admin"] },
      { label: "Doctor Performance", path: "/doctor-performance", icon: TrendingUp, roles: ["admin"] },
      { label: "Inventory Audit", path: "/inventory-audit", icon: Package, roles: ["admin"] },
      { label: "Surgical Supplies", path: "/surgical-supplies", icon: Package, roles: ["admin"] },
      { label: "Patient Feedback", path: "/patient-feedback", icon: MessageSquare, roles: ["admin", "user"] },
      { label: "Waste Management", path: "/waste", icon: Trash2, roles: ["admin", "user"] },
      { label: "Doctor Handover", path: "/doctor-handover", icon: ArrowRightLeft, roles: ["admin", "user"] },
      { label: "My Signatures", path: "/my-signatures", icon: PenTool, roles: ["admin", "user"] },
      { label: "Signature Audit", path: "/signature-audit", icon: ShieldCheck, roles: ["admin"] },
      { label: "Patient Portal", path: "/portal", icon: UserCircle, roles: ["admin", "user"] },
      { label: "Admin", path: "/admin", icon: Shield, roles: ["admin"] },
    ],
  },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState("user");
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role) setUserRole(u.role);
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    base44.auth.logout("/login");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="relative w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Activity className="w-5 h-5 text-primary-foreground animate-pulse" style={{ animationDuration: "2s" }} />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-clinical-normal border-2 border-sidebar" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-sidebar-foreground leading-tight tracking-tight">Zomba City</h1>
            <p className="text-[10px] font-semibold text-sidebar-foreground/50 tracking-widest uppercase">Private Clinic HIMS</p>
          </div>
        )}
      </div>
      <nav className="flex-1 py-2 px-2 space-y-4 overflow-y-auto">
        {ALL_NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(item => item.roles.includes(userRole));
          if (visibleItems.length === 0) return null;
          return (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 border-l-[3px] ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-foreground border-l-sidebar-primary"
                        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-transparent"
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside
      className={`hidden lg:flex flex-col bg-sidebar transition-all duration-300 relative ${
      collapsed ? "w-[68px]" : "w-[240px]"
      }`}
      >
      {sidebarContent}
      <button
      onClick={() => setCollapsed(!collapsed)}
      className="absolute bottom-6 right-0 translate-x-1/2 w-6 h-6 rounded-full bg-white border border-border shadow-sm text-muted-foreground hover:text-foreground hover:border-primary/40 flex items-center justify-center transition-all duration-200"
      >
      {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-sidebar/95 backdrop-blur-xl shadow-2xl animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border/50 bg-card/90 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-secondary" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4 ml-auto">
            <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
              <Search className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">ZC</span>
              </div>
            </div>
            <div className="pl-2 border-l border-border/50">
              <LivePulse compact />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}