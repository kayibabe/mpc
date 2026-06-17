import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp, Activity, CheckCircle, AlertTriangle, RefreshCw, Search } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function PatientOutcomeTracker() {
  const [patients, setPatients] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [discharges, setDischarges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [patientData, consultationData, dischargeData] = await Promise.all([
        base44.entities.Patient.list("-created_date", 200),
        base44.entities.Consultation.list("-created_date", 500),
        base44.entities.Discharge?.list?.("-created_date", 200) || [],
      ]);
      setPatients(patientData);
      setConsultations(consultationData);
      setDischarges(dischargeData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getPatientOutcomes = (patientId) => {
    const patientConsultations = consultations.filter(c => c.patient_id === patientId);
    const patientDischarge = discharges.find(d => d.patient_id === patientId);
    
    const recovered = patientConsultations.length > 0 && patientConsultations.some(c => c.status === "completed");
    const admitted = patientConsultations.length > 0 && patientConsultations.some(c => c.notes?.includes("admitted"));

    return {
      total_consultations: patientConsultations.length,
      status: patientDischarge ? "discharged" : admitted ? "inpatient" : "outpatient",
      recovery_status: recovered ? "improving" : patientConsultations.length > 0 ? "ongoing" : "new",
      last_consultation: patientConsultations[0]?.created_date,
      discharge_date: patientDischarge?.discharge_date,
    };
  };

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchInput.toLowerCase())
  );

  const outcomeStats = {
    recovered: patients.filter(p => getPatientOutcomes(p.id).recovery_status === "improving").length,
    ongoing: patients.filter(p => getPatientOutcomes(p.id).recovery_status === "ongoing").length,
    inpatient: patients.filter(p => getPatientOutcomes(p.id).status === "inpatient").length,
    discharged: discharges.length,
  };

  const outcomeTimeline = patients.map(p => {
    const outcomes = getPatientOutcomes(p.id);
    return {
      patient: `${p.first_name.charAt(0)}${p.last_name.charAt(0)}`,
      consultations: outcomes.total_consultations,
      status: outcomes.recovery_status === "improving" ? 1 : outcomes.recovery_status === "ongoing" ? 0.5 : 0,
    };
  }).slice(0, 30);

  const selectedOutcome = selectedPatient ? getPatientOutcomes(selectedPatient) : null;

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Patient Outcome Tracker</h2>
          <p className="text-sm text-muted-foreground mt-1">Monitor recovery status, discharge trends, and patient outcomes</p>
        </div>
        <button onClick={loadData} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Recovered</p>
          <p className="text-2xl font-bold text-chart-3">{outcomeStats.recovered}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Ongoing Care</p>
          <p className="text-2xl font-bold text-chart-4">{outcomeStats.ongoing}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Inpatient</p>
          <p className="text-2xl font-bold text-chart-1">{outcomeStats.inpatient}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Discharged</p>
          <p className="text-2xl font-bold text-primary">{outcomeStats.discharged}</p>
        </div>
      </div>

      {/* Outcomes Chart */}
      {outcomeTimeline.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm mb-6">
          <h4 className="font-heading font-semibold text-sm mb-4">Consultation & Recovery Trend</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={outcomeTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="patient" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="consultations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Consultations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient List */}
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm">
          <div className="relative mb-3">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-8 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {filteredPatients.map(p => {
              const outcomes = getPatientOutcomes(p.id);
              const isRecovered = outcomes.recovery_status === "improving";
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatient(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedPatient === p.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                  }`}
                >
                  <p className="text-sm font-medium truncate">{p.first_name} {p.last_name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      isRecovered ? "bg-chart-3" : "bg-chart-2"
                    }`} />
                    <span>{outcomes.recovery_status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Outcome Details */}
        <div className="lg:col-span-2">
          {selectedPatient && selectedOutcome ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Patient</p>
                    <p className="text-lg font-semibold">
                      {patients.find(p => p.id === selectedPatient)?.first_name} {patients.find(p => p.id === selectedPatient)?.last_name}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    selectedOutcome.recovery_status === "improving" ? "bg-chart-3/10 text-chart-3" :
                    selectedOutcome.recovery_status === "ongoing" ? "bg-chart-2/10 text-chart-2" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {selectedOutcome.recovery_status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-muted/30 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Consultations</p>
                    <p className="text-lg font-bold mt-1">{selectedOutcome.total_consultations}</p>
                  </div>
                  <div className="p-2 bg-primary/5 rounded-lg text-center">
                    <p className="text-xs text-primary">Current Status</p>
                    <p className="text-sm font-bold mt-1 capitalize">{selectedOutcome.status}</p>
                  </div>
                  <div className="p-2 bg-chart-3/5 rounded-lg text-center">
                    <p className="text-xs text-chart-3">Last Visit</p>
                    <p className="text-xs font-semibold mt-1">
                      {selectedOutcome.last_consultation ? new Date(selectedOutcome.last_consultation).toLocaleDateString("en-GB") : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Outcome Indicators */}
              <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm space-y-3">
                <h5 className="font-heading font-semibold text-sm">Outcome Indicators</h5>

                {selectedOutcome.recovery_status === "improving" && (
                  <div className="flex items-start gap-2 p-3 bg-chart-3/5 border border-chart-3/20 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-chart-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-chart-3">Positive Recovery</p>
                      <p className="text-[10px] text-chart-3/80 mt-0.5">Patient showing signs of improvement and positive treatment response</p>
                    </div>
                  </div>
                )}

                {selectedOutcome.status === "discharged" && (
                  <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-primary">Successfully Discharged</p>
                      <p className="text-[10px] text-primary/80 mt-0.5">
                        {selectedOutcome.discharge_date ? new Date(selectedOutcome.discharge_date).toLocaleDateString("en-GB") : "Recently"}
                      </p>
                    </div>
                  </div>
                )}

                {selectedOutcome.total_consultations === 0 && (
                  <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border/40 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">New Patient</p>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">No consultations recorded yet</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Recommendations */}
              {selectedOutcome.recovery_status === "ongoing" && (
                <div className="bg-chart-2/5 border border-chart-2/20 rounded-xl p-4">
                  <h5 className="font-semibold text-xs text-chart-2 mb-2 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" /> Next Steps
                  </h5>
                  <ul className="text-xs text-chart-2/80 space-y-1">
                    <li>• Schedule follow-up consultation</li>
                    <li>• Monitor treatment adherence</li>
                    <li>• Review lab results</li>
                    <li>• Consider specialist referral if needed</li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border/60 p-12 shadow-sm text-center">
              <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Select a patient to view outcome details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}