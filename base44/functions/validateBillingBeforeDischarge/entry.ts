import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { visit_id, proposed_status } = body;

    if (!visit_id) {
      return Response.json({ error: 'Missing visit_id' }, { status: 400 });
    }

    // Only validate when attempting to complete or discharge
    if (!["completed", "discharged"].includes(proposed_status)) {
      return Response.json({ status: "valid", reason: "Status change does not require billing validation" });
    }

    // Get all invoices for this visit
    const invoices = await base44.asServiceRole.entities.Invoice.filter(
      { visit_id: visit_id },
      "-created_date",
      100
    );

    if (invoices.length === 0) {
      return Response.json({ status: "valid", reason: "No invoices found for this visit" });
    }

    // Check if any invoice is unpaid
    const unpaidInvoices = invoices.filter(inv => !["paid", "refunded"].includes(inv.status));

    if (unpaidInvoices.length > 0) {
      const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + (inv.net_amount || 0), 0);
      return Response.json({
        status: "blocked",
        reason: `Cannot discharge: ${unpaidInvoices.length} unpaid invoice(s) totalling MWK ${totalUnpaid}`,
        unpaid_invoices: unpaidInvoices.map(i => ({
          id: i.id,
          invoice_number: i.invoice_number,
          amount: i.net_amount,
          status: i.status,
        })),
      }, { status: 403 });
    }

    return Response.json({
      status: "valid",
      reason: "All invoices paid. Discharge approved.",
      total_invoices: invoices.length,
    });

  } catch (error) {
    console.error("Error validating billing:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});