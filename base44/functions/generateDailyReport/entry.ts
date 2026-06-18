import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date().toISOString().slice(0, 10);
    const todayStart = today + 'T00:00:00';

    const [
      todayVisits,
      todayAppointments,
      activeAdmissions,
      lowStockDrugs,
      pendingLabOrders,
      todayInvoices,
    ] = await Promise.all([
      base44.asServiceRole.entities.Visit.filter({ created_date: { $gte: todayStart } }, '', 500),
      base44.asServiceRole.entities.Appointment.filter({ appointment_date: today }, '', 200),
      base44.asServiceRole.entities.Admission.filter({ status: 'active' }, '', 100),
      base44.asServiceRole.entities.Drug.filter({}, '', 500),
      base44.asServiceRole.entities.LabOrder.filter({ status: { $in: ['ordered', 'in_progress'] } }, '', 200),
      base44.asServiceRole.entities.Invoice.filter({ created_date: { $gte: todayStart }, status: { $in: ['paid', 'partial'] } }, '', 500),
    ]);

    const lowStock = lowStockDrugs.filter(d => d.quantity_in_stock <= d.reorder_level);
    const totalRevenue = todayInvoices.reduce((sum, inv) => sum + (inv.net_amount || inv.total_amount || 0), 0);

    const visitBreakdown = {};
    todayVisits.forEach(v => {
      const type = v.visit_type || 'unknown';
      visitBreakdown[type] = (visitBreakdown[type] || 0) + 1;
    });

    const paymentBreakdown = {};
    todayVisits.forEach(v => {
      const pt = v.payment_type || 'unknown';
      paymentBreakdown[pt] = (paymentBreakdown[pt] || 0) + 1;
    });

    const completedAppts = todayAppointments.filter(a => a.status === 'completed' || a.status === 'checked_in');
    const noShows = todayAppointments.filter(a => a.status === 'no_show');

    const report = {
      date: today,
      generated_at: new Date().toISOString(),
      summary: {
        total_visits_today: todayVisits.length,
        total_appointments_today: todayAppointments.length,
        appointments_completed: completedAppts.length,
        appointments_no_show: noShows.length,
        active_inpatients: activeAdmissions.length,
        pending_lab_orders: pendingLabOrders.length,
        drugs_low_stock: lowStock.length,
        total_revenue_mwk: totalRevenue,
      },
      visit_breakdown: visitBreakdown,
      payment_breakdown: paymentBreakdown,
      low_stock_drugs: lowStock.map(d => ({
        name: d.name,
        generic_name: d.generic_name,
        stock: d.quantity_in_stock,
        reorder_level: d.reorder_level,
      })),
      recent_visits: todayVisits.slice(0, 20).map(v => ({
        id: v.id,
        patient_id: v.patient_id,
        visit_type: v.visit_type,
        payment_type: v.payment_type,
        queue_status: v.queue_status,
        time: v.created_date,
      })),
    };

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});