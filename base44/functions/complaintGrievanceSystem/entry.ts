import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.patient_id || !data?.complaint) {
      return Response.json({ error: "Missing complaint data" }, { status: 400 });
    }

    const patient = await base44.asServiceRole.entities.Patient.get(data.patient_id);

    // Create complaint record
    const complaintRecord = await base44.asServiceRole.entities.AuditLog.create({
      entity_name: "PatientComplaint",
      entity_id: data.patient_id,
      action: "complaint_filed",
      user_id: "system",
      description: `Complaint: ${data.complaint}. Category: ${data.category || "general"}. Severity: ${data.severity || "normal"}`,
      timestamp: new Date().toISOString(),
    });

    // Categorize complaint
    const categoryMap = {
      "staff_behavior": "Clinical Staff Conduct",
      "cleanliness": "Facility Cleanliness",
      "billing": "Billing/Finance",
      "care_quality": "Quality of Care",
      "communication": "Communication Issues",
      "wait_time": "Long Wait Times",
      "facilities": "Facilities/Amenities",
      "other": "Other",
    };

    const category = categoryMap[data.category] || "Other";
    const severity = data.severity || "normal";

    // Escalate if severe
    const escalateToDirector = severity === "critical" || data.category === "staff_behavior";

    // Notify management
    await base44.asServiceRole.entities.Notification.create({
      title: `📋 Patient Complaint: ${category}`,
      message: `${patient.first_name} ${patient.last_name}: "${data.complaint}". Severity: ${severity}. ${escalateToDirector ? "ESCALATE TO DIRECTOR" : "Route to department head."}`,
      is_read: false,
      target_role: escalateToDirector ? "admin" : "receptionist",
      priority: severity === "critical" ? "critical" : severity === "high" ? "high" : "normal",
      linked_patient_id: data.patient_id,
    });

    // Track complaint for quality metrics
    await base44.asServiceRole.entities.AuditLog.create({
      entity_name: "ComplaintTracking",
      entity_id: category,
      action: "complaint_logged",
      user_id: "system",
      description: `${severity} severity complaint received`,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      status: "success",
      patient_id: data.patient_id,
      complaint_id: complaintRecord.id,
      category: category,
      severity: severity,
      escalated: escalateToDirector,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});