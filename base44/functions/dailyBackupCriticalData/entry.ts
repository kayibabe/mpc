import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const timestamp = new Date().toISOString();
    const [patients, schemes, invoices, visits, admissions] = await Promise.all([
      base44.asServiceRole.entities.Patient.list('-created_date', 1000),
      base44.asServiceRole.entities.MedicalAidScheme.list('', 100),
      base44.asServiceRole.entities.Invoice.list('-created_date', 1000),
      base44.asServiceRole.entities.Visit.list('-created_date', 500),
      base44.asServiceRole.entities.Admission.list('-created_date', 500),
    ]);

    const backup = {
      timestamp,
      backup_date: new Date().toLocaleDateString('en-GB'),
      counts: {
        patients: patients.length,
        schemes: schemes.length,
        invoices: invoices.length,
        visits: visits.length,
        admissions: admissions.length,
      },
      entities: {
        patients: patients.slice(0, 100),
        schemes,
        invoices: invoices.slice(0, 100),
        visits: visits.slice(0, 100),
        admissions: admissions.slice(0, 50),
      },
      status: 'success',
    };

    return Response.json(backup);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});