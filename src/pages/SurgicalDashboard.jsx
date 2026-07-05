import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, AlertTriangle, Clock, CheckCircle2, Plus, Eye, Zap } from "lucide-react";
import SurgicalRequisitionModal from "@/components/SurgicalRequisitionModal";
import PageHeader from "@/components/ui/PageHeader";

export default function SurgicalDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [dispensing, setDispensing] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [stats, setStats] = useState({ pending: 0, dispensed: 0, lowStock: 0, urgent: 0 });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      setCurrentUser(u);

      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

      const [book, req, disp, inv] = await Promise.all([
        base44.entities.SurgicalBooking.filter({ 
          scheduled_date: { $in: [today, tomorrow] },
          status: { $in: ["scheduled", "confirmed", "in_progress"] }
        }, "-scheduled_date", 50),
        base44.entities.SurgicalRequisition.filter({ status: { $in: ["draft", "submitted", "partial"] } }, "-created_date", 100),
        base44.entities.SurgicalDispensing.filter({ status: { $in: ["pending", "dispensed", "received"] } }, "-created_date", 100),
        base44.entities.Drug.filter({}, "", 500),
      ]);

      setBookings(book);
      setRequisitions(req);
      setDispensing(disp);
      setInventory(inv);

      const pending = req.filter(r => r.status === "submitted").length;
      const dispensed = disp.filter(d => d.status === "dispensed").length;
      const lowStock = inv.filter(dr => dr.quantity_in_stock <= (dr.reorder_level || 10)).length;
      const urgent = req.filter(r => r.priority === "urgent").length;

      setStats({ pending, dispensed, lowStock, urgent });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getPendingItemsForBooking = (bookingId) => {
    return requisitions.filter(r => r.booking_id === bookingId && r.status !== "completed");
  };

  const getDispensingForBooking = (bookingId) => {
    return dispensing.filter(d => d.booking_id === bookingId);
  };

  if (loading) {
    return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="page-container">
      {/* Header */}
      <PageHeader title="Surgery Team Dashboard" subtitle="Real-time supply tracking & requisition management" icon={Package} className="mb-8">
        {currentUser && (
          <div className="text-right">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Logged in as</p>
            <p className="text-sm font-semibold">{currentUser?.display_name || currentUser?.full_name || currentUser?.email}</p>
          </div>
        )}
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Pending Requests</p>
              <p className="text-2xl font-bold mt-1">{stats.pending}</p>
            </div>
            <Clock className="w-5 h-5 text-chart-2" />
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Dispensed Today</p>
              <p className="text-2xl font-bold mt-1 text-chart-3">{stats.dispensed}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-chart-3" />
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Low Stock Items</p>
              <p className="text-2xl font-bold mt-1 text-destructive">{stats.lowStock}</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Urgent Reqs</p>
              <p className="text-2xl font-bold mt-1 text-chart-2">{stats.urgent}</p>
            </div>
            <Zap className="w-5 h-5 text-chart-2" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Surgeries & Requisitions */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Today & Tomorrow's Surgeries</h3>
              <button
                onClick={() => setShowRequisitionModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90"
              >
                <Plus className="w-3.5 h-3.5" /> New Request
              </button>
            </div>

            {bookings.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No surgeries scheduled</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map(booking => {
                  const pendingItems = getPendingItemsForBooking(booking.id);
                  const dispensedItems = getDispensingForBooking(booking.id);
                  return (
                    <div
                      key={booking.id}
                      className="p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedBooking(selectedBooking?.id === booking.id ? null : booking)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold">{booking.procedure_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {booking.scheduled_date} @ {booking.start_time} • {booking.theater_room || "TBD"}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                          booking.status === "in_progress" ? "bg-chart-3/10 text-chart-3" :
                          booking.status === "confirmed" ? "bg-primary/10 text-primary" :
                          "bg-muted/60"
                        }`}>
                          {booking.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-[11px]">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-foreground">{pendingItems.length}</span>
                          <span className="text-muted-foreground">Pending</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-chart-3">{dispensedItems.length}</span>
                          <span className="text-muted-foreground">Dispensed</span>
                        </div>
                      </div>

                      {selectedBooking?.id === booking.id && (
                        <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold">Pending Items:</p>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setShowRequisitionModal(true);
                              }}
                              className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
                            >
                              + Add Item
                            </button>
                          </div>
                          {pendingItems.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground">No pending items</p>
                          ) : (
                            <div className="space-y-1">
                              {pendingItems.map(req => {
                                const items = JSON.parse(req.items || "[]");
                                return items.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-[10px] bg-muted/20 p-2 rounded">
                                    <span className="truncate">{item.item_name}</span>
                                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                                      req.priority === "urgent" ? "bg-chart-2/20 text-chart-2" :
                                      req.priority === "emergency" ? "bg-destructive/20 text-destructive" :
                                      "bg-primary/20 text-primary"
                                    }`}>
                                      {req.status}
                                    </span>
                                  </div>
                                ));
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pharmacy Inventory Status */}
        <div className="bg-white rounded-lg border border-border p-6 h-fit">
          <h3 className="font-semibold text-lg mb-4">Pharmacy Inventory</h3>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {inventory
              .filter(d => d.quantity_in_stock <= (d.reorder_level || 10) || d.quantity_in_stock === 0)
              .slice(0, 15)
              .map(drug => (
                <div key={drug.id} className="p-2 border border-border/50 rounded-lg">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold truncate flex-1">{drug.drug_name}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      drug.quantity_in_stock === 0 ? "bg-destructive/20 text-destructive" :
                      drug.quantity_in_stock <= 5 ? "bg-chart-2/20 text-chart-2" :
                      "bg-chart-3/20 text-chart-3"
                    }`}>
                      {drug.quantity_in_stock}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        drug.quantity_in_stock === 0 ? "bg-destructive" :
                        drug.quantity_in_stock <= 5 ? "bg-chart-2" :
                        "bg-chart-3"
                      }`}
                      style={{ width: `${Math.min(100, (drug.quantity_in_stock / (drug.reorder_level || 10)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    Reorder: {drug.reorder_level || 10}
                  </p>
                </div>
              ))}
            {inventory.filter(d => d.quantity_in_stock <= (d.reorder_level || 10)).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">All items in stock</p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border/50">
            <a href="/pharmacy" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              <Eye className="w-3.5 h-3.5" /> View Full Inventory
            </a>
          </div>
        </div>
      </div>

      {/* Recent Dispensing Activity */}
      <div className="mt-8 bg-white rounded-lg border border-border p-6">
        <h3 className="font-semibold text-lg mb-4">Recent Dispensing Activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left py-2 px-3 font-semibold">Item</th>
                <th className="text-left py-2 px-3 font-semibold">Surgery</th>
                <th className="text-center py-2 px-3 font-semibold">Qty</th>
                <th className="text-left py-2 px-3 font-semibold">Dispensed By</th>
                <th className="text-left py-2 px-3 font-semibold">Status</th>
                <th className="text-left py-2 px-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {dispensing.slice(0, 10).map(d => (
                <tr key={d.id} className="hover:bg-muted/20">
                  <td className="py-2 px-3 font-medium">{d.item_name}</td>
                  <td className="py-2 px-3 text-muted-foreground">{d.booking_id?.slice(0, 8)}</td>
                  <td className="py-2 px-3 text-center font-semibold">{d.quantity_dispensed}/{d.quantity_requested}</td>
                  <td className="py-2 px-3 text-muted-foreground">{d.dispensed_by_name || "—"}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded-full font-semibold text-[9px] ${
                      d.status === "received" ? "bg-chart-3/10 text-chart-3" :
                      d.status === "dispensed" ? "bg-chart-2/10 text-chart-2" :
                      "bg-muted/60"
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{new Date(d.created_date).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Requisition Modal */}
      {showRequisitionModal && (
        <SurgicalRequisitionModal
          bookings={bookings}
          inventory={inventory}
          onClose={() => setShowRequisitionModal(false)}
          onSubmit={() => {
            setShowRequisitionModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}