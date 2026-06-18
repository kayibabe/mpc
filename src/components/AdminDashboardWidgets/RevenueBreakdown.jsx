import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { DollarSign } from "lucide-react";

export default function RevenueBreakdown() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  useEffect(() => {
    async function fetchRevenue() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const invoices = await base44.entities.Invoice.filter(
          { created_date: { $gte: `${today}T00:00:00Z` }, status: { $in: ["paid", "partial"] } },
          "-created_date",
          500
        );

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
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-chart-1" />
          Daily Revenue by Payment Method
        </h3>
      </div>
      <div className="text-2xl font-bold text-chart-1 mb-4">
        {new Intl.NumberFormat('en-MW', { style: 'currency', currency: 'MWK', maximumFractionDigits: 0 }).format(total)}
      </div>
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
        <p className="text-center py-8 text-sm text-muted-foreground">No revenue data for today</p>
      )}
    </div>
  );
}