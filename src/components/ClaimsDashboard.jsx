import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, CheckCircle, Clock, DollarSign, Loader2 } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(194, 65%, 42%)", "hsl(38, 92%, 50%)", "hsl(160, 60%, 40%)", "hsl(280, 50%, 50%)", "hsl(340, 65%, 50%)"];

export default function ClaimsDashboard() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [stats, setStats] = useState({});
  const [trendData, setTrendData] = useState([]);
  const [schemeData, setSchemeData] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await base44.entities.InsuranceClaim.list("-created_date", 200);
      setClaims(data);
      computeStats(data);
      computeTrendData(data);
      computeSchemeData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const computeStats = (claimList) => {
    const newStats = {
      total: claimList.length,
      pending: claimList.filter(c => c.status === "pending").length,
      submitted: claimList.filter(c => c.status === "submitted").length,
      approved: claimList.filter(c => c.status === "approved").length,
      paid: claimList.filter(c => c.status === "paid").length,
      rejected: claimList.filter(c => c.status === "rejected").length,
      avgClaimTime: calculateAvgClaimTime(claimList),
      totalClaimed: claimList.reduce((sum, c) => sum + (c.claim_amount || 0), 0),
      paidAmount: claimList.filter(c => c.status === "paid").reduce((sum, c) => sum + (c.claim_amount || 0), 0),
      approvalRate: claimList.length > 0 ? Math.round((claimList.filter(c => c.status === "approved" || c.status === "paid").length / claimList.length) * 100) : 0
    };
    setStats(newStats);
  };

  const calculateAvgClaimTime = (claimList) => {
    const submittedClaims = claimList.filter(c => c.submitted_date && c.response_date);
    if (submittedClaims.length === 0) return 0;
    const totalDays = submittedClaims.reduce((sum, c) => {
      const days = (new Date(c.response_date) - new Date(c.submitted_date)) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    return Math.round(totalDays / submittedClaims.length);
  };

  const computeTrendData = (claimList) => {
    const last30Days = {};
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString("en-GB");
      last30Days[dateStr] = { date: dateStr, count: 0, amount: 0 };
    }

    claimList.forEach(c => {
      const dateObj = c.submitted_date ? new Date(c.submitted_date) : new Date(c.created_date);
      const dateStr = dateObj.toLocaleDateString("en-GB");
      if (last30Days[dateStr]) {
        last30Days[dateStr].count++;
        last30Days[dateStr].amount += c.claim_amount || 0;
      }
    });

    setTrendData(Object.values(last30Days).filter(d => d.count > 0));
  };

  const computeSchemeData = (claimList) => {
    const byScheme = {};
    claimList.forEach(c => {
      if (!byScheme[c.scheme_name]) {
        byScheme[c.scheme_name] = 0;
      }
      byScheme[c.scheme_name]++;
    });

    setSchemeData(
      Object.entries(byScheme)
        .map(([name, count]) => ({ name, value: count }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    );
  };

  const handleBulkValidate = async () => {
    setValidating(true);
    try {
      const { data } = await base44.functions.invoke("bulkValidateClaims", {
        claim_ids: claims.map(c => c.id),
        auto_fix: true
      });
      alert(`✅ Validation Complete\n\n${data.valid} valid\n${data.invalid} invalid\n${data.fixed} fixed`);
      await loadData();
    } catch (e) {
      alert("Validation failed: " + e.message);
    } finally {
      setValidating(false);
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
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card rounded-lg border border-border/60 p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Claims</p>
        </div>
        <div className="bg-card rounded-lg border border-border/60 p-4 text-center">
          <p className="text-2xl font-bold text-chart-4">{stats.pending}</p>
          <p className="text-xs text-muted-foreground mt-1">Pending</p>
        </div>
        <div className="bg-card rounded-lg border border-border/60 p-4 text-center">
          <p className="text-2xl font-bold text-chart-1">{stats.submitted}</p>
          <p className="text-xs text-muted-foreground mt-1">Submitted</p>
        </div>
        <div className="bg-card rounded-lg border border-border/60 p-4 text-center">
          <p className="text-2xl font-bold text-chart-3">{stats.paid}</p>
          <p className="text-xs text-muted-foreground mt-1">Paid</p>
        </div>
        <div className="bg-card rounded-lg border border-border/60 p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
          <p className="text-xs text-muted-foreground mt-1">Rejected</p>
        </div>
        <div className="bg-card rounded-lg border border-border/60 p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stats.approvalRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">Approval Rate</p>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground">Total Claimed</p>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-primary">MWK {(stats.totalClaimed || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">All claims combined</p>
        </div>

        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground">Paid Amount</p>
            <CheckCircle className="w-4 h-4 text-chart-3" />
          </div>
          <p className="text-2xl font-bold text-chart-3">MWK {(stats.paidAmount || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">Successfully paid</p>
        </div>

        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground">Avg Processing Time</p>
            <Clock className="w-4 h-4 text-chart-1" />
          </div>
          <p className="text-2xl font-bold text-chart-1">{stats.avgClaimTime || 0}</p>
          <p className="text-xs text-muted-foreground mt-2">Days to approval</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <h3 className="font-heading text-lg font-semibold mb-4">Claims Trend (30 Days)</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-1))" name="Count" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">No trend data</p>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <h3 className="font-heading text-lg font-semibold mb-4">Top Schemes</h3>
          {schemeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={schemeData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {schemeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">No scheme data</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Data Quality & Validation</p>
            <p className="text-xs text-muted-foreground mt-1">Validate all claims and auto-fix common issues</p>
          </div>
          <button
            onClick={handleBulkValidate}
            disabled={validating || stats.total === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            {validating ? "Validating..." : "Validate All Claims"}
          </button>
        </div>
      </div>
    </div>
  );
}