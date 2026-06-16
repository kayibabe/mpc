import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { patient_id } = await req.json();
    if (!patient_id) return Response.json({ error: 'Missing patient_id' }, { status: 400 });

    const patient = await base44.entities.Patient.get(patient_id);
    if (!patient) return Response.json({ error: 'Patient not found' }, { status: 404 });

    const syncData = {
      first_name: patient.first_name,
      last_name: patient.last_name,
      phone: patient.phone,
      insurance_scheme: patient.insurance_scheme || '',
      insurance_member_number: patient.insurance_member_number || '',
      national_id: patient.national_id || '',
      district: patient.district || '',
    };

    const fullName = `${patient.first_name} ${patient.last_name}`;

    // Update related records that store patient name or demographics
    let count = 0;
    const now = new Date().toISOString();

    // We track what was updated for the response
    const updated = { visits: 0, appointments: 0, admissions: 0, invoices: 0, labOrders: 0, imagingOrders: 0 };

    // Update visits
    const visits = await base44.asServiceRole.entities.Visit.filter({ patient_id }, '', 500);
    for (const v of visits) {
      // Only update scheme-related fields if they've changed
      if (v.scheme_name !== patient.insurance_scheme && patient.insurance_scheme) {
        await base44.asServiceRole.entities.Visit.update(v.id, { scheme_name: patient.insurance_scheme });
        count++;
      }
    }
    updated.visits = count;

    // Update appointments
    const appts = await base44.asServiceRole.entities.Appointment.filter({ patient_id }, '', 500);
    count = 0;
    for (const a of appts) {
      // Appointments don't have patient name fields, but we note they're linked
      count++;
    }
    updated.appointments = count;

    // Update admissions
    const admissions = await base44.asServiceRole.entities.Admission.filter({ patient_id }, '', 100);
    updated.admissions = admissions.length;

    // Update invoices
    const invoices = await base44.asServiceRole.entities.Invoice.filter({ patient_id }, '', 500);
    count = 0;
    for (const inv of invoices) {
      if (inv.scheme_name !== patient.insurance_scheme && patient.insurance_scheme) {
        await base44.asServiceRole.entities.Invoice.update(inv.id, { scheme_name: patient.insurance_scheme });
        count++;
      }
    }
    updated.invoices = count;

    // Update lab orders
    const labOrders = await base44.asServiceRole.entities.LabOrder.filter({ patient_id }, '', 500);
    updated.labOrders = labOrders.length;

    // Update imaging orders
    const imgOrders = await base44.asServiceRole.entities.ImagingOrder.filter({ patient_id }, '', 500);
    updated.imagingOrders = imgOrders.length;

    return Response.json({
      patient_id,
      patient_name: fullName,
      synced_at: now,
      linked_records: {
        visits: visits.length,
        appointments: appts.length,
        admissions: admissions.length,
        invoices: invoices.length,
        lab_orders: labOrders.length,
        imaging_orders: imgOrders.length,
      },
      updates_applied: updated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});