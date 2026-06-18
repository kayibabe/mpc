import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, CheckCircle, Clock, AlertCircle } from "lucide-react";

export default function BookingRequisitionStatus({ bookingId, onRequestClick }) {
  const [requisition, setRequisition] = useState(null);
  const [dispensing, setDispensing] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [bookingId]);

  const loadData = async () => {
    try {
      const reqs = await base44.entities.SurgicalRequisition.filter(
        { booking_id: bookingId },
        "-created_date",
        1
      );
      if (reqs.length > 0) {
        setRequisition(reqs[0]);
        const disp = await base44.entities.SurgicalDispensing.filter(
          { requisition_id: reqs[0].id },
          "",
          100
        );
        setDispensing(disp);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return null;

  if (!requisition) {
    return (
      <button
        onClick={onRequestClick}
        className="px-2 py-1 bg-primary/10 text-primary rounded text-[10px] font-medium hover:bg-primary/20 flex items-center gap-1"
      >
        <Package className="w-3 h-3" /> Request Supplies
      </button>
    );
  }

  const dispensed = dispensing.filter(d => d.status === "received" || d.status === "used").length;
  const progress = requisition.total_items > 0 ? Math.round((dispensed / requisition.total_items) * 100) : 0;

  const statusIcon = 
    requisition.status === "completed" ? <CheckCircle className="w-3 h-3 text-chart-3" /> :
    requisition.status === "approved" || requisition.status === "partial" ? <Clock className="w-3 h-3 text-chart-2" /> :
    <AlertCircle className="w-3 h-3 text-muted-foreground" />;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {statusIcon}
        <span className={`text-[10px] font-medium ${
          requisition.status === "completed" ? "text-chart-3" :
          requisition.status === "approved" || requisition.status === "partial" ? "text-chart-2" :
          "text-muted-foreground"
        }`}>
          {dispensed}/{requisition.total_items}
        </span>
      </div>
      {progress < 100 && (
        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              requisition.status === "completed" ? "bg-chart-3" : "bg-chart-2"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}