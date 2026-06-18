import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    if (!data?.visit_id || !data?.patient_id) {
      return Response.json({ error: 'Missing visit_id or patient_id' }, { status: 400 });
    }

    const criticalAlerts = [];
    let isCritical = false;

    // Define critical thresholds
    if (data.gcs !== undefined && data.gcs < 13) {
      criticalAlerts.push(`GCS ${data.gcs} (critical: < 13)`);
      isCritical = true;
    }

    if (data.bp_systolic !== undefined && (data.bp_systolic < 90 || data.bp_systolic > 180)) {
      criticalAlerts.push(`BP Systolic ${data.bp_systolic} mmHg (critical: < 90 or > 180)`);
      isCritical = true;
    }

    if (data.bp_diastolic !== undefined && (data.bp_diastolic < 60 || data.bp_diastolic > 110)) {
      criticalAlerts.push(`BP Diastolic ${data.bp_diastolic} mmHg (critical: < 60 or > 110)`);
      isCritical = true;
    }

    if (data.heart_rate !== undefined && (data.heart_rate < 50 || data.heart_rate > 120)) {
      criticalAlerts.push(`Heart Rate ${data.heart_rate} bpm (critical: < 50 or > 120)`);
      isCritical = true;
    }

    if (data.respiratory_rate !== undefined && (data.respiratory_rate < 10 || data.respiratory_rate > 30)) {
      criticalAlerts.push(`Respiratory Rate ${data.respiratory_rate} (critical: < 10 or > 30)`);
      isCritical = true;
    }

    if (data.temperature !== undefined && (data.temperature < 35 || data.temperature > 39.5)) {
      criticalAlerts.push(`Temperature ${data.temperature}°C (critical: < 35 or > 39.5)`);
      isCritical = true;
    }

    if (data.spo2 !== undefined && data.spo2 < 90) {
      criticalAlerts.push(`SpO2 ${data.spo2}% (critical: < 90)`);
      isCritical = true;
    }

    if (data.pain_score !== undefined && data.pain_score >= 8) {
      criticalAlerts.push(`Pain Score ${data.pain_score}/10 (severe)`);
      isCritical = true;
    }

    if (!isCritical) {
      return Response.json({ status: "normal", message: "Vitals within normal range" });
    }

    // Get visit & patient info
    const [visit, patient] = await Promise.all([
      base44.asServiceRole.entities.Visit.get(data.visit_id),
      base44.asServiceRole.entities.Patient.get(data.patient_id),
    ]);

    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Patient";

    // Create emergency notification
    const notification = await base44.asServiceRole.entities.Notification.create({
      title: "🚨 CRITICAL VITALS ALERT",
      message: `${patientName} (${patient?.mrn || data.patient_id?.slice(0, 8)}): ${criticalAlerts.join("; ")}`,
      is_read: false,
      target_role: "doctor",
      priority: "critical",
      linked_visit_id: data.visit_id,
      linked_patient_id: data.patient_id,
    });

    // Log to audit trail
    await base44.asServiceRole.entities.AuditLog.create({
      entity_name: "VitalSigns",
      entity_id: data.id,
      action: "critical_alert",
      user_id: "system",
      description: `Critical vitals detected: ${criticalAlerts.join(", ")}`,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      status: "critical",
      alerts: criticalAlerts,
      notification_id: notification.id,
      patient: patientName,
    });

  } catch (error) {
    console.error("Error checking vitals:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});