import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2 } from "lucide-react";
import PatientMedicalHistoryTimeline from "@/components/PatientMedicalHistoryTimeline";

export default function PatientHistory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientId = searchParams.get("id");
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPatient() {
      if (!patientId) {
        navigate("/reception");
        return;
      }
      try {
        const p = await base44.entities.Patient.get(patientId);
        setPatient(p);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadPatient();
  }, [patientId, navigate]);

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="page-container py-20 text-center">
        <p className="text-muted-foreground">Patient not found.</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <button
        onClick={() => navigate("/reception")}
        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Reception
      </button>

      <div className="bg-card rounded-xl border border-border/60 p-6 mb-6">
        <h1 className="section-title mb-2">
          {patient.first_name} {patient.last_name}
        </h1>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>MRN: <span className="font-mono font-semibold">{patient.mrn}</span></span>
          <span>DOB: {new Date(patient.date_of_birth).toLocaleDateString("en-GB")}</span>
          <span>Age: {new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()}</span>
          <span className="capitalize">{patient.gender}</span>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/60 p-6">
        <h2 className="font-heading text-lg font-semibold mb-6">Medical History Timeline</h2>
        <PatientMedicalHistoryTimeline patientId={patientId} />
      </div>
    </div>
  );
}