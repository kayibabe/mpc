import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    if (!data?.visit_id || !data?.patient_id) {
      return Response.json({ error: 'Missing visit_id or patient_id' }, { status: 400 });
    }

    // Get or create the main invoice for this visit
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

    // Determine service type and cost
    let serviceType = "service";
    let description = "Clinical Service";
    let amount = 0;

    if (event.entity_name === "LabOrder") {
      serviceType = "lab_test";
      description = `Lab: ${data.tests ? JSON.parse(data.tests)[0] : "Test"}`;
      amount = 150; // Default lab test cost (MWK)
    } else if (event.entity_name === "ImagingOrder") {
      serviceType = "imaging_study";
      description = `Imaging: ${data.study_type || "Study"}`;
      amount = 500; // Default imaging cost (MWK)
    } else if (event.entity_name === "Prescription") {
      // For prescriptions, invoice is generated per dispensed item in pharmacy
      return Response.json({ status: "skipped", reason: "Prescriptions invoiced at dispensing" });
    } else if (event.entity_name === "SurgicalBooking") {
      serviceType = "surgical_procedure";
      description = `Surgery: ${data.procedure_name || "Procedure"}`;
      amount = 2000; // Default surgical procedure cost (MWK)
    }

    // Create InvoiceItem
    const item = await base44.asServiceRole.entities.InvoiceItem.create({
      invoice_id: invoice.id,
      visit_id: data.visit_id,
      patient_id: data.patient_id,
      service_type: serviceType,
      description: description,
      quantity: 1,
      unit_price: amount,
      total_amount: amount,
      status: "pending",
      linked_entity_type: event.entity_name,
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
      item_id: item.id,
      amount: amount,
      total_invoice: newTotal,
    });

  } catch (error) {
    console.error("Error generating invoice item:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});