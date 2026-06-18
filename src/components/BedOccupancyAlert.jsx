import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BedDouble, AlertTriangle, X } from "lucide-react";

export default function BedOccupancyAlert({ threshold = 80 }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const [wards, beds] = await Promise.all([
          base44.entities.Ward.list("", 20),
          base44.entities.Bed.list("", 300),
        ]);
        const wardAlerts = wards.map(w => {
          const wardBeds = beds.filter(b => b.ward_id === w.id);
          if (wardBeds.length === 0) return null;
          const occupied = wardBeds.filter(b => b.status === "occupied").length;
          const pct = Math.round((occupied / wardBeds.length) * 100);
          if (pct >= threshold) return { ward: w.name, occupied, total: wardBeds.length, pct };
          return null;
        }).filter(Boolean);
        setAlerts(wardAlerts);
      } catch (_) {}
    }
    check();
    const interval = setInterval(check, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, [threshold]);

  if (alerts.length === 0 || dismissed) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-orange-800 mb-1">
          <BedDouble className="w-3.5 h-3.5 inline mr-1" /> Bed Occupancy Alert — {alerts.length} ward{alerts.length > 1 ? "s" : ""} at ≥{threshold}%
        </p>
        <div className="flex flex-wrap gap-2">
          {alerts.map(a => (
            <span key={a.ward} className="text-[11px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              {a.ward}: {a.occupied}/{a.total} beds ({a.pct}%)
            </span>
          ))}
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="text-orange-400 hover:text-orange-600 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}