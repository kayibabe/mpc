import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Generate daily ward report
    const wards = await base44.entities.Ward.list("", 50);
    const beds = await base44.entities.Bed.list("", 500);
    const admissions = await base44.entities.Admission.filter(
      { status: "active" },
      "",
      500
    );

    const wardReports = wards.map(ward => {
      const wardBeds = beds.filter(b => b.ward_id === ward.id);
      const occupiedBeds = wardBeds.filter(b => b.status === "occupied");
      const wardAdmissions = admissions.filter(a => a.ward_id === ward.id);
      const criticalPatients = wardAdmissions.filter(a => a.priority === "high");

      return {
        ward_id: ward.id,
        ward_name: ward.name,
        total_beds: wardBeds.length,
        occupied_beds: occupiedBeds.length,
        available_beds: wardBeds.length - occupiedBeds.length,
        occupancy_rate: wardBeds.length > 0 ? ((occupiedBeds.length / wardBeds.length) * 100).toFixed(0) : 0,
        patient_count: wardAdmissions.length,
        critical_patients: criticalPatients.length,
        report_date: new Date().toISOString(),
      };
    });

    // Create summary notification
    const totalOccupancy = wardReports.length > 0
      ? Math.round(wardReports.reduce((sum, r) => sum + parseInt(r.occupancy_rate), 0) / wardReports.length)
      : 0;

    await base44.entities.Notification.create({
      title: "Daily Ward Report",
      message: `Overall Occupancy: ${totalOccupancy}% | Critical Patients: ${wardReports.reduce((sum, r) => sum + r.critical_patients, 0)}`,
      target_role: "admin",
      is_read: false,
    });

    return Response.json({
      ward_reports: wardReports,
      total_occupancy: totalOccupancy,
      report_count: wardReports.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});