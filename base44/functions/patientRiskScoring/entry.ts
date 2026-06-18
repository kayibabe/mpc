import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.patient_id || !data?.visit_id) {
      return Response.json({ error: "Missing patient or visit data" }, { status: 400 });
    }

    // Get vital signs and labs
    const vitals = await base44.asServiceRole.entities.VitalSigns.filter(
      { patient_id: data.patient_id, visit_id: data.visit_id },
      "-recorded_date",
      1
    );
    const labResults = await base44.asServiceRole.entities.LabResult.filter(
      { patient_id: data.patient_id },
      "-verified_date",
      10
    );

    let riskScore = 0;
    const riskFactors = [];

    if (vitals.length > 0) {
      const v = vitals[0];
      // Sepsis risk: fever + tachycardia + elevated RR
      if ((v.temperature > 38.5 || v.temperature < 36) && v.heart_rate > 100) {
        riskScore += 30;
        riskFactors.push("🔴 Sepsis risk: Fever + tachycardia");
      }
      if (v.respiratory_rate > 25) {
        riskScore += 15;
        riskFactors.push("🟠 Tachypnea (RR > 25)");
      }
      if (v.bp_systolic < 90 || v.bp_diastolic < 60) {
        riskScore += 25;
        riskFactors.push("🔴 Hypotension (shock risk)");
      }
      if (v.spo2 < 92) {
        riskScore += 20;
        riskFactors.push("🔴 Hypoxia (SpO2 < 92%)");
      }
    }

    // Lab risk indicators
    if (labResults.length > 0) {
      const wbc = labResults.find(l => l.test_name?.toLowerCase().includes("wbc"));
      const creatinine = labResults.find(l => l.test_name?.toLowerCase().includes("creatinine"));
      const glucose = labResults.find(l => l.test_name?.toLowerCase().includes("glucose"));

      if (wbc && (parseFloat(wbc.result_value) > 15 || parseFloat(wbc.result_value) < 4)) {
        riskScore += 20;
        riskFactors.push("🟠 Abnormal WBC (infection risk)");
      }
      if (creatinine && parseFloat(creatinine.result_value) > 1.5) {
        riskScore += 15;
        riskFactors.push("🟠 Elevated creatinine (renal risk)");
      }
      if (glucose && (parseFloat(glucose.result_value) > 400 || parseFloat(glucose.result_value) < 60)) {
        riskScore += 20;
        riskFactors.push("🟠 Extreme glucose (hypo/hyperglycemia)");
      }
    }

    // Get patient data for context
    const patient = await base44.asServiceRole.entities.Patient.get(data.patient_id);
    const visit = await base44.asServiceRole.entities.Visit.get(data.visit_id);

    // Maternal/post-op specific risks
    if (visit?.visit_type === "anc" || visit?.visit_type === "postnatal") {
      if (vitals[0]?.temperature > 38) {
        riskScore += 25;
        riskFactors.push("🔴 Postpartum fever (infection)");
      }
    }

    // Create risk alert if score > 50
    if (riskScore > 50) {
      const priority = riskScore > 75 ? "critical" : "high";
      
      await base44.asServiceRole.entities.Notification.create({
        title: `⚠️ HIGH RISK PATIENT: ${patient?.first_name} ${patient?.last_name}`,
        message: `Risk Score: ${riskScore}/100. Factors: ${riskFactors.join("; ")}. Escalate to senior clinician.`,
        is_read: false,
        target_role: "doctor",
        priority: priority,
        linked_patient_id: data.patient_id,
        linked_visit_id: data.visit_id,
      });

      // Log risk assessment
      await base44.asServiceRole.entities.AuditLog.create({
        entity_name: "PatientRiskScore",
        entity_id: data.patient_id,
        action: "risk_assessment",
        user_id: "system",
        description: `Risk Score: ${riskScore}. Factors: ${riskFactors.join(", ")}`,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      status: "success",
      patient_id: data.patient_id,
      risk_score: riskScore,
      risk_level: riskScore > 75 ? "CRITICAL" : riskScore > 50 ? "HIGH" : "NORMAL",
      factors: riskFactors,
    });

  } catch (error) {
    console.error("Error calculating patient risk:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});