import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Baby } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["hsl(var(--triage-emergency))", "hsl(var(--triage-urgent))", "hsl(var(--triage-semi))", "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--;
    months += 12;
  }
  if (today.getDate() < birthDate.getDate()) {
    months--;
  }
  return { years, months };
};

const getAgeGroup = (ageObj) => {
  if (!ageObj) return null;
  const totalMonths = ageObj.years * 12 + ageObj.months;
  if (totalMonths < 12) return "0-12 months";
  if (ageObj.years < 5) return "1-4 years";
  if (ageObj.years < 18) return "5-17 years";
  if (ageObj.years < 30) return "18-29 years";
  if (ageObj.years < 50) return "30-49 years";
  return "50+ years";
};

export default function PatientAgeBreakdown({ compact = false }) {
  const [data, setData] = useState([]);
  const [infantsDetail, setInfantsDetail] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const patients = await base44.entities.Patient.list("", 1000);
        const ageGroups = {};
        const infantsList = [];

        patients.forEach(p => {
          const ageObj = calculateAge(p.date_of_birth);
          if (!ageObj) return;
          
          const group = getAgeGroup(ageObj);
          ageGroups[group] = (ageGroups[group] || 0) + 1;

          // Collect infants for detail view
          if (ageObj.years === 0) {
            infantsList.push({
              name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
              months: ageObj.months,
            });
          }
        });

        const chartData = [
          { name: "0-12 months", count: ageGroups["0-12 months"] || 0 },
          { name: "1-4 years", count: ageGroups["1-4 years"] || 0 },
          { name: "5-17 years", count: ageGroups["5-17 years"] || 0 },
          { name: "18-29 years", count: ageGroups["18-29 years"] || 0 },
          { name: "30-49 years", count: ageGroups["30-49 years"] || 0 },
          { name: "50+ years", count: ageGroups["50+ years"] || 0 },
        ].filter(d => d.count > 0);

        setData(chartData);
        setInfantsDetail(infantsList.sort((a, b) => b.months - a.months));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm flex items-center justify-center h-64">
        <div className="w-6 h-6 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm">
        <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Age Distribution
        </h3>
        <div className="space-y-1.5">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{d.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(d.count / Math.max(...data.map(x => x.count))) * 100}%`,
                      backgroundColor: COLORS[i],
                    }}
                  />
                </div>
                <span className="font-semibold w-6 text-right">{d.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Chart */}
      <div className="lg:col-span-2 bg-card rounded-xl border border-border/60 p-5 shadow-sm">
        <h3 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Patient Age Distribution
        </h3>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No patient data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                formatter={(value) => [value, "Patients"]}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Infants Detail */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
        <h4 className="font-heading font-semibold text-sm mb-4 flex items-center gap-2 text-triage-emergency">
          <Baby className="w-4 h-4" /> Infants ({infantsDetail.length})
        </h4>
        {infantsDetail.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No infants recorded</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {infantsDetail.map((infant, i) => (
              <div key={i} className="p-2 bg-triage-emergency/5 rounded-lg border border-triage-emergency/20">
                <p className="text-xs font-medium truncate">{infant.name}</p>
                <p className="text-[10px] text-triage-emergency font-semibold mt-0.5">
                  {infant.months} month{infant.months !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}