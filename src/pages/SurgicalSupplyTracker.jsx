import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Filter, Download } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const STATUS_FLOW = ["pending", "dispensed", "received", "used", "returned"];
const STATUS_COLORS = {
  pending: "bg-chart-1/10 text-chart-1",
  dispensed: "bg-chart-2/10 text-chart-2",
  received: "bg-chart-3/10 text-chart-3",
  used: "bg-primary/10 text-primary",
  returned: "bg-muted text-muted-foreground",
  damaged: "bg-destructive/10 text-destructive",
};

export default function SurgicalSupplyTracker() {
  const [dispensing, setDispensing] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBooking, setFilterBooking] = useState("");
  const [view, setView] = useState("timeline");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [disp, booking, supply] = await Promise.all([
        base44.entities.SurgicalDispensing.list("-created_date", 500),
        base44.entities.SurgicalBooking.list("", 200),
        base44.entities.Drug.filter({ category: { $in: ["surgical", "instruments", "implants"] } }, "", 500),
      ]);
      setDispensing(disp);
      setBookings(booking);
      setSupplies(supply);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getBookingInfo = (bookingId) => {
    const b = bookings.find(x => x.id === bookingId);
    return b ? `${b.procedure_name} (${b.scheduled_date})` : "Unknown";
  };

  const filteredDispensing = dispensing.filter(d => {
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterBooking && d.booking_id !== filterBooking) return false;
    return true;
  });

  const exportToSheets = async () => {
    try {
      const { data } = await base44.functions.invoke('syncSurgicalRecordsToSheets', { sync_type: 'dispensing' });
      if (data?.data) {
        const headers = data.headers;
        const csv = [
          headers.join(','),
          ...data.data.map(row => headers.map(h => JSON.stringify(row[h] || '').replace(/"/g, '""')).join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `surgical_dispensing_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { alert('Export failed: ' + e.message); }
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const byStatus = {};
  STATUS_FLOW.forEach(s => { byStatus[s] = filteredDispensing.filter(d => d.status === s).length; });

  return (
    <div className="page-container">
      <PageHeader title="Surgical Supply Tracker" subtitle="Track supplies through requisition, dispensing, and usage" icon={Package} className="mb-6">
        <button
          onClick={exportToSheets}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </PageHeader>

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {STATUS_FLOW.map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
            className={`p-4 rounded-lg border-2 transition-colors ${
              filterStatus === status
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/30"
            }`}
          >
            <p className="text-2xl font-bold">{byStatus[status]}</p>
            <p className="text-xs text-muted-foreground capitalize mt-1">{status}</p>
          </button>
        ))}
      </div>

      {/* Filters & View Toggle */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterBooking}
            onChange={e => setFilterBooking(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Bookings</option>
            {bookings.map(b => (
              <option key={b.id} value={b.id}>
                {b.procedure_name} ({b.scheduled_date})
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setView("timeline")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              view === "timeline"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              view === "grid"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Timeline View */}
      {view === "timeline" && (
        <div className="space-y-2">
          {filteredDispensing.length === 0 ? (
            <div className="bg-card rounded-xl border border-border/60 p-12 text-center">
              <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No supplies match the selected filter.</p>
            </div>
          ) : (
            filteredDispensing.map(d => (
              <div key={d.id} className="bg-card rounded-lg border border-border/60 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{d.item_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{getBookingInfo(d.booking_id)}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${STATUS_COLORS[d.status] || STATUS_COLORS.pending}`}>
                    {d.status}
                  </span>
                </div>

                {/* Flow Diagram */}
                <div className="flex items-center gap-1 mb-3 text-[10px]">
                  {STATUS_FLOW.map((s, idx) => {
                    const isActive = STATUS_FLOW.indexOf(d.status) >= idx;
                    return (
                      <div key={s} className="flex items-center gap-1">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                          isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                        }`}>
                          {s.charAt(0)}
                        </div>
                        {idx < STATUS_FLOW.length - 1 && (
                          <div className={`w-4 h-0.5 ${isActive ? "bg-primary" : "bg-muted"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-muted-foreground">
                  <div>
                    <p className="font-semibold text-foreground">{d.quantity_dispensed || 0}/{d.quantity_requested}</p>
                    <p>Qty</p>
                  </div>
                  {d.dispensed_by_name && (
                    <div>
                      <p className="font-semibold text-foreground">{d.dispensed_by_name}</p>
                      <p>Dispensed</p>
                    </div>
                  )}
                  {d.received_by_name && (
                    <div>
                      <p className="font-semibold text-foreground">{d.received_by_name}</p>
                      <p>Received</p>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-foreground">{new Date(d.created_date).toLocaleDateString("en-GB")}</p>
                    <p>Created</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Grid View */}
      {view === "grid" && (
        <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
          {filteredDispensing.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No supplies match the selected filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Item</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Procedure</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Qty</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Dispensed By</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredDispensing.map(d => (
                    <tr key={d.id} className="hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium">{d.item_name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{d.booking_id?.slice(0, 8)}</td>
                      <td className="py-2 px-3 text-center">{d.quantity_dispensed || 0}/{d.quantity_requested}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[d.status] || STATUS_COLORS.pending}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{d.dispensed_by_name || "—"}</td>
                      <td className="py-2 px-3 text-muted-foreground">{new Date(d.created_date).toLocaleDateString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}