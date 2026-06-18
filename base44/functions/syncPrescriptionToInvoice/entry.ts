import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    if (!data?.visit_id || !data?.patient_id) {
      return Response.json({ error: 'Missing visit_id or patient_id' }, { status: 400 });
    }

    // Get prescription items for this prescription
    const items = await base44.asServiceRole.entities.PrescriptionItem.filter(
      { prescription_id: data.id },
      "",
      100
    );

    if (items.length === 0) {
      return Response.json({ status: "skipped", reason: "No prescription items to invoice" });
    }

    // Get or create invoice for visit
    const invoices = await base44.asServiceRole.entities.Invoice.filter(
      { visit_id: data.visit_id, status: { $nin: ["cancelled", "refunded"] } },
      "-created_date",
      1
    );

    let invoice = invoices[0];
    if (!invoice) {
      invoice = await base44.asServiceRole.entities.Invoice.create({
        visit_id: data.visit_id,
        patient_id: data.patient_id,
        invoice_number: `INV-${Date.now()}`,
        total_amount: 0,
        status: "draft",
        payment_type: "both",
      });
    }

    // Create InvoiceItem for prescription
    const totalCost = items.reduce((sum, item) => sum + (item.quantity * 50), 0); // 50 MWK per unit default

    const invoiceItem = await base44.asServiceRole.entities.InvoiceItem.create({
      invoice_id: invoice.id,
      visit_id: data.visit_id,
      patient_id: data.patient_id,
      service_type: "prescription",
      description: `Prescription: ${items.map(i => i.drug_name).join(", ")}`,
      quantity: items.length,
      unit_price: 50,
      total_amount: totalCost,
      status: "pending",
      linked_entity_type: "Prescription",
      linked_entity_id: data.id,
    });

    // Update invoice total
    const allItems = await base44.asServiceRole.entities.InvoiceItem.filter(
      { invoice_id: invoice.id, status: { $ne: "cancelled" } },
      "",
      100
    );
    const newTotal = allItems.reduce((sum, i) => sum + (i.total_amount || 0), 0);

    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      total_amount: newTotal,
      net_amount: newTotal,
    });

    return Response.json({
      status: "success",
      invoice_id: invoice.id,
      item_id: invoiceItem.id,
      amount: totalCost,
    });

  } catch (error) {
    console.error("Error syncing prescription to invoice:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});