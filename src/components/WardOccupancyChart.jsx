import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BedDouble, RefreshCw } from "lucide-react";

const COLORS = ["hsl(var(--destructive))", "hsl(var(--primary))", "hsl(var(--muted))"];

export default function WardOccupancyChart({ compact = false }) {
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [wardData, bedData] = await Promise.all([
        base44.entities.Ward.list("", 50),
        base44.entities.Bed.list("", 500),
      ]);
      setWards(wardData);
      setBeds(bedData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const wardData = wards.map(ward => {
    const wardBeds = beds.filter(b => b.ward_id === ward.id);
    const occupied = wardBeds.filter(b => b.status === "occupied").length;
    const available = wardBeds.length - occupied;
    const maintenance = wardBeds.filter(b => b.status === "maintenance").length;

    return {
      name: ward.name,
      occupied: occupied,
      available: available,
      maintenance: maintenance,
      total: wardBeds.length,
      occupancy_rate: wardBeds.length > 0 ? ((occupied / wardBeds.length) * 100).toFixed(0) : 0,
    };
  });

  const totalBeds = beds.length;
  const totalOccupied = beds.filter(b => b.status === "occupied").length;
  const totalAvailable = beds.filter(b => b.status === "available").length;
  const totalMaintenance = beds.filter(b => b.status === "maintenance").length;

  const totalData = [
    { name: "Occupied", value: totalOccupied },
    { name: "Available", value: totalAvailable },
    { name: "Maintenance", value: totalMaintenance },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-heading font-semibold text-sm flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-primary" /> Ward Occupancy
          </h4>
          <button onClick={loadData} className="p-1 rounded hover:bg-muted">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="p-2 bg-destructive/5 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground">Occupied</p>
            <p className="text-lg font-bold text-destructive mt-1">{totalOccupied}</p>
          </div>
          <div className="p-2 bg-primary/5 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground">Available</p>
            <p className="text-lg font-bold text-primary mt-1">{totalAvailable}</p>
          </div>
          <div className="p-2 bg-muted/30 rounded-lg text-center">
            <p className="text-[10px] text-muted-foreground">Maintenance</p>
            <p className="text-lg font-bold mt-1">{totalMaintenance}</p>
          </div>
        </div>

        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wardData.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="occupied" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="available" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="maintenance" stackId="a" fill="hsl(var(--muted))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Stats */}
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <h4 className="font-heading font-semibold text-sm mb-4">Overall Bed Status</h4>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 bg-destructive/5 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Occupied</p>
              <p className="text-2xl font-bold text-destructive mt-1">{totalOccupied}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{((totalOccupied / totalBeds) * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 bg-primary/5 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-2xl font-bold text-primary mt-1">{totalAvailable}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{((totalAvailable / totalBeds) * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Maintenance</p>
              <p className="text-2xl font-bold mt-1">{totalMaintenance}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{((totalMaintenance / totalBeds) * 100).toFixed(0)}%</p>
            </div>
          </div>

          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={totalData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {totalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Occupancy Trend */}
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <h4 className="font-heading font-semibold text-sm mb-4">By Ward</h4>
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="occupied" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="available" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Ward Details Table */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
        <h4 className="font-heading font-semibold text-sm mb-4">Ward Details</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Ward</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Occupied</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Available</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Rate</th>
              </tr>
            </thead>
            <tbody>
              {wardData.map(ward => (
                <tr key={ward.name} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2 px-3 font-medium">{ward.name}</td>
                  <td className="py-2 px-3">{ward.total}</td>
                  <td className="py-2 px-3 font-semibold text-destructive">{ward.occupied}</td>
                  <td className="py-2 px-3 text-primary">{ward.available}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            parseInt(ward.occupancy_rate) >= 80 ? "bg-destructive" :
                            parseInt(ward.occupancy_rate) >= 60 ? "bg-chart-2" :
                            "bg-chart-3"
                          }`}
                          style={{ width: `${ward.occupancy_rate}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs">{ward.occupancy_rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}