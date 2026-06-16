import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { journey_id, patient_id, visit_id } = body;

    // Fetch latest vitals for this patient
    let vitals = null;
    if (visit_id) {
      const vitalRecords = await base44.entities.VitalSigns.filter(
        { visit_id },
        "-created_date",
        1
      );
      vitals = vitalRecords[0] || null;
    } else if (patient_id) {
      const vitalRecords = await base44.entities.VitalSigns.filter(
        { patient_id },
        "-created_date",
        1
      );
      vitals = vitalRecords[0] || null;
    }

    // Fetch patient for age
    let patient = null;
    if (patient_id) {
      try { patient = await base44.entities.Patient.get(patient_id); } catch (_) {}
    }

    // Calculate MEWS score
    let mewsScore = 0;
    const breakdown = [];

    // Respiratory rate
    const rr = vitals?.respiratory_rate;
    if (rr != null) {
      let rrScore = 0;
      if (rr <= 8) rrScore = 2;
      else if (rr <= 14) rrScore = 0;
      else if (rr <= 20) rrScore = 1;
      else if (rr <= 29) rrScore = 2;
      else rrScore = 3;
      mewsScore += rrScore;
      breakdown.push({ parameter: "Respiratory Rate", value: rr, score: rrScore });
    }

    // Heart rate
    const hr = vitals?.heart_rate;
    if (hr != null) {
      let hrScore = 0;
      if (hr <= 40) hrScore = 2;
      else if (hr <= 50) hrScore = 1;
      else if (hr <= 100) hrScore = 0;
      else if (hr <= 110) hrScore = 1;
      else if (hr <= 129) hrScore = 2;
      else hrScore = 3;
      mewsScore += hrScore;
      breakdown.push({ parameter: "Heart Rate", value: hr, score: hrScore });
    }

    // Systolic BP
    const sbp = vitals?.bp_systolic;
    if (sbp != null) {
      let sbpScore = 0;
      if (sbp <= 70) sbpScore = 3;
      else if (sbp <= 80) sbpScore = 2;
      else if (sbp <= 100) sbpScore = 1;
      else if (sbp <= 199) sbpScore = 0;
      else sbpScore = 2;
      mewsScore += sbpScore;
      breakdown.push({ parameter: "Systolic BP", value: sbp, score: sbpScore });
    }

    // Temperature
    const temp = vitals?.temperature;
    if (temp != null) {
      let tempScore = 0;
      if (temp <= 35) tempScore = 2;
      else if (temp <= 36) tempScore = 1;
      else if (temp <= 38) tempScore = 0;
      else if (temp <= 38.5) tempScore = 1;
      else tempScore = 2;
      mewsScore += tempScore;
      breakdown.push({ parameter: "Temperature", value: temp, score: tempScore });
    }

    // GCS / consciousness (use pain_score or gcs if available)
    const gcs = vitals?.gcs;
    const pain = vitals?.pain_score;
    if (gcs != null) {
      let gcsScore = 0;
      if (gcs <= 8) gcsScore = 3;
      else if (gcs <= 13) gcsScore = 1;
      else gcsScore = 0;
      mewsScore += gcsScore;
      breakdown.push({ parameter: "GCS", value: gcs, score: gcsScore });
    }

    // SpO2
    const spo2 = vitals?.spo2;
    if (spo2 != null) {
      let spo2Score = 0;
      if (spo2 <= 88) spo2Score = 3;
      else if (spo2 <= 92) spo2Score = 2;
      else if (spo2 <= 94) spo2Score = 1;
      else spo2Score = 0;
      mewsScore += spo2Score;
      breakdown.push({ parameter: "SpO₂", value: spo2, score: spo2Score });
    }

    // Age adjustment (≥65 = +1)
    let ageScore = 0;
    if (patient?.date_of_birth) {
      const age = (Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 86400000);
      if (age >= 65) {
        ageScore = 1;
        mewsScore += 1;
        breakdown.push({ parameter: "Age ≥65", value: Math.round(age), score: 1 });
      }
    }

    // Determine priority from MEWS score
    let suggestedPriority = "normal";
    let assessment = "";
    if (mewsScore >= 5) {
      suggestedPriority = "emergency";
      assessment = "CRITICAL — Immediate medical attention required. High risk of deterioration.";
    } else if (mewsScore >= 3) {
      suggestedPriority = "urgent";
      assessment = "URGENT — Needs attention within 60 minutes. Moderate risk.";
    } else {
      suggestedPriority = "normal";
      assessment = "STABLE — Routine care. Low risk of deterioration.";
    }

    // Check for red flags regardless of score
    const redFlags = [];
    if (spo2 != null && spo2 < 88) redFlags.push("Severe hypoxia (SpO₂ < 88%)");
    if (sbp != null && sbp < 80) redFlags.push("Hypotension (SBP < 80)");
    if (gcs != null && gcs <= 8) redFlags.push("Unconscious (GCS ≤ 8)");
    if (hr != null && hr > 130) redFlags.push("Severe tachycardia (HR > 130)");
    if (rr != null && rr > 30) redFlags.push("Severe tachypnea (RR > 30)");

    if (redFlags.length > 0 && suggestedPriority !== "emergency") {
      suggestedPriority = "emergency";
      assessment = "RED FLAGS detected — " + redFlags.join("; ") + ". Immediate attention required.";
    }

    return Response.json({
      mews_score: mewsScore,
      suggested_priority: suggestedPriority,
      assessment,
      breakdown,
      red_flags: redFlags,
      vitals_available: vitals != null,
      patient_age: patient?.date_of_birth 
        ? Math.round((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 86400000))
        : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});