import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'cashier'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: admin or cashier role required' }, { status: 403 });
    }

    // Fetch all pending claims
    const pendingClaims = await base44.entities.InsuranceClaim.filter(
      { status: "pending" },
      "-created_date",
      100
    );

    const results = { submitted: 0, failed: 0, errors: [] };

    for (const claim of pendingClaims) {
      try {
        // Validate claim before submission
        if (!claim.invoice_id || !claim.scheme_name || claim.claim_amount <= 0) {
          results.failed++;
          results.errors.push({
            claim_id: claim.id,
            error: "Invalid claim data: missing invoice, scheme, or amount"
          });
          continue;
        }

        // Update status to submitted
        await base44.entities.InsuranceClaim.update(claim.id, {
          status: "submitted",
          submitted_date: new Date().toISOString(),
        });
        results.submitted++;
      } catch (e) {
        results.failed++;
        results.errors.push({
          claim_id: claim.id,
          error: e.message
        });
      }
    }

    return Response.json({
      message: `Automated submission completed: ${results.submitted} submitted, ${results.failed} failed`,
      ...results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});