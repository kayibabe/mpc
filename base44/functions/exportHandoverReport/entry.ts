import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const handovers = await base44.asServiceRole.entities.DoctorHandover.filter(
      { created_date: { $gte: thirtyDaysAgo } },
      "-created_date",
      200
    );

    const users = await base44.asServiceRole.entities.User.list("", 50);
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.full_name || u.email || u.id.slice(0, 8); });

    // Build CSV
    const headers = [
      "Date", "Shift Type", "From Doctor", "To Doctor", "Status",
      "Active Patients", "Critical Cases", "Pending Investigations",
      "Treatment Updates", "Discharge Planning", "New Admissions", "Incidents", "General Notes"
    ];

    const rows = handovers.map(h => {
      const activePatients = h.active_patients ? JSON.parse(h.active_patients) : [];
      return [
        new Date(h.handover_date || h.created_date).toLocaleDateString("en-GB"),
        h.shift_type || "",
        userMap[h.from_doctor_id || h.created_by_id] || "Unknown",
        userMap[h.to_doctor_id] || "—",
        h.status || "pending",
        activePatients.length,
        (h.critical_cases || "").replace(/,/g, ";"),
        (h.pending_investigations || "").replace(/,/g, ";"),
        (h.treatment_updates || "").replace(/,/g, ";"),
        (h.discharge_planning || "").replace(/,/g, ";"),
        (h.new_admissions || "").replace(/,/g, ";"),
        (h.incidents || "").replace(/,/g, ";"),
        (h.general_notes || "").replace(/,/g, ";"),
      ];
    });

    const escapeCSV = (val) => `"${String(val).replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map(r => r.map(escapeCSV).join(","))].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=doctor-handover-report-${new Date().toISOString().slice(0, 10)}.csv`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});