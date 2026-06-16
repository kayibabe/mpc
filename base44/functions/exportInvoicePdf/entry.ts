import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invoice_id } = await req.json();
    if (!invoice_id) return Response.json({ error: 'Missing invoice_id' }, { status: 400 });

    const invoice = await base44.entities.Invoice.get(invoice_id);
    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

    const [patient, items] = await Promise.all([
      base44.entities.Patient.get(invoice.patient_id),
      base44.entities.InvoiceItem.filter({ invoice_id }, '', 100),
    ]);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(21, 101, 112); // teal
    doc.text('Zomba City Private Clinic', 15, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('P.O. Box 14, Zomba, Malawi | Tel: +265 888 000 000 | info@zombacityclinic.mw', 15, y);
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, pageW - 15, y);
    y += 8;

    // Invoice title
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`INVOICE: ${invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}`, 15, y);
    y += 7;

    // Patient & Invoice details
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const pName = patient ? `${patient.first_name} ${patient.last_name}` : 'N/A';
    doc.text(`Patient: ${pName}`, 15, y);
    doc.text(`Date: ${new Date(invoice.created_date).toLocaleDateString('en-GB')}`, 120, y);
    y += 5;
    if (patient?.mrn) { doc.text(`MRN: ${patient.mrn}`, 15, y); y += 5; }
    doc.text(`Payment Type: ${invoice.payment_type}`, 15, y);
    doc.text(`Status: ${invoice.status}`, 120, y);
    y += 8;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, pageW - 30, 7, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text('Service', 17, y + 5);
    doc.text('Type', 80, y + 5);
    doc.text('Qty', 110, y + 5);
    doc.text('Unit Price (MWK)', 125, y + 5);
    doc.text('Total (MWK)', 165, y + 5);
    y += 8;

    // Table rows
    doc.setFontSize(8);
    items.forEach((item) => {
      doc.text(item.service_name || '', 17, y + 4);
      doc.text(item.service_type || '', 80, y + 4);
      doc.text(String(item.quantity || 1), 110, y + 4);
      doc.text((item.unit_price || 0).toLocaleString(), 125, y + 4);
      doc.text(((item.unit_price || 0) * (item.quantity || 1)).toLocaleString(), 165, y + 4);
      y += 5;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    // Total
    y += 3;
    doc.setDrawColor(0, 0, 0);
    doc.line(15, y, pageW - 15, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Due: MWK ${(invoice.net_amount || invoice.total_amount || 0).toLocaleString()}`, 15, y);
    doc.text(`Paid: MWK ${(invoice.paid_amount || 0).toLocaleString()}`, 100, y);
    y += 10;

    // Footer
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('Zomba City Private Clinic — HIMS Generated Receipt', 15, y);
    doc.text(`Generated: ${new Date().toISOString().slice(0, 10)} by ${user.full_name || user.email}`, 15, y + 4);

    const pdfBytes = doc.output('arraybuffer');
    const b64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    return Response.json({ pdf_base64: b64, filename: `invoice_${invoice.invoice_number || invoice.id.slice(0, 8)}.pdf` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});