import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Use service role for automation triggers
    const body = await req.json();
    const { event, data } = body;

    // Only fire for final or verified results
    const result = data;
    if (!result || (result.status !== "final" && result.status !== "verified")) {
      return Response.json({ skipped: true, reason: "Status not final/verified" });
    }

    const labOrderId = result.lab_order_id;
    const patientId = result.patient_id;

    // Find the associated LabOrder to get the ordering doctor
    let labOrder = null;
    try {
      labOrder = await base44.asServiceRole.entities.LabOrder.get(labOrderId);
    } catch (e) {
      return Response.json({ error: "Lab order not found", details: e.message }, { status: 404 });
    }

    const orderedBy = labOrder.ordered_by;
    if (!orderedBy) {
      return Response.json({ skipped: true, reason: "No ordering doctor on lab order" });
    }

    // Get patient name for the notification
    let patientName = patientId?.slice(0, 8) || "Unknown";
    try {
      const patient = await base44.asServiceRole.entities.Patient.get(patientId);
      if (patient) patientName = `${patient.first_name} ${patient.last_name}`;
    } catch (_) {}

    const isCritical = result.is_critical;
    const testName = result.test_name || "Lab Test";

    // Create notification for the ordering doctor
    const notifTitle = isCritical
      ? `🚨 CRITICAL Lab Result: ${testName}`
      : `📋 Lab Result Ready: ${testName}`;

    const notifMessage = isCritical
      ? `CRITICAL result for ${patientName}: ${testName} = ${result.result_value} ${result.unit || ""}. Immediate review required.`
      : `Result for ${patientName}: ${testName} = ${result.result_value} ${result.unit || ""} (${result.status}).`;

    await base44.asServiceRole.entities.Notification.create({
      title: notifTitle,
      message: notifMessage,
      type: isCritical ? "alert" : "workflow",
      target_user_id: orderedBy,
      target_role: "clinical",
      patient_id: patientId,
      visit_id: labOrder.visit_id || "",
      action_url: "/clinical",
    });

    // If critical, also notify admin and lab roles
    if (isCritical) {
      await base44.asServiceRole.entities.Notification.create({
        title: `🚨 CRITICAL: ${testName} for ${patientName}`,
        message: `Critical lab value: ${result.result_value} ${result.unit || ""}. Ordered by doctor ${orderedBy?.slice(0, 8)}.`,
        type: "alert",
        target_role: "admin",
        patient_id: patientId,
        visit_id: labOrder.visit_id || "",
      });
    }

    // Update the lab order status if not already completed
    if (labOrder.status !== "completed" && labOrder.status !== "verified") {
      try {
        await base44.asServiceRole.entities.LabOrder.update(labOrderId, {
          status: "completed",
        });
      } catch (_) {}
    }

    return Response.json({
      success: true,
      notified_doctor: orderedBy,
      patient: patientName,
      test: testName,
      is_critical: isCritical,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});