import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Circle, FileText, Loader2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const DISCHARGE_ITEMS = [
  "Final diagnosis documented",
  "Discharge summary prepared",
  "Medications reconciled and packaged",
  "Lab results reviewed and explained",
  "Follow-up appointments scheduled",
  "Referral letters issued",
  "Patient education completed",
  "Prescriptions provided",
  "Insurance/payment settled",
  "Discharge checklist signed",
];

export default function DischargeChecklistFlow() {
  const [admissions, setAdmissions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [checklist, setChecklist] = useState({});
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [admissionData, patientData] = await Promise.all([
        base44.entities.Admission.filter({ status: "active" }, "-created_date", 100),
        base44.entities.Patient.list("-created_date", 200),
      ]);
      setAdmissions(admissionData);
      setPatients(patientData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const initiateDischarge = async (e) => {
    e.preventDefault();
    if (!selectedAdmission) {
      alert("Select admission");
      return;
    }

    setSaving(true);
    try {
      const completedItems = Object.values(checklist).filter(Boolean).length;
      
      // Create discharge record
      await base44.entities.Discharge.create({
        admission_id: selectedAdmission.id,
        patient_id: selectedAdmission.patient_id,
        discharge_date: new Date().toISOString(),
        discharge_type: "regular",
        checklist_completed: completedItems === DISCHARGE_ITEMS.length,
        checklist_items: JSON.stringify(checklist),
        discharge_notes: notes,
        status: "completed",
      });

      // Update admission status
      await base44.entities.Admission.update(selectedAdmission.id, {
        status: "discharged",
        discharge_date: new Date().toISOString(),
      });

      loadData();
      setSelectedAdmission(null);
      setChecklist({});
      setNotes("");
      setShowForm(false);
      alert("Patient discharged successfully");
    } catch (e) {
      alert("Discharge failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleChecklistItem = (item) => {
    setChecklist(prev => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  const getPatientName = (id) => {
    const p = patients.find(pt => pt.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const completionRate = selectedAdmission
    ? Math.round((Object.values(checklist).filter(Boolean).length / DISCHARGE_ITEMS.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Discharge Checklist Flow" subtitle="Structured discharge process with safety checklist" icon={CheckCircle} className="mb-6" />

      {!selectedAdmission ? (
        <div className="bg-card rounded-xl border border-border/60 shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="font-heading font-semibold text-sm">Active Admissions Ready for Discharge</h3>
          </div>

          {admissions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              No active admissions.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {admissions.map(adm => (
                <div key={adm.id} className="p-4 hover:bg-muted/20 flex items-center justify-between cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedAdmission(adm);
                    setChecklist({});
                    setNotes("");
                  }}>
                  <div>
                    <p className="font-semibold text-sm">{getPatientName(adm.patient_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      Admitted: {new Date(adm.admission_date).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                    Start Discharge
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Patient Header */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{getPatientName(selectedAdmission.patient_id)}</p>
                <p className="text-xs text-muted-foreground mt-1">Admission: {new Date(selectedAdmission.admission_date).toLocaleDateString("en-GB")}</p>
              </div>
              <button
                onClick={() => setSelectedAdmission(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-primary/30 hover:bg-primary/10"
              >
                Change Patient
              </button>
            </div>
          </div>

          {/* Completion Progress */}
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-heading font-semibold text-sm">Discharge Checklist</h4>
              <span className="text-lg font-bold text-primary">{completionRate}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          {/* Checklist Items */}
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
            <div className="space-y-2">
              {DISCHARGE_ITEMS.map((item, i) => (
                <button
                  key={i}
                  onClick={() => toggleChecklistItem(item)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors text-left"
                >
                  {checklist[item] ? (
                    <CheckCircle className="w-5 h-5 text-chart-3 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`text-sm ${checklist[item] ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Discharge Notes */}
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
            <label className="block text-xs font-medium text-muted-foreground mb-2">Discharge Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Final instructions, special precautions, follow-up care..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={initiateDischarge}
              disabled={saving || completionRate < 100}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
                completionRate === 100
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? "Processing..." : "Complete Discharge"}
            </button>
            <button
              onClick={() => setSelectedAdmission(null)}
              className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>

          {completionRate < 100 && (
            <div className="text-xs text-muted-foreground text-center">
              Complete all checklist items before discharge
            </div>
          )}
        </div>
      )}
    </div>
  );
}