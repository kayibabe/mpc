import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Check, X, Loader2, AlertCircle } from "lucide-react";

export default function PharmacyRequisitionDashboard() {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [filter, setFilter] = useState("draft");

  useEffect(() => {
    async function fetchRequisitions() {
      try {
        const reqs = await base44.entities.PharmacyRequisition.filter(
          { status: filter },
          "-created_date",
          100
        );
        setRequisitions(reqs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchRequisitions();
  }, [filter]);

  const approveRequisition = async (id) => {
    setApproving(id);
    try {
      await base44.entities.PharmacyRequisition.update(id, {
        status: "approved",
        approved_by: (await base44.auth.me()).id,
        approved_date: new Date().toISOString(),
      });
      setRequisitions(
        requisitions.map(r => r.id === id ? { ...r, status: "approved" } : r)
      );
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(null);
    }
  };

  const rejectRequisition = async (id) => {
    setApproving(id);
    try {
      await base44.entities.PharmacyRequisition.update(id, { status: "rejected" });
      setRequisitions(requisitions.filter(r => r.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Loading requisitions...
      </div>
    );
  }

  const statusBadges = {
    draft: "bg-amber-50 border-amber-200 text-amber-900",
    approved: "bg-emerald-50 border-emerald-200 text-emerald-900",
    rejected: "bg-red-50 border-red-200 text-red-900",
    ordered: "bg-blue-50 border-blue-200 text-blue-900",
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Stock Requisitions
        </h3>
      </div>

      <div className="flex gap-2 mb-4">
        {["draft", "approved", "rejected", "ordered"].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === status
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {requisitions.length === 0 ? (
        <div className="py-8 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No {filter} requisitions
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Drug</th>
                <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Stock</th>
                <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Minimum</th>
                <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Qty to Order</th>
                <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Cost</th>
                {filter === "draft" && <th className="text-center py-2 px-3 font-semibold text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requisitions.map(req => (
                <tr key={req.id} className={`border-b border-border/40 hover:bg-muted/20 ${statusBadges[req.status]}`}>
                  <td className="py-2.5 px-3 font-medium">{req.drug_name}</td>
                  <td className="py-2.5 px-3 text-foreground">{req.current_stock}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{req.minimum_level}</td>
                  <td className="py-2.5 px-3 font-semibold">{req.reorder_quantity}</td>
                  <td className="py-2.5 px-3 text-right font-semibold">
                    {new Intl.NumberFormat('en-MW', { style: 'currency', currency: 'MWK', maximumFractionDigits: 0 }).format(req.total_cost || 0)}
                  </td>
                  {filter === "draft" && (
                    <td className="py-2.5 px-3 flex items-center justify-center gap-2">
                      <button
                        onClick={() => approveRequisition(req.id)}
                        disabled={approving === req.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500 text-white rounded text-xs font-medium hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {approving === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Approve
                      </button>
                      <button
                        onClick={() => rejectRequisition(req.id)}
                        disabled={approving === req.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-border rounded text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                      >
                        {approving === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        Reject
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}