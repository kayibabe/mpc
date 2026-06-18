import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const results = {};

    // Test 1: Patient list
    const t1 = performance.now();
    await base44.asServiceRole.entities.Patient.list('-created_date', 1000);
    results.patient_list_ms = Math.round(performance.now() - t1);

    // Test 2: Visit filter
    const t2 = performance.now();
    await base44.asServiceRole.entities.Visit.filter({ queue_status: 'completed' }, '-created_date', 500);
    results.visit_filter_ms = Math.round(performance.now() - t2);

    // Test 3: Invoice aggregation
    const t3 = performance.now();
    await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
    results.invoice_list_ms = Math.round(performance.now() - t3);

    // Test 4: Appointment queries
    const t4 = performance.now();
    await base44.asServiceRole.entities.Appointment.list('-appointment_date', 500);
    results.appointment_list_ms = Math.round(performance.now() - t4);

    // Test 5: Bed occupancy
    const t5 = performance.now();
    await base44.asServiceRole.entities.Bed.filter({ status: 'occupied' }, '', 500);
    results.bed_filter_ms = Math.round(performance.now() - t5);

    results.status = 'ok';
    results.tested_at = new Date().toISOString();
    results.avg_ms = Math.round(Object.values(results).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0) / 5);
    results.performance = results.avg_ms < 200 ? 'excellent' : results.avg_ms < 500 ? 'good' : 'needs optimization';

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});