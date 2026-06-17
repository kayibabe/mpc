import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { claim_id } = await req.json();
    if (!claim_id) return Response.json({ error: 'Missing claim_id' }, { status: 400 });

    const claim = await base44.entities.InsuranceClaim.get(claim_id);
    if (!claim) return Response.json({ error: 'Claim not found' }, { status: 404 });

    // Fetch related invoice
    const invoice = await base44.entities.Invoice.get(claim.invoice_id);
    const patient = await base44.entities.Patient.get(claim.patient_id);

    const errors = [];
    const warnings = [];

    // Validation rules
    if (!claim.invoice_id) errors.push("No invoice linked");
    if (!claim.patient_id) errors.push("No patient linked");
    if (!claim.scheme_name) errors.push("Scheme name missing");
    if (claim.claim_amount <= 0) errors.push("Invalid claim amount");
    if (!claim.claim_amount) errors.push("Claim amount not set");

    if (invoice) {
      if (invoice.status === "paid") warnings.push("Invoice already paid");
      if (invoice.total_amount > 0 && claim.claim_amount > invoice.total_amount) {
        warnings.push("Claim amount exceeds invoice total");
      }
    }

    if (patient) {
      if (!patient.medical_aid_number) warnings.push("Patient missing medical aid number");
    }

    // Check for duplicate submissions within 7 days
    const recentClaims = await base44.entities.InsuranceClaim.filter({
      invoice_id: claim.invoice_id,
      scheme_id: claim.scheme_id
    }, "-created_date", 10);

    const submittedRecently = recentClaims.filter(c => {
      const daysAgo = (Date.now() - new Date(c.submitted_date).getTime()) / (1000 * 60 * 60 * 24);
      return c.status === "submitted" && daysAgo < 7;
    });

    if (submittedRecently.length > 1) {
      warnings.push(`Duplicate submission detected: ${submittedRecently.length} claims submitted in last 7 days`);
    }

    return Response.json({
      claim_id,
      valid: errors.length === 0,
      errors,
      warnings,
      claim: {
        id: claim.id,
        status: claim.status,
        amount: claim.claim_amount,
        scheme: claim.scheme_name
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});