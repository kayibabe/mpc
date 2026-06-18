import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().slice(0, 10);

    // Get current emergency visits
    const erVisits = await base44.asServiceRole.entities.Visit.filter(
      { visit_type: "emergency", queue_status: { $in: ["waiting", "triaged", "in_consultation"] } },
      "",
      200
    );

    // Get available beds
    const availableBeds = await base44.asServiceRole.entities.Bed.filter(
      { status: "available" },
      "",
      200
    );

    // Define surge thresholds
    const CRITICAL_SURGE = 15;
    const HIGH_SURGE = 10;
    const NORMAL_CAPACITY = 8;

    const surgeLevel = erVisits.length > CRITICAL_SURGE ? "critical" : erVisits.length > HIGH_SURGE ? "high" : "normal";
    const surgePct = Math.round((erVisits.length / CRITICAL_SURGE) * 100);

    const actions = [];
    const protocols = [];

    if (surgeLevel === "critical") {
      // Activate critical surge protocols
      protocols.push("CRITICAL SURGE ACTIVATED");
      actions.push("📢 Activate emergency code");
      actions.push("🚑 Call in on-call staff reserve");
      actions.push("⏭️ Divert non-emergency patients to other facilities");
      actions.push("🏥 Open surge beds in isolation ward");
      actions.push("📋 Activate triage fast-track");

      // Check available staff
      const onCallDoctors = await base44.asServiceRole.entities.User.filter(
        { role: "doctor" },
        "",
        50
      );
      const onCallNurses = await base44.asServiceRole.entities.User.filter(
        { role: "nurse" },
        "",
        50
      );

      if (onCallDoctors.length < 2) {
        actions.push("⚠️ CRITICAL: Call emergency backup doctors");
      }
      if (onCallNurses.length < 4) {
        actions.push("⚠️ CRITICAL: Call emergency backup nurses");
      }

      // Cancel elective procedures
      const electiveSurgeries = await base44.asServiceRole.entities.SurgicalBooking.filter(
        { status: "scheduled", priority: "elective" },
        "",
        100
      );

      if (electiveSurgeries.length > 0) {
        actions.push(`📌 Postpone ${electiveSurgeries.length} elective surgeries`);
        // Auto-cancel electives
        for (const surgery of electiveSurgeries) {
          await base44.asServiceRole.entities.SurgicalBooking.update(surgery.id, { 
            status: "postponed", 
            cancellation_reason: "Emergency surge protocols activated"
          });
        }
      }

    } else if (surgeLevel === "high") {
      protocols.push("HIGH SURGE PROTOCOL");
      actions.push("📢 Activate high surge alert");
      actions.push("👥 Request available staff standby");
      actions.push("⏸️ Slow non-emergency admissions");
      actions.push("📋 Accelerate triage and treatment");

    } else {
      protocols.push("NORMAL CAPACITY - Green");
    }

    // Create surge alert
    if (surgeLevel !== "normal") {
      await base44.asServiceRole.entities.Notification.create({
        title: `🚨 EMERGENCY SURGE: ${surgeLevel.toUpperCase()} (${erVisits.length} patients, ${surgePct}% capacity)`,
        message: `Actions: ${actions.join("; ")}`,
        is_read: false,
        target_role: "admin",
        priority: surgeLevel === "critical" ? "critical" : "high",
      });

      // Notify all staff
      await base44.asServiceRole.entities.Notification.create({
        title: `📢 SURGE PROTOCOL: ${surgeLevel.toUpperCase()}`,
        message: `ER Census: ${erVisits.length} patients. Activation status: ${protocols.join(", ")}`,
        is_read: false,
        target_role: "doctor",
        priority: surgeLevel === "critical" ? "critical" : "high",
      });
    }

    // Log surge event
    await base44.asServiceRole.entities.AuditLog.create({
      entity_name: "EmergencySurge",
      entity_id: today,
      action: "surge_assessment",
      user_id: "system",
      description: `Surge level: ${surgeLevel}. ER Census: ${erVisits.length}. Available beds: ${availableBeds.length}`,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      status: "success",
      timestamp: new Date().toISOString(),
      er_census: erVisits.length,
      capacity_pct: surgePct,
      surge_level: surgeLevel,
      available_beds: availableBeds.length,
      protocols_activated: protocols,
      actions: actions,
    });

  } catch (error) {
    console.error("Error assessing surge capacity:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});