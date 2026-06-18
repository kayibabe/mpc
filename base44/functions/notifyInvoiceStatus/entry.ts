import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { invoice_id, status } = await req.json();

    if (!invoice_id || !status) {
      return Response.json({ error: 'Missing invoice_id or status' }, { status: 400 });
    }

    // Fetch invoice details
    const invoice = await base44.asServiceRole.entities.Invoice.get(invoice_id);
    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Fetch patient details
    const patient = await base44.asServiceRole.entities.Patient.get(invoice.patient_id);
    if (!patient || !patient.email) {
      return Response.json({ error: 'Patient email not found' }, { status: 400 });
    }

    // Build email subject and body
    let subject = '';
    let body = '';

    if (status === 'paid' || status === 'partial') {
      subject = `Bill Finalized - Invoice ${invoice.invoice_number}`;
      body = `
Dear ${patient.first_name} ${patient.last_name},

Your medical bill has been finalized.

===== BILL SUMMARY =====
Invoice #: ${invoice.invoice_number}
Total Amount: MWK ${invoice.total_amount?.toFixed(2) || 0}
Discount: MWK ${invoice.discount_amount?.toFixed(2) || 0}
Net Amount: MWK ${invoice.net_amount?.toFixed(2) || 0}
Paid Amount: MWK ${invoice.paid_amount?.toFixed(2) || 0}
Outstanding: MWK ${(invoice.net_amount - invoice.paid_amount)?.toFixed(2) || 0}
Payment Type: ${invoice.payment_type}
${invoice.scheme_name ? `Insurance Scheme: ${invoice.scheme_name}` : ''}

===== PAYMENT DETAILS =====
Status: ${status.toUpperCase()}
Date: ${new Date().toLocaleDateString('en-GB')}

===== PAY ONLINE =====
To pay your bill or view your account, visit:
https://zombacity-clinic.com/portal

Questions? Contact our billing department.

Best regards,
Zomba City Private Clinic
`;
    } else if (status === 'overdue') {
      subject = `Payment Due - Invoice ${invoice.invoice_number}`;
      body = `
Dear ${patient.first_name} ${patient.last_name},

This is a reminder that your medical bill is now overdue.

===== OVERDUE BILL SUMMARY =====
Invoice #: ${invoice.invoice_number}
Total Amount: MWK ${invoice.total_amount?.toFixed(2) || 0}
Outstanding Balance: MWK ${(invoice.net_amount - invoice.paid_amount)?.toFixed(2) || 0}
Payment Type: ${invoice.payment_type}
${invoice.scheme_name ? `Insurance Scheme: ${invoice.scheme_name}` : ''}

===== URGENT ACTION REQUIRED =====
Please settle your outstanding balance as soon as possible to avoid service restrictions.

===== PAY NOW =====
Secure payment link:
https://zombacity-clinic.com/portal

If you have already paid, please disregard this message. Contact us if you have questions.

Best regards,
Zomba City Private Clinic
`;
    } else {
      return Response.json({ error: 'Unsupported status' }, { status: 400 });
    }

    // Send email via Core integration
    await base44.integrations.Core.SendEmail({
      to: patient.email,
      subject,
      body,
      from_name: 'Zomba City Private Clinic',
    });

    return Response.json({
      success: true,
      message: `Email sent to ${patient.email} for invoice ${invoice.invoice_number}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});