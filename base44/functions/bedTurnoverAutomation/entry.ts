import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.bed_id) return Response.json({ error: "Missing bed data" }, { status: 400 });

    const bed = await base44.asServiceRole.entities.Bed.get(data.bed_id);
    if (!bed) return Response.json({ error: "Bed not found" }, { status: 404 });

    // Get discharge log for this bed
    const discharges = await base44.asServiceRole.entities.AuditLog.filter(
      { entity_name: "Bed", entity_id: data.bed_id, action: "patient_discharged" },
      "-created_date",
      1
    );

    const lastDischarge = discharges.length > 0 ? new Date(discharges[0].timestamp) : null;
    const minutesSinceDischarge = lastDischarge ? Math.floor((Date.now() - lastDischarge.getTime()) / (1000 * 60)) : null;

    const targetTurnaroundTime = 30; // minutes
    const cleaningStatus = minutesSinceDischarge === null ? "ready_for_admission" : 
                           minutesSinceDischarge < targetTurnaroundTime ? "cleaning_in_progress" : 
                           "ready_for_admission";

    // If cleaning complete, auto-change bed status
    if (cleaningStatus === "ready_for_admission" && bed.status === "cleaning") {
      await base44.asServiceRole.entities.Bed.update(data.bed_id, { status: "available" });

      // Notify bed assignment staff
      const ward = await base44.asServiceRole.entities.Ward.get(bed.ward_id);
      await base44.asServiceRole.entities.Notification.create({
        title: `✅ Bed Ready for Admission`,
        message: `${ward?.name}, Bed ${bed.bed_number} cleaned and ready. Assign new patient if available.`,
        is_read: false,
        target_role: "nurse",
        priority: "normal",
      });
    }

    // Alert if turnaround exceeds threshold
    if (minutesSinceDischarge && minutesSinceDischarge > targetTurnaroundTime * 1.5) {
      await base44.asServiceRole.entities.Notification.create({
        title: "⏱️ Slow Bed Turnover",
        message: `Bed ${bed.bed_number} cleaning delayed (${minutesSinceDischarge} min). Expedite cleaning.`,
        is_read: false,
        target_role: "nurse",
        priority: "normal",
      });
    }

    // Log turnover event
    await base44.asServiceRole.entities.AuditLog.create({
      entity_name: "BedTurnover",
      entity_id: data.bed_id,
      action: "turnover_tracked",
      user_id: "system",
      description: `Cleaning status: ${cleaningStatus}. Turnaround time: ${minutesSinceDischarge || 0} min`,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      status: "success",
      bed_id: data.bed_id,
      bed_number: bed.bed_number,
      cleaning_status: cleaningStatus,
      minutes_since_discharge: minutesSinceDischarge,
      target_turnaround_min: targetTurnaroundTime,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});