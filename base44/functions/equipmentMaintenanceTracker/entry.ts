import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.equipment_id || !data?.equipment_name) {
      return Response.json({ error: "Missing equipment data" }, { status: 400 });
    }

    // Get maintenance history
    const history = await base44.asServiceRole.entities.AuditLog.filter(
      { entity_name: "Equipment", entity_id: data.equipment_id },
      "-created_date",
      20
    );

    const lastMaintenance = history.find(h => h.action === "maintenance_completed");
    const daysSinceLastMaintenance = lastMaintenance ? 
      Math.floor((Date.now() - new Date(lastMaintenance.timestamp).getTime()) / (1000 * 60 * 60 * 24)) : 
      null;

    // Define maintenance intervals (in days)
    const maintenanceIntervals = {
      "ecg": 90,
      "ventilator": 30,
      "suction": 60,
      "bp_monitor": 180,
      "glucose_meter": 90,
      "thermometer": 180,
      "oxygen_concentrator": 90,
      "pump": 30,
      "defibrillator": 60,
    };

    const equipmentType = Object.keys(maintenanceIntervals).find(t => data.equipment_name.toLowerCase().includes(t));
    const interval = equipmentType ? maintenanceIntervals[equipmentType] : 90;

    const dueForMaintenance = !lastMaintenance || (daysSinceLastMaintenance >= interval);

    if (dueForMaintenance) {
      await base44.asServiceRole.entities.Notification.create({
        title: "🔧 Equipment Maintenance Due",
        message: `${data.equipment_name} (${data.equipment_id}) due for scheduled maintenance. Last service: ${lastMaintenance ? new Date(lastMaintenance.timestamp).toLocaleDateString() : "Unknown"}. Schedule immediately.`,
        is_read: false,
        target_role: "admin",
        priority: "high",
      });
    }

    // Log maintenance if completed
    if (data.maintenance_completed) {
      await base44.asServiceRole.entities.AuditLog.create({
        entity_name: "Equipment",
        entity_id: data.equipment_id,
        action: "maintenance_completed",
        user_id: data.technician_id || "system",
        description: `${data.equipment_name} maintenance completed. Notes: ${data.maintenance_notes || "None"}`,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      status: "success",
      equipment_id: data.equipment_id,
      equipment_name: data.equipment_name,
      days_since_last_maintenance: daysSinceLastMaintenance,
      maintenance_interval_days: interval,
      due_for_maintenance: dueForMaintenance,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});