import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Users, Calendar, Stethoscope, FlaskConical,
  Scan, Pill, BedDouble, Baby, Receipt, Shield, UserCircle,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Activity,
  Bell, Search, ClipboardList, CreditCard, BarChart3, Monitor
} from "lucide-react";

const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Reception", path: "/reception", icon: Users },
  { label: "Appointments", path: "/appointments", icon: Calendar },
  { label: "Clinical", path: "/clinical", icon: Stethoscope },
  { label: "Laboratory", path: "/lab", icon: FlaskConical },
  { label: "Imaging", path: "/imaging", icon: Scan },
  { label: "Pharmacy", path: "/pharmacy", icon: Pill },
  { label: "Inpatient", path: "/inpatient", icon: BedDouble },
  { label: "Maternal", path: "/maternal", icon: Baby },
  { label: "Billing", path: "/billing", icon: Receipt },
  { label: "Admin", path: "/admin", icon: Shield },
  { label: "Patient Portal", path: "/portal", icon: UserCircle },
  { label: "Queue Display", path: "/queue", icon: Monitor },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    base44.auth.logout("/login");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Activity className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-heading text-sm font-bold text-sidebar-foreground leading-tight">Zomba City</h1>
            <p className="text-[10px] text-sidebar-foreground/60 tracking-wide uppercase">Private Clinic HIMS</p>
          </div>
        )}
      </div>
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
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
        className={`hidden lg:flex flex-col bg-sidebar transition-all duration-300 ${
          collapsed ? "w-[68px]" : "w-[240px]"
        }`}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute bottom-4 -right-3 w-6 h-6 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center shadow-md hover:bg-sidebar-primary/90 transition-colors"
          style={{ left: collapsed ? "56px" : "228px" }}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-sidebar shadow-2xl animate-in slide-in-from-left">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
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