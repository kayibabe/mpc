import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

// Template coordinates mapping for each scheme
const TEMPLATES = {
  liberty: { name: 'Liberty Health Cover', fields: { patient_first_name: { x: 105, y: 32, width: 90 }, patient_last_name: { x: 155, y: 32, width: 40 }, patient_member_no: { x: 105, y: 40, width: 90 }, facility_name: { x: 15, y: 62, width: 90 }, doctor_name: { x: 155, y: 62, width: 40 }, diagnosis: { x: 15, y: 88, width: 180 }, items_start_y: 100, items_row_height: 5, total_cost: { x: 147, y: 250, width: 48 } } },
  masm: { name: 'MASM Medical Aid', fields: { member_name: { x: 15, y: 35, width: 90 }, patient_name: { x: 15, y: 49, width: 90 }, treatment_date: { x: 15, y: 56, width: 40 }, nature_of_illness: { x: 15, y: 75, width: 180 }, total_cost: { x: 155, y: 180, width: 40 } } },
  wemas: { name: 'WEMAS', fields: { claim_no: { x: 15, y: 32, width: 40 }, member_surname: { x: 15, y: 45, width: 90 }, member_first_name: { x: 105, y: 45, width: 90 }, patient_surname: { x: 15, y: 75, width: 90 }, patient_first_name: { x: 105, y: 75, width: 90 }, admission_date: { x: 15, y: 95, width: 40 }, discharge_date: { x: 105, y: 95, width: 40 }, diagnosis: { x: 15, y: 130, width: 180 }, items_start_y: 145, items_row_height: 5, total_cost: { x: 167, y: 240, width: 28 } } },
  nabmas: { name: 'NABMAS', fields: { claim_no: { x: 155, y: 20, width: 40 }, employee_name: { x: 15, y: 35, width: 90 }, patient_name: { x: 15, y: 42, width: 90 }, treatment_date: { x: 105, y: 42, width: 90 }, total_cost: { x: 155, y: 180, width: 40 } } },
  horizon: { name: 'Horizon Health', fields: { claim_no: { x: 15, y: 32, width: 40 }, member_surname: { x: 15, y: 45, width: 90 }, member_first_name: { x: 105, y: 45, width: 90 }, patient_surname: { x: 15, y: 75, width: 90 }, patient_first_name: { x: 105, y: 75, width: 90 }, diagnosis: { x: 15, y: 130, width: 180 }, items_start_y: 145, items_row_height: 5, total_cost: { x: 167, y: 240, width: 28 } } }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invoice_id, scheme_id } = await req.json();
    if (!invoice_id || !scheme_id) return Response.json({ error: 'Missing invoice_id or scheme_id' }, { status: 400 });

    const template = TEMPLATES[scheme_id.toLowerCase()];
    if (!template) return Response.json({ error: `Unknown scheme: ${scheme_id}` }, { status: 400 });

    const [invoice, patient, items, consultation] = await Promise.all([
      base44.entities.Invoice.get(invoice_id),
      invoice_id ? base44.entities.Patient.list('', 1).then(p => p[0]) : Promise.resolve(null),
      base44.entities.InvoiceItem.filter({ invoice_id }, '', 100),
      base44.entities.Consultation.filter({ invoice_id }, '-created_date', 1).then(c => c[0]).catch(() => null)
    ]);

    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    let y = template.fields.items_start_y || 100;

    // Helper to text on PDF
    const setText = (text, x, fSize = 10, fontStyle = 'normal') => {
      doc.setFontSize(fSize);
      doc.setFont(undefined, fontStyle);
      doc.text(String(text || ''), x, y, { maxWidth: 30 });
    };

    // Header
    doc.setFontSize(16);
    doc.setTextColor(21, 101, 112);
    doc.text(template.name, 15, 15);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Medical Claim Form', 15, 22);
    y = 30;

    // Patient Details Section
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    if (patient && template.fields.patient_first_name) {
      doc.text(`Patient: ${patient.first_name || ''} ${patient.last_name || ''}`, template.fields.patient_first_name.x, template.fields.patient_first_name.y);
    }
    if (patient && template.fields.patient_member_no) {
      doc.text(`Member #: ${patient.medical_aid_number || 'N/A'}`, template.fields.patient_member_no.x, template.fields.patient_member_no.y);
    }

    // Invoice/Facility Details
    if (template.fields.facility_name) {
      doc.text('Zomba City Private Clinic', template.fields.facility_name.x, template.fields.facility_name.y);
    }

    // Diagnosis
    if (template.fields.diagnosis && consultation) {
      const diagnosisText = consultation.diagnosis_description || invoice.diagnosis || 'N/A';
      doc.setFontSize(9);
      doc.text(diagnosisText.substring(0, 100), template.fields.diagnosis.x, template.fields.diagnosis.y, { maxWidth: 180 });
    }

    // Treatment Items Table
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const startY = template.fields.items_start_y || 100;
    let currentY = startY + 5;

    items.forEach((item, idx) => {
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }
      const rowY = currentY;
      doc.text(String(item.service_name || item.description || ''), 15, rowY);
      doc.text(String(item.quantity || 1), 100, rowY);
      doc.text((item.unit_price || 0).toLocaleString(), 120, rowY);
      doc.text(((item.unit_price || 0) * (item.quantity || 1)).toLocaleString(), 155, rowY);
      currentY += (template.fields.items_row_height || 5);
    });

    // Total
    const totalY = Math.max(currentY + 10, template.fields.total_cost?.y || 240);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    const totalAmount = (invoice.net_amount || invoice.total_amount || 0);
    doc.text(`Total: MWK ${totalAmount.toLocaleString()}`, template.fields.total_cost?.x || 155, totalY);

    // Footer
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${new Date().toISOString().slice(0, 10)} | Claim Scheme: ${template.name}`, 15, 290);

    const pdfBytes = doc.output('arraybuffer');
    const b64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    return Response.json({
      pdf_base64: b64,
      filename: `claim_${scheme_id}_${invoice.invoice_number || invoice.id.slice(0, 8)}.pdf`,
      scheme: template.name,
      total_amount: totalAmount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});