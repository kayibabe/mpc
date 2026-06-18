import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import LivePulse from "@/components/LivePulse";

import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, FlaskConical,
  Scan, Pill, BedDouble, Baby, Receipt, Shield, UserCircle,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Activity,
  Bell, Search, ClipboardPen, Monitor, FileBarChart, Trash2, PenTool,
  ArrowRightLeft, ShieldCheck, ClipboardCheck, Scissors, GitBranch, Clock, Zap,
  TrendingUp, Package, MessageSquare, FileText, CheckCircle, ChevronDown } from
"lucide-react";

const ALL_NAV_GROUPS = [
{
  label: "Main",
  items: [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["admin", "user"] }]

},
{
  label: "Patient Access",
  items: [
  { label: "Reception", path: "/reception", icon: Users, roles: ["admin", "user"] },
  { label: "Patient Intake", path: "/patient-intake", icon: Users, roles: ["admin", "user"] },
  { label: "Appointments", path: "/appointments", icon: CalendarDays, roles: ["admin", "user"] },
  { label: "Triage", path: "/triage", icon: ClipboardCheck, roles: ["admin", "user"] }]

},
{
  label: "Clinical",
  items: [
  { label: "Consultations", path: "/clinical", icon: Stethoscope, roles: ["admin", "user"] },
  { label: "Nursing", path: "/nursing", icon: ClipboardPen, roles: ["admin", "user"] },
  { label: "Laboratory", path: "/lab", icon: FlaskConical, roles: ["admin", "user"] },
  { label: "Imaging", path: "/imaging", icon: Scan, roles: ["admin", "user"] },
  { label: "Radiology Reports", path: "/radiology-reports", icon: FileText, roles: ["admin", "user"] },
  { label: "Pharmacy", path: "/pharmacy", icon: Pill, roles: ["admin", "user"] }]

},
{
  label: "Inpatient & Theatre",
  items: [
  { label: "Inpatient", path: "/inpatient", icon: BedDouble, roles: ["admin", "user"] },
  { label: "Maternal", path: "/maternal", icon: Baby, roles: ["admin", "user"] },
  { label: "Discharge Checklist", path: "/discharge-checklist", icon: CheckCircle, roles: ["admin", "user"] },
  { label: "Theatre Calendar", path: "/surgery-calendar", icon: Scissors, roles: ["admin", "user"] }]

},
{
  label: "Billing & Insurance",
  items: [
  { label: "Billing", path: "/billing", icon: Receipt, roles: ["admin", "user"] },
  { label: "Insurance Claims", path: "/insurance-claims", icon: FileBarChart, roles: ["admin", "user"] }]

},
{
  label: "Operations & Scheduling",
  items: [
  { label: "Calendar", path: "/calendar", icon: CalendarDays, roles: ["admin", "user"] },
  { label: "Doctor Schedule", path: "/doctor-schedule", icon: Clock, roles: ["admin", "user"] },
  { label: "Staff Shifts", path: "/staff-shifts", icon: Zap, roles: ["admin", "user"] },
  { label: "Doctor Handover", path: "/doctor-handover", icon: ArrowRightLeft, roles: ["admin", "user"] },
  { label: "Queue Display", path: "/queue", icon: Monitor, roles: ["admin", "user"] }]

},
{
  label: "Tracking & Outcomes",
  items: [
  { label: "Journey Map", path: "/journey-map", icon: GitBranch, roles: ["admin", "user"] },
  { label: "Treatment Adherence", path: "/treatment-adherence", icon: TrendingUp, roles: ["admin"] },
  { label: "Patient Outcomes", path: "/patient-outcomes", icon: Users, roles: ["admin"] },
  { label: "Patient Feedback", path: "/patient-feedback", icon: MessageSquare, roles: ["admin", "user"] }]

},
{
  label: "Reports & Analytics",
  items: [
  { label: "Physician Performance", path: "/physician-performance", icon: Stethoscope, roles: ["admin"] },
  { label: "Doctor Performance", path: "/doctor-performance", icon: TrendingUp, roles: ["admin"] },
  { label: "MoH Reports", path: "/moh-reports", icon: FileBarChart, roles: ["admin"] },
  { label: "Audit Logs", path: "/audit-logs", icon: FileText, roles: ["admin"] }]

},
{
  label: "Inventory & Facilities",
  items: [
  { label: "Inventory Audit", path: "/inventory-audit", icon: Package, roles: ["admin"] },
  { label: "Surgical Supplies", path: "/surgical-supplies", icon: Package, roles: ["admin"] },
  { label: "Waste Management", path: "/waste", icon: Trash2, roles: ["admin", "user"] }]

},
{
  label: "Security & Documents",
  items: [
  { label: "My Signatures", path: "/my-signatures", icon: PenTool, roles: ["admin", "user"] },
  { label: "Signature Audit", path: "/signature-audit", icon: ShieldCheck, roles: ["admin"] },
  { label: "Patient Portal", path: "/portal", icon: UserCircle, roles: ["admin", "user"] }]

},
{
  label: "Administration",
  items: [
  { label: "Admin", path: "/admin", icon: Shield, roles: ["admin"] }]

}];


export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState("user");
  const [currentUser, setCurrentUser] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const location = useLocation();
  const navigate = useNavigate();

  const toggleGroupCollapse = (groupLabel) => {
    setCollapsedGroups((prev) => {
      // If clicking an already expanded group, close it
      if (prev[groupLabel] === false) {
        return {};
      }
      // Otherwise, expand only this group and collapse all others
      return { [groupLabel]: false };
    });
  };

  useEffect(() => {
    const fetchUser = () => {
      base44.auth.me().then((u) => {
        if (u?.role) setUserRole(u.role);
        setCurrentUser(u);
      }).catch(() => {});
    };
    fetchUser();
    // Re-fetch on focus so switching accounts reflects immediately
    window.addEventListener("focus", fetchUser);
    return () => window.removeEventListener("focus", fetchUser);
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = "/login";
  };

  const sidebarContent =
  <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border/60">
        <div className="relative w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Activity className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed &&
      <div className="overflow-hidden">
            <h1 className="text-xs font-bold text-sidebar-foreground leading-tight tracking-tight">ZCPC - HIMS</h1>
            <p className="text-[9px] font-semibold text-sidebar-foreground/50 tracking-widest uppercase">Malawi</p>
          </div>
      }
      </div>
      <nav className="flex-1 py-3 px-2 space-y-5 overflow-y-auto">
        {ALL_NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => item.roles.includes(userRole));
        if (visibleItems.length === 0) return null;
        const isMainGroup = group.label === "Main";
        const isGroupCollapsed = isMainGroup ? false : collapsedGroups[group.label] !== false;
        return (
          <div key={group.label}>
              {!isMainGroup ?
            <button
              onClick={() => {
                if (visibleItems.length > 0) {
                  navigate(visibleItems[0].path);
                  setMobileOpen(false);
                }
                toggleGroupCollapse(group.label);
              }}
              className={`flex items-center justify-between w-full px-2 py-1.5 rounded-md transition-colors ${
              !collapsed ? "hover:bg-primary/5" : ""}`
              }
              title={isGroupCollapsed ? "Expand" : "Collapse"}>
              
                  {!collapsed &&
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/65 flex-1 text-left">
                      {group.label}
                    </p>
              }
                  {!collapsed &&
              <ChevronDown className={`w-3.5 h-3.5 text-sidebar-foreground/50 transition-transform duration-200 flex-shrink-0 ${isGroupCollapsed ? "-rotate-90" : ""}`} />
              }
                </button> :

            <div className="flex items-center justify-between px-2 mb-1">
                  {!collapsed &&
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/65">
                      {group.label}
                    </p>
              }
                </div>
            }
              {!isGroupCollapsed &&
            <div className="space-y-0.5 mt-1">
                  {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMobileOpen(false);
                      if (item.path === "/") {
                        setCollapsedGroups({});
                      }
                    }}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                    isActive ?
                    "bg-primary/10 text-primary" :
                    "text-sidebar-foreground/60 hover:bg-primary/5 hover:text-sidebar-foreground"}`
                    }>
                    
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {!collapsed && <span className="truncate text-xs">{item.label}</span>}
                      </Link>);

              })}
                </div>
            }
            </div>);

      })}
      </nav>
      <div className="border-t border-sidebar-border/60 p-3">
        <button
        onClick={handleLogout}
        className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-xs font-medium text-sidebar-foreground/60 hover:bg-primary/5 hover:text-sidebar-foreground transition-colors"
        aria-label="Logout">
        
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>;


  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 relative ${
        collapsed ? "w-[72px]" : "w-[260px]"}`
        }>
        
        {sidebarContent}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 bottom-6 w-6 h-6 rounded-full bg-card border border-border shadow-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 flex items-center justify-center"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen &&
      <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-sidebar border-r border-sidebar-border shadow-2xl animate-in slide-in-from-left-300 duration-300 flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      }

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-white flex items-center justify-between px-4 lg:px-8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu">
              
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zomba City PRIVATE CLINIC - HIMS</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <LivePulse compact />
            </div>
            <button
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              aria-label="Search">
              
              <Search className="w-5 h-5" />
            </button>
            <button
              className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              aria-label="Notifications">
              
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-clinical-critical" />
            </button>
            <div className="flex items-center gap-2 pl-3 lg:pl-4 border-l border-border/50">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">
                  {(currentUser?.full_name || currentUser?.email || "U")[0]?.toUpperCase()}
                </span>
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground leading-tight truncate max-w-[100px] sm:max-w-[140px]">{currentUser?.full_name || currentUser?.email || "User"}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{currentUser?.role || "user"}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>);

}