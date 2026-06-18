import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DollarSign, Receipt, TrendingUp, AlertCircle } from "lucide-react";

export default function CashierDashboard() {
  const [stats, setStats] = useState({ totalRevenue: 0, pendingPayments: 0, shiftsOpen: 0, discrepancies: 0 });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [invoices, payments, shifts] = await Promise.all([
          base44.entities.Invoice.filter({ created_date: { $gte: today } }, "-created_date", 50),
          base44.entities.Payment.filter({ payment_date: today }, "", 100),
          base44.entities.CashierShift.filter({ shift_date: today, status: { $in: ["open", "active"] } }, "", 10),
        ]);

        const totalRev = invoices
          .filter(inv => inv.status === "paid")
          .reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);

        const pending = invoices.filter(inv => inv.status === "pending" || inv.status === "partial");
        
        setStats({
          totalRevenue: totalRev,
          pendingPayments: pending.length,
          shiftsOpen: shifts.length,
          discrepancies: 0,
        });
        setRecentInvoices(invoices.slice(0, 6));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Cashier Dashboard</h2>
        <a href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">
          📊 Go to Dashboard
        </a>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Daily Revenue Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Today's Revenue</p>
                <p className="text-2xl font-bold">MWK {(stats.totalRevenue).toLocaleString()}</p>
              </div>
              <DollarSign className="w-5 h-5 text-chart-3" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Payments</p>
                <p className="text-2xl font-bold">{stats.pendingPayments}</p>
              </div>
              <Receipt className="w-5 h-5 text-chart-2" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Shifts</p>
                <p className="text-2xl font-bold">{stats.shiftsOpen}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Discrepancies</p>
                <p className="text-2xl font-bold text-destructive">{stats.discrepancies}</p>
              </div>
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border p-5">
        <h3 className="font-semibold text-sm mb-4">Recent Invoices</h3>
        {recentInvoices.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No invoices today</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-muted-foreground"><th className="text-left py-2">Invoice</th><th className="text-left py-2">Amount (MWK)</th><th className="text-left py-2">Status</th></tr></thead>
              <tbody>
                {recentInvoices.map(inv => (
                  <tr key={inv.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2 font-mono">{inv.invoice_number || inv.id?.slice(0, 8)}</td>
                    <td className="py-2 font-semibold">{(inv.net_amount || 0).toLocaleString()}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        inv.status === "paid" ? "bg-chart-3/10 text-chart-3" :
                        inv.status === "partial" ? "bg-chart-2/10 text-chart-2" :
                        "bg-muted/60 text-muted-foreground"
                      }`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}