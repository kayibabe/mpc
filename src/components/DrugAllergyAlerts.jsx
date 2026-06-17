import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, AlertCircle } from "lucide-react";

export default function DrugAllergyAlerts({ patientId }) {
  const [allergies, setAllergies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (patientId) {
      loadAllergies();
    } else {
      setLoading(false);
    }
  }, [patientId]);

  const loadAllergies = async () => {
    try {
      const allergy_data = await base44.entities.PatientAllergy.filter(
        { patient_id: patientId, is_active: true },
        "",
        50
      );
      setAllergies(allergy_data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading || allergies.length === 0) {
    return null;
  }

  // Group by severity
  const criticalAllergies = allergies.filter(a => a.severity === "severe");
  const majorAllergies = allergies.filter(a => a.severity === "moderate");

  return (
    <div className="space-y-2">
      {criticalAllergies.length > 0 && (
        <div className="border-l-4 border-l-destructive bg-destructive/5 p-3 rounded">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-xs text-destructive">CRITICAL DRUG ALLERGIES</p>
              <div className="mt-1 space-y-0.5">
                {criticalAllergies.map((a, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {a.drug_name}: {a.reaction_type} {a.reaction_severity && `(${a.reaction_severity})`}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {majorAllergies.length > 0 && (
        <div className="border-l-4 border-l-chart-2 bg-chart-2/5 p-3 rounded">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-chart-2 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-xs text-chart-2">Drug Allergies</p>
              <div className="mt-1 space-y-0.5">
                {majorAllergies.map((a, i) => (
                  <p key={i} className="text-xs text-chart-2/80">
                    {a.drug_name}: {a.reaction_type}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}