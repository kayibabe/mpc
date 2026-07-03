import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { DollarSign, TrendingUp } from "lucide-react";

export default function RevenueBreakdown() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  useEffect(() => {
    async function fetchRevenue() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const allInvoices = await base44.entities.Invoice.list("-created_date", 1000);
        const invoices = allInvoices.filter(i => {
          const d = i.created_date?.substring(0, 10);
          return d && d >= thirtyDaysAgo && d <= today &&
            (i.status === "paid" || i.status === "partial");
        });

        const byMethod = {};
        invoices.forEach(inv => {
          const method = inv.payment_type || "unknown";
          byMethod[method] = (byMethod[method] || 0) + (inv.net_amount || inv.total_amount || 0);
        });

        const chartData = Object.entries(byMethod).map(([method, amount]) => ({
          name: method.charAt(0).toUpperCase() + method.slice(1),
          value: Math.round(amount * 100) / 100,
        }));

        const totalAmount = chartData.reduce((sum, item) => sum + item.value, 0);
        setData(chartData);
        setTotal(totalAmount);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchRevenue();
  }, []);

  if (loading) return <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="stat-card bg-gradient-to-br from-white to-chart-1/5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <div className="p-2 rounded-lg bg-chart-1/10">
              <DollarSign className="w-5 h-5 text-chart-1" />
            </div>
            Revenue (Last 30 Days)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">By Payment Method</p>
        </div>
        {total > 0 && <TrendingUp className="w-5 h-5 text-chart-3 opacity-60" />}
      </div>
      <div className="text-3xl font-bold text-chart-1 mb-1">
        {new Intl.NumberFormat('en-MW', { style: 'currency', currency: 'MWK', maximumFractionDigits: 0 }).format(total)}
      </div>
      <p className="text-xs text-muted-foreground mb-4">Paid & partial invoices, last 30 days</p>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={60} fill="#8884d8" dataKey="value">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `MWK ${value.toFixed(0)}`} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-center py-8 text-sm text-muted-foreground">No revenue data in the last 30 days</p>
      )}
    </div>
  );
}