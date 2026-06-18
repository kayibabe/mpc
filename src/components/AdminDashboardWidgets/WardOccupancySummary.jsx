import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BedDouble, AlertCircle } from "lucide-react";

export default function WardOccupancySummary() {
  const [wardData, setWardData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOccupancy() {
      try {
        const [wards, beds] = await Promise.all([
          base44.asServiceRole.entities.Ward.list("", 50),
          base44.asServiceRole.entities.Bed.list("", 500),
        ]);

        const occupancy = wards.map(ward => {
          const wardBeds = beds.filter(b => b.ward_id === ward.id);
          const occupied = wardBeds.filter(b => b.status === "occupied").length;
          const total = wardBeds.length || ward.total_beds || 0;
          const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;
          return {
            id: ward.id,
            name: ward.name,
            occupied,
            total,
            percentage,
            type: ward.type,
          };
        });

        setWardData(occupancy.filter(w => w.total > 0));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchOccupancy();
  }, []);

  if (loading) return <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>;

  const totalBeds = wardData.reduce((sum, w) => sum + w.total, 0);
  const totalOccupied = wardData.reduce((sum, w) => sum + w.occupied, 0);
  const occupancyRate = totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0;

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <BedDouble className="w-4 h-4 text-chart-4" />
          Ward Occupancy
        </h3>
      </div>
      <div className="text-2xl font-bold text-chart-4 mb-4">
        {totalOccupied} / {totalBeds} Beds ({occupancyRate}%)
      </div>
      <div className="space-y-2">
        {wardData.map(ward => (
          <div key={ward.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs font-medium text-foreground capitalize">{ward.name}</p>
              <p className="text-[10px] text-muted-foreground">{ward.occupied}/{ward.total} beds</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    ward.percentage >= 80 ? 'bg-destructive' : ward.percentage >= 60 ? 'bg-chart-2' : 'bg-chart-3'
                  }`}
                  style={{ width: `${ward.percentage}%` }}
                />
              </div>
              <span className="text-xs font-semibold w-8 text-right">{ward.percentage}%</span>
              {ward.percentage >= 80 && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}