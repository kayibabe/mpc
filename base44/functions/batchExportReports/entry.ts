import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { reports } = body;

    if (!reports || !Array.isArray(reports) || reports.length === 0) {
      return Response.json({ error: 'No reports specified' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const todayStart = today + 'T00:00:00';
    const results = {};

    // Run all requested report queries in parallel
    const tasks = reports.map(async (name) => {
      try {
        switch (name) {
          case 'daily': {
            const [visits, appointments, admissions, drugs, labOrders, invoices] = await Promise.all([
              base44.asServiceRole.entities.Visit.filter({ created_date: { $gte: todayStart } }, '', 500),
              base44.asServiceRole.entities.Appointment.filter({ appointment_date: today }, '', 200),
              base44.asServiceRole.entities.Admission.filter({ status: 'active' }, '', 100),
              base44.asServiceRole.entities.Drug.list('', 500),
              base44.asServiceRole.entities.LabOrder.filter({ status: { $in: ['ordered', 'in_progress'] } }, '', 200),
              base44.asServiceRole.entities.Invoice.filter({ created_date: { $gte: todayStart } }, '', 500),
            ]);
            const lowStock = drugs.filter(d => d.quantity_in_stock <= d.reorder_level).length;
            const revenue = invoices.reduce((s, i) => s + (i.net_amount || i.total_amount || 0), 0);
            results[name] = { status: 'ok', summary: `Visits: ${visits.length}, Appts: ${appointments.length}, Inpatients: ${admissions.length}, Low Stock: ${lowStock}, Revenue: MWK ${revenue.toLocaleString()}` };
            break;
          }
          case 'revenue': {
            const [invoices, payments] = await Promise.all([
              base44.asServiceRole.entities.Invoice.filter({ created_date: { $gte: new Date(Date.now() - 30 * 86400000).toISOString() } }, '', 1000),
              base44.asServiceRole.entities.Payment.filter({ created_date: { $gte: new Date(Date.now() - 30 * 86400000).toISOString() } }, '', 1000),
            ]);
            const totalRevenue = invoices.reduce((s, i) => s + (i.net_amount || i.total_amount || 0), 0);
            const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
            results[name] = { status: 'ok', summary: `30d Revenue: MWK ${totalRevenue.toLocaleString()}, Collected: MWK ${totalCollected.toLocaleString()}, Invoices: ${invoices.length}` };
            break;
          }
          case 'dhis2': {
            const period = new Date().toISOString().slice(0, 7);
            const [visits, diagnoses, admissions] = await Promise.all([
              base44.asServiceRole.entities.Visit.filter({ created_date: { $gte: period + '-01' } }, '', 1000),
              base44.asServiceRole.entities.Diagnosis.filter({ created_date: { $gte: period + '-01' } }, '', 1000),
              base44.asServiceRole.entities.Admission.list('', 500),
            ]);
            const activeAdmissions = admissions.filter(a => a.status === 'admitted' || a.status === 'active').length;
            results[name] = { status: 'ok', summary: `Period: ${period}, Visits: ${visits.length}, Diagnoses: ${diagnoses.length}, Active Inpatients: ${activeAdmissions}` };
            break;
          }
          case 'reorder': {
            const drugs = await base44.asServiceRole.entities.Drug.filter({ status: 'active' }, '', 500);
            const lowStock = drugs.filter(d => d.quantity_in_stock <= d.reorder_level);
            results[name] = { status: 'ok', summary: `${lowStock.length} drugs below reorder threshold${lowStock.length > 0 ? ` (e.g. ${lowStock.slice(0, 3).map(d => d.name).join(', ')})` : ''}` };
            break;
          }
          case 'forecast': {
            const drugs = await base44.asServiceRole.entities.Drug.list('', 500);
            const active = drugs.filter(d => d.status === 'active');
            const critical = active.filter(d => d.quantity_in_stock <= d.reorder_level).length;
            const warning = active.filter(d => d.quantity_in_stock > d.reorder_level && d.quantity_in_stock <= d.reorder_level * 2).length;
            results[name] = { status: 'ok', summary: `${active.length} drugs: ${critical} critical, ${warning} warning, ${active.length - critical - warning} adequate` };
            break;
          }
          case 'patients': {
            const patients = await base44.asServiceRole.entities.Patient.list('-created_date', 1000);
            const data = patients.map(p => ({
              mrn: p.mrn || '',
              first_name: p.first_name || '',
              last_name: p.last_name || '',
              gender: p.gender || '',
              date_of_birth: p.date_of_birth || '',
              phone: p.phone || '',
              district: p.district || '',
              village: p.village || '',
              status: p.status || '',
              registration_date: p.created_date || '',
            }));
            results[name] = { status: 'ok', summary: `${patients.length} patients exported`, data };
            break;
          }
          case 'visits': {
            const todayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00';
            const visits = await base44.asServiceRole.entities.Visit.filter({ created_date: { $gte: todayStart } }, '-created_date', 1000);
            const data = visits.map(v => ({
              visit_type: v.visit_type || '',
              payment_type: v.payment_type || '',
              queue_status: v.queue_status || '',
              priority: v.priority || 'normal',
              department: v.department || '',
              scheme_name: v.scheme_name || '',
              visit_date: v.created_date || '',
            }));
            results[name] = { status: 'ok', summary: `${visits.length} visits exported`, data };
            break;
          }
          default:
            results[name] = { status: 'skipped', summary: 'Unknown report type' };
        }
      } catch (e) {
        results[name] = { status: 'error', summary: e.message };
      }
    });

    await Promise.all(tasks);

    return Response.json({ exports: results, generated_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});