import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp, Receipt, Building2, Loader2, RefreshCw, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const PIE_COLORS = ["hsl(194, 65%, 42%)", "hsl(38, 92%, 50%)", "hsl(160, 60%, 40%)", "hsl(280, 50%, 50%)", "hsl(340, 65%, 50%)"];

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "7days", label: "7 Days" },
  { key: "30days", label: "30 Days" },
  { key: "90days", label: "90 Days" },
  { key: "year", label: "This Year" },
];

export default function RevenueReport() {
  const [period, setPeriod] = useState("30days");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async (p) => {
    setLoading(true);
    try {
      const { data: result } = await base44.functions.invoke("generateRevenueReport", { period: p });
      setData(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(period); }, [period]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              period === p.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button onClick={() => fetchReport(period)} className="ml-auto p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="stat-card p-3">
          <p className="text-[10px] text-muted-foreground">Revenue (MWK)</p>
          <p className="text-xl font-bold text-primary">{data?.summary.total_revenue?.toLocaleString()}</p>
        </div>
        <div className="stat-card p-3">
          <p className="text-[10px] text-muted-foreground">Collected</p>
          <p className="text-xl font-bold text-chart-3">{data?.summary.total_collected?.toLocaleString()}</p>
        </div>
        <div className="stat-card p-3">
          <p className="text-[10px] text-muted-foreground">Outstanding</p>
          <p className="text-xl font-bold text-destructive">{data?.summary.total_outstanding?.toLocaleString()}</p>
        </div>
        <div className="stat-card p-3">
          <p className="text-[10px] text-muted-foreground">Invoices</p>
          <p className="text-xl font-bold">{data?.summary.total_invoices}</p>
        </div>
        <div className="stat-card p-3">
          <p className="text-[10px] text-muted-foreground">Collection Rate</p>
          <p className={`text-xl font-bold ${(data?.summary.collection_rate || 0) >= 80 ? "text-chart-3" : "text-chart-2"}`}>{data?.summary.collection_rate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Daily Trend */}
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Daily Revenue Trend
          </h4>
          {data?.daily_trend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.daily_trend.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`MWK ${v.toLocaleString()}`, "Revenue"]} labelFormatter={l => `Date: ${l}`} />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-xs text-muted-foreground">No data for this period.</p>
          )}
        </div>

        {/* Revenue by Department */}
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-chart-4" /> Revenue by Department
          </h4>
          {data?.by_department?.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.by_department} layout="vertical" margin={{ left: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="department" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={70} />
                <Tooltip formatter={v => [`MWK ${v.toLocaleString()}`, "Revenue"]} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {data.by_department.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-xs text-muted-foreground">No department data.</p>
          )}
        </div>

        {/* Revenue by Payment Type */}
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-chart-2" /> Revenue by Payment Type
          </h4>
          {data?.by_payment_type?.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={data.by_payment_type} dataKey="amount" nameKey="type" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                    {data.by_payment_type.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => [`MWK ${v.toLocaleString()}`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 text-xs">
                {data.by_payment_type.map((pt, i) => (
                  <div key={pt.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="capitalize">{pt.type}</span>
                    </div>
                    <span className="font-semibold">MWK {pt.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-12 text-center text-xs text-muted-foreground">No payment data.</p>
          )}
        </div>

        {/* Insurance Claims */}
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-chart-5" /> Insurance Claims
          </h4>
          {data?.insurance_claims ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-chart-3/10 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-chart-3">{data.insurance_claims.approved}</p>
                  <p className="text-[10px] text-muted-foreground">Approved</p>
                </div>
                <div className="bg-chart-2/10 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-chart-2">{data.insurance_claims.pending}</p>
                  <p className="text-[10px] text-muted-foreground">Pending</p>
                </div>
                <div className="bg-destructive/10 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-destructive">{data.insurance_claims.rejected}</p>
                  <p className="text-[10px] text-muted-foreground">Rejected</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs bg-muted/20 rounded-lg p-2">
                <span className="text-muted-foreground">Total Claim Value</span>
                <span className="font-bold">MWK {data.insurance_claims.totalAmount?.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-chart-3/10 rounded-lg p-2">
                <span className="text-muted-foreground">Approved Value</span>
                <span className="font-bold text-chart-3">MWK {data.insurance_claims.approvedAmount?.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <p className="py-12 text-center text-xs text-muted-foreground">No claims data.</p>
          )}
        </div>
      </div>
    </div>
  );
}