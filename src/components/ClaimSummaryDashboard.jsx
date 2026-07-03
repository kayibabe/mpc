import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp, DollarSign, CheckCircle, Loader2, Download } from "lucide-react";

export default function ClaimSummaryDashboard() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      const data = await base44.entities.InsuranceClaim.list("-created_date", 200);
      setClaims(data);
      computeStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const computeStats = (claimList) => {
    const pending = claimList.filter(c => c.status === "pending");
    const submitted = claimList.filter(c => c.status === "submitted");
    const approved = claimList.filter(c => c.status === "approved");
    const paid = claimList.filter(c => c.status === "paid");
    const rejected = claimList.filter(c => c.status === "rejected");

    const totalClaimed = claimList.reduce((sum, c) => sum + (c.claim_amount || 0), 0);
    const totalApproved = approved.reduce((sum, c) => sum + (c.claim_amount || 0), 0);
    const totalPaid = paid.reduce((sum, c) => sum + (c.claim_amount || 0), 0);

    setStats({
      total: claimList.length,
      pending: pending.length,
      submitted: submitted.length,
      approved: approved.length,
      paid: paid.length,
      rejected: rejected.length,
      totalClaimed,
      totalApproved,
      totalPaid,
      pendingAmount: pending.reduce((sum, c) => sum + (c.claim_amount || 0), 0),
      approvalRate: claimList.length > 0 ? Math.round((approved.length / claimList.length) * 100) : 0,
      paymentRate: claimList.length > 0 ? Math.round((paid.length / claimList.length) * 100) : 0
    });
  };

  const handleExportSummary = async () => {
    setExporting(true);
    try {
      const { data } = await base44.functions.invoke("automateClaimExports", {
        format: "summary"
      });

      // Download CSV
      const blob = new Blob([data.csv_data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `claims_summary_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border/60 p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Claims</p>
          <p className="text-2xl font-bold text-primary mt-1">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground mt-1">All statuses</p>
        </div>

        <div className="bg-card rounded-lg border border-border/60 p-4">
          <p className="text-xs text-muted-foreground font-medium">Pending Review</p>
          <p className="text-2xl font-bold text-chart-4 mt-1">{stats.pending}</p>
          <p className="text-[10px] text-muted-foreground mt-1">MWK {(stats.pendingAmount || 0).toLocaleString()}</p>
        </div>

        <div className="bg-card rounded-lg border border-border/60 p-4">
          <p className="text-xs text-muted-foreground font-medium">Approval Rate</p>
          <p className="text-2xl font-bold text-chart-3 mt-1">{stats.approvalRate}%</p>
          <p className="text-[10px] text-muted-foreground mt-1">{stats.approved} approved</p>
        </div>

        <div className="bg-card rounded-lg border border-border/60 p-4">
          <p className="text-xs text-muted-foreground font-medium">Rejection Rate</p>
          <p className="text-2xl font-bold text-destructive mt-1">
            {stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">{stats.rejected} rejected</p>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Total Claimed</p>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-primary font-mono">MWK {(stats.totalClaimed || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">{stats.total} claims submitted</p>
        </div>

        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Approved Amount</p>
            <CheckCircle className="w-4 h-4 text-chart-3" />
          </div>
          <p className="text-2xl font-bold text-chart-3 font-mono">MWK {(stats.totalApproved || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">{stats.approved} claims approved</p>
        </div>

        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Paid Amount</p>
            <TrendingUp className="w-4 h-4 text-chart-2" />
          </div>
          <p className="text-2xl font-bold text-chart-2 font-mono">MWK {(stats.totalPaid || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">{stats.paymentRate}% payment completion</p>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
        <h3 className="font-heading text-lg font-semibold mb-4">Status Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Pending", count: stats.pending, color: "bg-chart-4/10 text-chart-4" },
            { label: "Submitted", count: stats.submitted, color: "bg-chart-1/10 text-chart-1" },
            { label: "Approved", count: stats.approved, color: "bg-chart-3/10 text-chart-3" },
            { label: "Paid", count: stats.paid, color: "bg-chart-2/10 text-chart-2" },
            { label: "Rejected", count: stats.rejected, color: "bg-destructive/10 text-destructive" }
          ].map((s) => (
            <div key={s.label} className={`p-3 rounded-lg text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-xs font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Export Action */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Export Claims Summary</p>
          <p className="text-xs text-muted-foreground mt-0.5">Download CSV report of all claims by scheme</p>
        </div>
        <button
          onClick={handleExportSummary}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>
    </div>
  );
}