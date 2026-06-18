import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BedDouble, User, CalendarDays, Stethoscope, ChevronDown, ChevronUp, Building, AlertCircle, CheckCircle, Clock, Wrench, Shield } from "lucide-react";

const STATUS_CONFIG = {
  occupied: {
    color: "border-destructive/40 bg-destructive/5",
    badge: "bg-destructive/10 text-destructive",
    icon: User,
    label: "Occupied",
  },
  available: {
    color: "border-clinical-normal/40 bg-clinical-normal/5",
    badge: "bg-clinical-normal/10 text-clinical-normal",
    icon: CheckCircle,
    label: "Available",
  },
  reserved: {
    color: "border-chart-4/40 bg-chart-4/5",
    badge: "bg-chart-4/10 text-chart-4",
    icon: Shield,
    label: "Reserved",
  },
  cleaning: {
    color: "border-chart-2/40 bg-chart-2/5",
    badge: "bg-chart-2/10 text-chart-2",
    icon: Wrench,
    label: "Cleaning",
  },
  maintenance: {
    color: "border-triage-semi/40 bg-triage-semi/5",
    badge: "bg-triage-semi/10 text-triage-semi",
    icon: AlertCircle,
    label: "Maintenance",
  },
};

const WARD_TYPE_LABELS = {
  general: "General",
  private: "Private",
  maternity: "Maternity",
  icu: "ICU",
  isolation: "Isolation",
  paediatric: "Paediatric",
};

export default function WardBedDashboard() {
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedWards, setExpandedWards] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const [w, b, a, p] = await Promise.all([
          base44.entities.Ward.list("", 50),
          base44.entities.Bed.list("", 200),
          base44.entities.Admission.filter({ status: "admitted" }, "-created_date", 100),
          base44.entities.Patient.list("-created_date", 200),
        ]);
        setWards(w);
        setBeds(b);
        setAdmissions(a);
        setPatients(p);
        // Auto-expand all wards
        const expanded = {};
        w.forEach(ward => { expanded[ward.id] = true; });
        setExpandedWards(expanded);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getPatientName = (pid) => {
    const p = patients.find(pt => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const getWardBeds = (wardId) => beds.filter(b => b.ward_id === wardId);

  const getAdmissionForBed = (bedId) => admissions.find(a => a.bed_id === bedId);

  const getWardStats = (wardBeds) => {
    const occupied = wardBeds.filter(b => b.status === "occupied").length;
    const available = wardBeds.filter(b => b.status === "available").length;
    return { total: wardBeds.length, occupied, available };
  };

  const toggleWard = (wardId) => {
    setExpandedWards(prev => ({ ...prev, [wardId]: !prev[wardId] }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (wards.length === 0) {
    return (
      <div className="py-16 text-center">
        <Building className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">No wards configured yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Add wards and beds to see the dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border/60 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{wards.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Wards</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{beds.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Beds</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{beds.filter(b => b.status === "occupied").length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Occupied</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-3 text-center">
          <p className="text-2xl font-bold text-clinical-normal">{beds.filter(b => b.status === "available").length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Available</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-3 text-center">
          <p className="text-2xl font-bold text-muted-foreground">
            {beds.filter(b => b.status === "reserved" || b.status === "cleaning" || b.status === "maintenance").length}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Other</p>
        </div>
      </div>

      {/* Ward Cards */}
      {wards.filter(w => getWardBeds(w.id).length > 0).map(ward => {
        const wardBeds = getWardBeds(ward.id);
        const stats = getWardStats(wardBeds);
        const isExpanded = expandedWards[ward.id];

        return (
          <div key={ward.id} className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
            {/* Ward Header */}
            <button
              onClick={() => toggleWard(ward.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-heading font-semibold text-foreground">{ward.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {WARD_TYPE_LABELS[ward.type] || ward.type}
                    {ward.floor ? ` • Floor ${ward.floor}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {/* Occupancy bar */}
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Beds:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-destructive font-semibold">{stats.occupied}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-clinical-normal font-semibold">{stats.available}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-foreground font-semibold">{stats.total}</span>
                  </div>
                  {/* Mini occupancy bar */}
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden ml-1">
                    <div
                      className="h-full bg-destructive rounded-full transition-all"
                      style={{ width: `${stats.total > 0 ? (stats.occupied / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
              </div>
            </button>

            {/* Ward Bed Grid */}
            {isExpanded && (
              <div className="border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
                  {wardBeds.map(bed => {
                    const config = STATUS_CONFIG[bed.status] || STATUS_CONFIG.available;
                    const StatusIcon = config.icon;
                    const admission = bed.status === "occupied" ? getAdmissionForBed(bed.id) : null;

                    return (
                      <div
                        key={bed.id}
                        className={`rounded-xl border p-3.5 transition-all hover:shadow-sm ${config.color}`}
                      >
                        {/* Bed Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <BedDouble className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold text-sm">{bed.bed_number}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${config.badge}`}>
                            <StatusIcon className="w-3 h-3 inline mr-0.5" />
                            {config.label}
                          </span>
                        </div>

                        {/* Occupied — show patient details */}
                        {admission && (
                          <div className="space-y-1.5 mt-2 pt-2 border-t border-border/40">
                            <div className="flex items-center gap-1.5 text-sm">
                              <User className="w-3.5 h-3.5 text-primary" />
                              <span className="font-medium truncate">{getPatientName(admission.patient_id)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarDays className="w-3 h-3" />
                              <span>Admitted: {new Date(admission.admission_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                            </div>
                            {admission.diagnosis_on_admission && (
                              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <Stethoscope className="w-3 h-3 mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{admission.diagnosis_on_admission}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium capitalize">
                                {admission.admission_type}
                              </span>
                              <span className="text-muted-foreground text-[10px]">
                                {Math.floor((Date.now() - new Date(admission.admission_date)) / 86400000)} days
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Occupied but no linked admission record */}
                        {bed.status === "occupied" && !admission && (
                          <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <AlertCircle className="w-3 h-3 text-triage-semi" />
                            <span>No admission record</span>
                          </div>
                        )}

                        {/* Not occupied — show type & rate */}
                        {bed.status !== "occupied" && !admission && (
                          <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="capitalize">{bed.type}</span>
                            {bed.rate_per_day > 0 && <span>MWK {Number(bed.rate_per_day).toLocaleString()}/day</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {wardBeds.length === 0 && (
                  <div className="p-8 text-center">
                    <BedDouble className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No beds in this ward yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Wards with no beds */}
      {wards.filter(w => getWardBeds(w.id).length === 0).length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <p className="text-xs text-muted-foreground text-center">
            {wards.filter(w => getWardBeds(w.id).length === 0).length} ward(s) have no beds assigned.
          </p>
        </div>
      )}
    </div>
  );
}