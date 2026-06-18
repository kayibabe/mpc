import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.patient_id) return Response.json({ error: "Missing patient data" }, { status: 400 });

    const patient = await base44.asServiceRole.entities.Patient.get(data.patient_id);
    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });

    let readmissionRisk = 0;
    const riskFactors = [];

    // Age risk
    const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();
    if (age > 65) {
      readmissionRisk += 25;
      riskFactors.push(`Age >65 (${age} years)`);
    }
    if (age < 5) {
      readmissionRisk += 15;
      riskFactors.push("Pediatric (<5 years)");
    }

    // Get recent visits
    const visits = await base44.asServiceRole.entities.Visit.filter(
      { patient_id: data.patient_id },
      "-created_date",
      5
    );

    // Multiple recent visits = readmission risk
    const lastThirtyDays = new Date();
    lastThirtyDays.setDate(lastThirtyDays.getDate() - 30);
    const recentVisits = visits.filter(v => new Date(v.created_date) > lastThirtyDays).length;
    if (recentVisits > 2) {
      readmissionRisk += 20;
      riskFactors.push(`${recentVisits} visits in 30 days`);
    }

    // Check diagnoses
    const consultations = await base44.asServiceRole.entities.Consultation.filter(
      { patient_id: data.patient_id },
      "-consultation_date",
      3
    );

    const highRiskDiagnoses = ["chf", "copd", "pneumonia", "sepsis", "stroke", "diabetes", "hypertension", "asthma", "kidney"];
    for (const c of consultations) {
      const assessment = c.assessment?.toLowerCase() || "";
      for (const dx of highRiskDiagnoses) {
        if (assessment.includes(dx)) {
          readmissionRisk += 15;
          riskFactors.push(`Chronic: ${dx}`);
          break;
        }
      }
    }

    // Socioeconomic: no phone = harder to reach for follow-up
    if (!patient.phone) {
      readmissionRisk += 10;
      riskFactors.push("No contact phone");
    }

    const riskLevel = readmissionRisk > 70 ? "CRITICAL" : readmissionRisk > 50 ? "HIGH" : "STANDARD";

    if (readmissionRisk > 50) {
      await base44.asServiceRole.entities.Notification.create({
        title: `⚠️ HIGH READMISSION RISK: ${patient.first_name} ${patient.last_name}`,
        message: `Risk score: ${readmissionRisk}. Factors: ${riskFactors.join(", ")}. Extended follow-up needed.`,
        is_read: false,
        target_role: "doctor",
        priority: "high",
        linked_patient_id: data.patient_id,
      });
    }

    return Response.json({
      status: "success",
      patient_id: data.patient_id,
      readmission_risk_score: readmissionRisk,
      risk_level: riskLevel,
      factors: riskFactors,
      recommendation: riskLevel === "CRITICAL" ? "Extended follow-up + social work consult" : riskLevel === "HIGH" ? "Scheduled follow-up + medication review" : "Standard discharge",
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});