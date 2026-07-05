import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowRight, Users, ClipboardCheck, AlertCircle, Clock, Activity, Pill } from "lucide-react";

const DEPT_CONFIGS = {
  reception: {
    label: "Reception",
    color: "bg-primary",
    metrics: ["registrations", "checkins", "waitingQueue"],
    pullStage: "RECEPTION",
  },
  clinical: {
    label: "Clinical",
    color: "bg-chart-1",
    metrics: ["consultations", "diagnoses", "prescriptions", "avgConsultTime"],
    pullStage: null,
  },
  lab: {
    label: "Laboratory",
    color: "bg-chart-3",
    metrics: ["orders", "results", "turnaround", "pending"],
    pullStage: "LAB_PROCESSING",
  },
  imaging: {
    label: "Imaging",
    color: "bg-chart-4",
    metrics: ["orders", "results", "turnaround", "pending"],
    pullStage: "IMAGING_PROCESSING",
  },
  pharmacy: {
    label: "Pharmacy",
    color: "bg-chart-2",
    metrics: ["pendingRx", "dispensed", "lowStock", "expiring"],
    pullStage: "PHARMACY_DISPENSING",
  },
  billing: {
    label: "Billing",
    color: "bg-chart-5",
    metrics: ["invoices", "collected", "outstanding", "claims"],
    pullStage: "BILLING",
  },
  inpatient: {
    label: "Inpatient",
    color: "bg-chart-4",
    metrics: ["admissions", "discharges", "occupiedBeds", "availableBeds"],
    pullStage: "NURSING_ADMINISTRATION",
  },
  maternal: {
    label: "Maternal",
    color: "bg-chart-1",
    metrics: ["ancVisits", "deliveries", "postnatal", "highRisk"],
    pullStage: null,
  },
  nursing: {
    label: "Nursing Station",
    color: "bg-chart-1",
    metrics: ["triageToday", "vitalsRecorded", "medsAdministered", "nursingNotes"],
    pullStage: "TRIAGE",
  },
};

export default function DepartmentDashboard({ department, compact = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pullQueue, setPullQueue] = useState([]);
  const [pulling, setPulling] = useState(false);

  const config = DEPT_CONFIGS[department] || DEPT_CONFIGS.reception;

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

        const result = {};

        // Pull queue from patient journeys
        if (config.pullStage) {
          const journeys = await base44.entities.PatientJourney.filter(
            { current_stage: config.pullStage, status: "active" },
            "-created_date",
            20
          );
          setPullQueue(journeys);
        }

        if (department === "reception") {
          const [registrations, checkins] = await Promise.all([
            base44.entities.Patient.filter({ created_date: { $gte: today } }, "-created_date", 200),
            base44.entities.Visit.filter({ created_date: { $gte: today } }, "-created_date", 200),
          ]);
          result.registrations = registrations.length;
          result.checkins = checkins.length;
          result.waitingQueue = checkins.filter(v => v.queue_status === "waiting").length;
        }

        if (department === "clinical") {
          const [consults, diagnoses, prescriptions] = await Promise.all([
            base44.entities.Consultation.filter({ created_date: { $gte: today } }, "-created_date", 200),
            base44.entities.Diagnosis.filter({ created_date: { $gte: today } }, "-created_date", 200),
            base44.entities.Prescription.filter({ created_date: { $gte: today } }, "-created_date", 200),
          ]);
          result.consultations = consults.length;
          result.diagnoses = diagnoses.length;
          result.prescriptions = prescriptions.length;
          result.avgConsultTime = null;
        }

        if (department === "lab") {
          const [orders, results] = await Promise.all([
            base44.entities.LabOrder.filter({ created_date: { $gte: thirtyDaysAgo } }, "-created_date", 200),
            base44.entities.LabResult.filter({ created_date: { $gte: thirtyDaysAgo } }, "-created_date", 200),
          ]);
          result.orders = orders.length;
          result.results = results.length;
          result.pending = orders.filter(o => o.status !== "completed" && o.status !== "verified").length;
          const completedWithResults = results.filter(r => r.status === "verified" || r.status === "reported");
          const avgTat = completedWithResults.length > 0
            ? Math.round(completedWithResults.reduce((sum, r) => {
                const order = orders.find(o => o.id === r.lab_order_id);
                if (!order) return sum;
                return sum + (new Date(r.reported_date || r.created_date) - new Date(order.created_date)) / 3600000;
              }, 0) / completedWithResults.length * 10) / 10
            : null;
          result.turnaround = avgTat;
        }

        if (department === "imaging") {
          const [orders, results] = await Promise.all([
            base44.entities.ImagingOrder.filter({ created_date: { $gte: thirtyDaysAgo } }, "-created_date", 200),
            base44.entities.ImagingResult.filter({ created_date: { $gte: thirtyDaysAgo } }, "-created_date", 200),
          ]);
          result.orders = orders.length;
          result.results = results.length;
          result.pending = orders.filter(o => o.status !== "reported" && o.status !== "verified").length;
          result.turnaround = null;
        }

        if (department === "pharmacy") {
          const [drugs, prescriptions, dispensings] = await Promise.all([
            base44.entities.Drug.list("", 200),
            base44.entities.Prescription.filter({ status: { $in: ["pending", "partial"] } }, "-created_date", 100),
            base44.entities.PharmacyDispensing.filter({ created_date: { $gte: today } }, "-created_date", 100),
          ]);
          result.pendingRx = prescriptions.length;
          result.dispensed = dispensings.length;
          result.lowStock = drugs.filter(d => d.quantity_in_stock <= d.reorder_level).length;
          result.expiring = drugs.filter(d => d.expiry_date && new Date(d.expiry_date) < new Date(Date.now() + 90 * 86400000)).length;
        }

        if (department === "billing") {
          const [invoices, claims] = await Promise.all([
            base44.entities.Invoice.filter({ created_date: { $gte: today } }, "-created_date", 200),
            base44.entities.InsuranceClaim.filter({ created_date: { $gte: thirtyDaysAgo } }, "-created_date", 200),
          ]);
          result.invoices = invoices.length;
          result.collected = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.net_amount || i.total_amount || 0), 0);
          result.outstanding = invoices.filter(i => i.status === "pending" || i.status === "partial").reduce((s, i) => s + (i.net_amount || i.total_amount || 0), 0);
          result.claims = claims.length;
        }

        if (department === "inpatient") {
          const [beds, admissions] = await Promise.all([
            base44.entities.Bed.list("", 200),
            base44.entities.Admission.list("-created_date", 100),
          ]);
          const discharged = await base44.entities.Discharge.filter({ created_date: { $gte: today } }, "-created_date", 50);
          result.occupiedBeds = beds.filter(b => b.status === "occupied").length;
          result.availableBeds = beds.filter(b => b.status === "available").length;
          result.admissions = admissions.filter(a => a.status === "admitted").length;
          result.discharges = discharged.length;
        }

        if (department === "maternal") {
          const [ancVisits, newborns] = await Promise.all([
            base44.entities.MaternalVisit.filter({ created_date: { $gte: thirtyDaysAgo } }, "-created_date", 200),
            base44.entities.NewbornRecord.list("-created_date", 100),
          ]);
          result.ancVisits = ancVisits.length;
          result.deliveries = ancVisits.filter(v => v.delivery_outcome === "delivered").length;
          result.postnatal = ancVisits.filter(v => v.visit_type === "postnatal").length;
          result.highRisk = ancVisits.filter(v => v.risk_level === "high").length;
        }

        if (department === "nursing") {
          const [triageJourneys, vitals, dispensings] = await Promise.all([
            base44.entities.PatientJourney.filter(
              { current_stage: "TRIAGE", status: "active" },
              "-created_date",
              100
            ),
            base44.entities.VitalSigns.filter({ created_date: { $gte: today } }, "-created_date", 200),
            base44.entities.PharmacyDispensing.filter({ created_date: { $gte: today } }, "-created_date", 200),
          ]);
          result.triageToday = triageJourneys.length;
          result.vitalsRecorded = vitals.length;
          result.medsAdministered = dispensings.length;
          result.nursingNotes = 0; // Will be populated by nursing notes entity when available
        }

        setData(result);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [department]);

  const handlePullNext = async (journeyId) => {
    setPulling(true);
    try {
      await base44.functions.invoke("handleWorkflowStageChange", {
        journey_id: journeyId,
        next_stage: config.pullStage,
        notes: `Pulled by ${config.label} department`,
      });
      setPullQueue(pullQueue.filter(j => j.id !== journeyId));
    } catch (e) {
      alert("Pull failed: " + (e.response?.data?.error || e.message));
    } finally {
      setPulling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border/60 p-4 flex items-center justify-center h-32">
        <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const metrics = config.metrics.map(m => {
    const configs = {
      registrations: { label: "Today's Registrations", icon: Users, color: "text-primary" },
      checkins: { label: "Check-ins", icon: ClipboardCheck, color: "text-chart-3" },
      waitingQueue: { label: "Waiting", icon: Clock, color: "text-chart-2" },
      consultations: { label: "Today's Consults", icon: Users, color: "text-primary" },
      diagnoses: { label: "Diagnoses", icon: AlertCircle, color: "text-chart-4" },
      prescriptions: { label: "Prescriptions", icon: ClipboardCheck, color: "text-chart-2" },
      avgConsultTime: { label: "Avg Consult", icon: Clock, color: "text-chart-3", suffix: " min" },
      orders: { label: "Orders", icon: ClipboardCheck, color: "text-primary" },
      results: { label: "Results", icon: ClipboardCheck, color: "text-chart-3" },
      turnaround: { label: "Avg TAT", icon: Clock, color: "text-chart-2", suffix: " hrs" },
      pending: { label: "Pending", icon: AlertCircle, color: "text-destructive" },
      pendingRx: { label: "Pending Rx", icon: AlertCircle, color: "text-destructive" },
      dispensed: { label: "Dispensed Today", icon: ClipboardCheck, color: "text-chart-3" },
      lowStock: { label: "Low Stock", icon: AlertCircle, color: "text-destructive" },
      expiring: { label: "Expiring ≤90d", icon: AlertCircle, color: "text-chart-2" },
      invoices: { label: "Today's Invoices", icon: ClipboardCheck, color: "text-primary" },
      collected: { label: "Collected (MWK)", icon: ClipboardCheck, color: "text-chart-3", format: "currency" },
      outstanding: { label: "Outstanding (MWK)", icon: AlertCircle, color: "text-destructive", format: "currency" },
      claims: { label: "Insurance Claims", icon: ClipboardCheck, color: "text-chart-4" },
      admissions: { label: "Active Admissions", icon: Users, color: "text-primary" },
      discharges: { label: "Today's Discharges", icon: ClipboardCheck, color: "text-chart-3" },
      occupiedBeds: { label: "Occupied Beds", icon: AlertCircle, color: "text-destructive" },
      availableBeds: { label: "Available Beds", icon: ClipboardCheck, color: "text-chart-3" },
      ancVisits: { label: "ANC Visits (30d)", icon: Users, color: "text-primary" },
      deliveries: { label: "Deliveries", icon: Users, color: "text-chart-3" },
      postnatal: { label: "Postnatal", icon: Users, color: "text-chart-1" },
      highRisk: { label: "High Risk", icon: AlertCircle, color: "text-destructive" },
      triageToday: { label: "Triage Queue", icon: Clock, color: "text-chart-2" },
      vitalsRecorded: { label: "Vitals Today", icon: Activity, color: "text-chart-3" },
      medsAdministered: { label: "Meds Given", icon: Pill, color: "text-primary" },
      nursingNotes: { label: "Nursing Notes", icon: ClipboardCheck, color: "text-chart-1" },
    };
    return { ...configs[m], value: data?.[m] ?? "—", key: m };
  });

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-2 items-center`}>
        {metrics.slice(0, 3).map(m => (
          <span key={m.key} className={`px-2 py-1 rounded-lg text-xs font-medium bg-muted/60 ${m.color}`}>
            {m.label}: <strong>{m.format === "currency" ? (m.value || 0).toLocaleString() : m.value}{m.suffix || ""}</strong>
          </span>
        ))}
        {pullQueue.length > 0 && (
          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary">
            Queue: {pullQueue.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`${config.color} px-4 py-3`}>
        <h3 className="font-heading text-lg font-bold text-white">{config.label} Dashboard</h3>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
        {metrics.map(m => (
          <div key={m.key} className="bg-muted/30 rounded-lg p-3 text-center">
            <m.icon className={`w-4 h-4 mx-auto mb-1 ${m.color}`} />
            <p className="text-lg font-bold">
              {m.format === "currency" ? (m.value || 0).toLocaleString() : m.value}{m.suffix || ""}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Pull Queue */}
      {pullQueue.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Your Pull Queue ({pullQueue.length})
            </h4>
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {pullQueue.slice(0, 5).map(j => (
              <div key={j.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
                <span className="font-medium truncate flex-1">{j.patient_id?.slice(0, 8)} — {j.current_stage?.replace(/_/g, " ")}</span>
                <button
                  onClick={() => handlePullNext(j.id)}
                  disabled={pulling}
                  className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20 flex items-center gap-1 shrink-0"
                >
                  <ArrowRight className="w-3 h-3" /> Pull
                </button>
              </div>
            ))}
            {pullQueue.length > 5 && (
              <p className="text-[10px] text-muted-foreground text-center">+{pullQueue.length - 5} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}