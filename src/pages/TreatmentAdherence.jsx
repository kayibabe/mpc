import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Pill, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import PageHeader from "@/components/ui/PageHeader";

export default function TreatmentAdherence() {
  const [patients, setPatients] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [adherenceData, setAdherenceData] = useState({});
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [patientData, consultationData] = await Promise.all([
        base44.entities.Patient.list("-created_date", 200),
        base44.entities.Consultation.list("-created_date", 500),
      ]);
      setPatients(patientData);
      setConsultations(consultationData);

      // Calculate adherence metrics
      const adherence = {};
      consultationData.forEach(c => {
        if (c.patient_id) {
          if (!adherence[c.patient_id]) {
            adherence[c.patient_id] = {
              total_visits: 0,
              completed_visits: 0,
              medications_tracked: [],
              last_visit: null,
              adherence_score: 0,
            };
          }
          adherence[c.patient_id].total_visits++;
          if (c.status !== "cancelled") {
            adherence[c.patient_id].completed_visits++;
          }
          adherence[c.patient_id].last_visit = c.created_date;
        }
      });

      // Calculate adherence scores
      Object.keys(adherence).forEach(patientId => {
        const data = adherence[patientId];
        data.adherence_score = data.total_visits > 0
          ? Math.round((data.completed_visits / data.total_visits) * 100)
          : 0;
      });

      setAdherenceData(adherence);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getPatientName = (id) => {
    const p = patients.find(pt => pt.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const selectedAdherence = selectedPatient ? adherenceData[selectedPatient] : null;

  const adherenceDistribution = [
    { range: "0-20%", count: Object.values(adherenceData).filter(a => a.adherence_score < 20).length },
    { range: "20-40%", count: Object.values(adherenceData).filter(a => a.adherence_score >= 20 && a.adherence_score < 40).length },
    { range: "40-60%", count: Object.values(adherenceData).filter(a => a.adherence_score >= 40 && a.adherence_score < 60).length },
    { range: "60-80%", count: Object.values(adherenceData).filter(a => a.adherence_score >= 60 && a.adherence_score < 80).length },
    { range: "80-100%", count: Object.values(adherenceData).filter(a => a.adherence_score >= 80).length },
  ];

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const highAdherence = Object.values(adherenceData).filter(a => a.adherence_score >= 80).length;
  const lowAdherence = Object.values(adherenceData).filter(a => a.adherence_score < 50).length;
  const avgAdherence = Object.values(adherenceData).length > 0
    ? Math.round(
        Object.values(adherenceData).reduce((sum, a) => sum + a.adherence_score, 0) /
        Object.values(adherenceData).length
      )
    : 0;

  return (
    <div className="page-container">
      <PageHeader title="Treatment Adherence Tracking" subtitle="Monitor patient compliance and appointment attendance" icon={Pill} className="mb-6">
        <button onClick={loadData} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Avg Adherence</p>
          <p className="text-2xl font-bold text-primary">{avgAdherence}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">High Adherence</p>
          <p className="text-2xl font-bold text-chart-3">{highAdherence}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">At Risk</p>
          <p className="text-2xl font-bold text-chart-2">{lowAdherence}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Total Tracked</p>
          <p className="text-2xl font-bold">{Object.keys(adherenceData).length}</p>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm mb-6">
        <h4 className="font-heading font-semibold text-sm mb-4">Adherence Distribution</h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={adherenceDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="range" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient List */}
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm">
          <h4 className="font-heading font-semibold text-sm mb-3">Patients</h4>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {Object.keys(adherenceData).map(patientId => {
              const adherence = adherenceData[patientId];
              const isLowAdherence = adherence.adherence_score < 50;
              return (
                <button
                  key={patientId}
                  onClick={() => setSelectedPatient(patientId)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedPatient === patientId
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50"
                  } ${isLowAdherence ? "border-l-2 border-l-destructive" : ""}`}
                >
                  <p className="text-sm font-medium truncate">{getPatientName(patientId)}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                    <span>{adherence.adherence_score}%</span>
                    {isLowAdherence && <AlertTriangle className="w-3 h-3 text-destructive" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2">
          {selectedPatient && selectedAdherence ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
                <h4 className="font-heading font-semibold text-lg mb-4">{getPatientName(selectedPatient)}</h4>

                {/* Adherence Score */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Adherence</span>
                    <span className={`text-2xl font-bold ${
                      selectedAdherence.adherence_score >= 80 ? "text-chart-3" :
                      selectedAdherence.adherence_score >= 60 ? "text-chart-2" :
                      "text-destructive"
                    }`}>
                      {selectedAdherence.adherence_score}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        selectedAdherence.adherence_score >= 80 ? "bg-chart-3" :
                        selectedAdherence.adherence_score >= 60 ? "bg-chart-2" :
                        "bg-destructive"
                      }`}
                      style={{ width: `${selectedAdherence.adherence_score}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Completed Visits</p>
                    <p className="text-lg font-bold">{selectedAdherence.completed_visits}/{selectedAdherence.total_visits}</p>
                  </div>
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <p className="text-xs text-primary font-medium">Last Visit</p>
                    <p className="text-sm font-semibold mt-1">
                      {new Date(selectedAdherence.last_visit).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {selectedAdherence.adherence_score < 70 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                  <h5 className="font-semibold text-sm text-destructive flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" /> Low Adherence Alert
                  </h5>
                  <ul className="text-xs text-destructive/80 space-y-1">
                    <li>• Consider follow-up appointment</li>
                    <li>• Review treatment plan feasibility</li>
                    <li>• Assess barriers to compliance</li>
                    <li>• Provide patient education</li>
                  </ul>
                </div>
              )}

              {selectedAdherence.adherence_score >= 80 && (
                <div className="bg-chart-3/5 border border-chart-3/20 rounded-xl p-4">
                  <h5 className="font-semibold text-sm text-chart-3 flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4" /> Good Adherence
                  </h5>
                  <p className="text-xs text-chart-3/80">
                    Patient is maintaining good compliance with treatment plan. Continue current approach.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border/60 p-12 shadow-sm text-center">
              <Pill className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Select a patient to view adherence details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}