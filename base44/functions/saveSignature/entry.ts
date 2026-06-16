import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_url, document_type, document_id, patient_id, visit_id } = body;

    if (!file_url || !document_type || !document_id || !patient_id) {
      return Response.json({ error: 'Missing required fields: file_url, document_type, document_id, patient_id' }, { status: 400 });
    }

    // Create the digital signature record
    const sig = await base44.asServiceRole.entities.DigitalSignature.create({
      document_type,
      document_id,
      patient_id,
      visit_id: visit_id || '',
      signed_by: user.id,
      signed_by_name: user.full_name || 'Clinician',
      signed_by_title: user.role === 'admin' ? 'Medical Officer' : 'Clinician',
      signature_url: file_url,
      signed_at: new Date().toISOString(),
      notes: `Digitally signed via HIMS`,
    });

    return Response.json({
      success: true,
      signature: sig,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});