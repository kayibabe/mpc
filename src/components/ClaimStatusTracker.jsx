import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Clock, AlertCircle, TrendingUp, Download, RotateCw, Loader2 } from "lucide-react";

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "text-chart-4", bg: "bg-chart-4/10", label: "Pending" },
  submitted: { icon: TrendingUp, color: "text-chart-1", bg: "bg-chart-1/10", label: "Submitted" },
  approved: { icon: CheckCircle, color: "text-chart-3", bg: "bg-chart-3/10", label: "Approved" },
  partial: { icon: AlertCircle, color: "text-chart-2", bg: "bg-chart-2/10", label: "Partial" },
  rejected: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Rejected" },
  paid: { icon: CheckCircle, color: "text-clinical-normal", bg: "bg-clinical-normal/10", label: "Paid" },
};

export default function ClaimStatusTracker({ compact = false }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [stats, setStats] = useState({});

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      const data = await base44.entities.InsuranceClaim.list("-created_date", 100);
      setClaims(data);
      updateStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (claimList) => {
    const newStats = {
      total: claimList.length,
      pending: claimList.filter(c => c.status === "pending").length,
      submitted: claimList.filter(c => c.status === "submitted").length,
      approved: claimList.filter(c => c.status === "approved").length,
      paid: claimList.filter(c => c.status === "paid").length,
      rejected: claimList.filter(c => c.status === "rejected").length,
      totalAmount: claimList.reduce((sum, c) => sum + (c.claim_amount || 0), 0),
      paidAmount: claimList.filter(c => c.status === "paid").reduce((sum, c) => sum + (c.claim_amount || 0), 0),
    };
    setStats(newStats);
  };

  const handleAutoSubmit = async () => {
    setAutoSubmitting(true);
    try {
      const { data } = await base44.functions.invoke("automateClaimSubmissions", {});
      alert(`✅ Automated Submission\n\n${data.submitted} claims submitted\n${data.failed} failed`);
      await loadClaims();
    } catch (e) {
      alert("Auto-submit failed: " + e.message);
    } finally {
      setAutoSubmitting(false);
    }
  };

  const handleSyncDrive = async () => {
    setSyncingDrive(true);
    try {
      const { data } = await base44.functions.invoke("syncClaimsToDrive", {
        status_filter: null
      });
      // Download CSV
      const blob = new Blob([data.csv_data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `claims_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      alert(`✅ Synced ${data.synced} claims${data.drive_connected ? ' to Google Drive' : ' (ready for download)'}`);
    } catch (e) {
      alert("Sync failed: " + e.message);
    } finally {
      setSyncingDrive(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{stats.pending || 0}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-chart-1">{stats.submitted || 0}</p>
            <p className="text-xs text-muted-foreground">Submitted</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-chart-3">{stats.paid || 0}</p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-primary/5 to-transparent p-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Insurance Claims Tracker
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleAutoSubmit}
              disabled={autoSubmitting || stats.pending === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-chart-1/10 text-chart-1 rounded-lg text-xs font-medium hover:bg-chart-1/20 disabled:opacity-50"
            >
              {autoSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
              Auto-Submit Pending
            </button>
            <button
              onClick={handleSyncDrive}
              disabled={syncingDrive || stats.total === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-chart-3/10 text-chart-3 rounded-lg text-xs font-medium hover:bg-chart-3/20 disabled:opacity-50"
            >
              {syncingDrive ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Export & Sync
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Claims", value: stats.total, color: "text-foreground" },
            { label: "Pending", value: stats.pending, color: "text-chart-4" },
            { label: "Submitted", value: stats.submitted, color: "text-chart-1" },
            { label: "Paid", value: stats.paid, color: "text-chart-3" },
          ].map((stat, i) => (
            <div key={i} className="text-sm">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {stats.totalAmount > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 text-sm">
            <p className="text-muted-foreground">
              Total Claimed: <span className="font-bold text-primary">MWK {(stats.totalAmount || 0).toLocaleString()}</span>
              {stats.paidAmount > 0 && (
                <span className="ml-4">
                  • Paid: <span className="font-bold text-chart-3">MWK {(stats.paidAmount || 0).toLocaleString()}</span>
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="p-5">
        <h4 className="font-medium text-sm mb-3">Status Breakdown</h4>
        <div className="space-y-2">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const count = stats[status] || 0;
            const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={status} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${config.color}`} />
                <span className="text-xs font-medium capitalize flex-1">{config.label}</span>
                <span className="text-xs font-bold">{count}</span>
                {percentage > 0 && (
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${config.bg}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}