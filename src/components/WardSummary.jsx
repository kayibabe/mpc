import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BedDouble, Users, AlertCircle, TrendingUp, RefreshCw } from "lucide-react";

export default function WardSummary() {
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [wardData, bedData, admissionData] = await Promise.all([
        base44.entities.Ward.list("-created_date", 50),
        base44.entities.Bed.list("", 500),
        base44.entities.Admission.filter({ status: "active" }, "-created_date", 500),
      ]);
      setWards(wardData);
      setBeds(bedData);
      setAdmissions(admissionData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const wardData = wards.map(ward => {
    const wardBeds = beds.filter(b => b.ward_id === ward.id);
    const occupiedBeds = wardBeds.filter(b => b.status === "occupied");
    const wardAdmissions = admissions.filter(a => a.ward_id === ward.id);

    return {
      ...ward,
      total_beds: wardBeds.length,
      occupied_beds: occupiedBeds.length,
      available_beds: wardBeds.length - occupiedBeds.length,
      occupancy_rate: wardBeds.length > 0 ? ((occupiedBeds.length / wardBeds.length) * 100).toFixed(0) : 0,
      patient_count: wardAdmissions.length,
      critical_patients: wardAdmissions.filter(a => a.priority === "high").length,
    };
  });

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm flex justify-center">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const occupiedBedCount = beds.filter(b => b.status === "occupied").length;
  const totalOccupancy = beds.length > 0
    ? ((occupiedBedCount / beds.length) * 100).toFixed(0)
    : 0;

  return (
    <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
          <BedDouble className="w-5 h-5 text-primary" /> Ward Summary
        </h3>
        <button
          onClick={loadData}
          className="p-1.5 rounded hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground font-medium uppercase">Total Beds</p>
          <p className="text-lg font-bold mt-1">{beds.length}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground font-medium uppercase">Occupied</p>
          <p className="text-lg font-bold mt-1">{beds.filter(b => b.status === "occupied").length}</p>
        </div>
        <div className="bg-primary/5 rounded-lg p-3">
          <p className="text-[10px] text-primary font-medium uppercase">Occupancy Rate</p>
          <p className="text-lg font-bold text-primary mt-1">{totalOccupancy}%</p>
        </div>
        <div className="bg-chart-1/5 rounded-lg p-3">
          <p className="text-[10px] text-chart-1 font-medium uppercase">Patients</p>
          <p className="text-lg font-bold text-chart-1 mt-1">{admissions.length}</p>
        </div>
      </div>

      {/* Ward Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {wardData.map(ward => (
          <div key={ward.id} className={`border rounded-lg p-3 transition-colors ${
            parseInt(ward.occupancy_rate) >= 80 ? "bg-destructive/5 border-destructive/20" :
            parseInt(ward.occupancy_rate) >= 60 ? "bg-chart-2/5 border-chart-2/20" :
            "bg-chart-3/5 border-chart-3/20"
          }`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-sm">{ward.name}</p>
                <p className="text-[10px] text-muted-foreground">{ward.department || "General"}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                parseInt(ward.occupancy_rate) >= 80 ? "bg-destructive/20 text-destructive" :
                parseInt(ward.occupancy_rate) >= 60 ? "bg-chart-2/20 text-chart-2" :
                "bg-chart-3/20 text-chart-3"
              }`}>
                {ward.occupancy_rate}%
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Beds</span>
                <span className="font-mono font-medium">{ward.occupied_beds}/{ward.total_beds}</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    parseInt(ward.occupancy_rate) >= 80 ? "bg-destructive" :
                    parseInt(ward.occupancy_rate) >= 60 ? "bg-chart-2" :
                    "bg-chart-3"
                  }`}
                  style={{ width: `${ward.occupancy_rate}%` }}
                />
              </div>
            </div>

            {ward.critical_patients > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-destructive font-medium">
                <AlertCircle className="w-3 h-3" />
                {ward.critical_patients} critical
              </div>
            )}
          </div>
        ))}
      </div>

      {wardData.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">No wards configured yet.</div>
      )}
    </div>
  );
}