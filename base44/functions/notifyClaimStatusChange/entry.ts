import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Entity automations send: event, data, old_data
    const body = await req.json();
    const { data: claim } = body;

    if (!claim) {
      return Response.json({ error: 'No claim data provided' }, { status: 400 });
    }

    const newStatus = claim.status;
    if (!['approved', 'rejected'].includes(newStatus)) {
      return Response.json({ skipped: true, reason: `Status '${newStatus}' does not trigger notification` }, { status: 200 });
    }

    // Get admin users as billing team recipients
    const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '', 50);
    if (adminUsers.length === 0) {
      return Response.json({ skipped: true, reason: 'No admin/billing users found to notify' }, { status: 200 });
    }

    // Fetch patient name for context
    let patientName = 'Unknown';
    try {
      const patient = await base44.asServiceRole.entities.Patient.get(claim.patient_id);
      patientName = `${patient.first_name} ${patient.last_name}`;
    } catch (_) { /* patient may not exist */ }

    const schemeName = claim.scheme_name || 'Unknown Scheme';
    const claimAmount = (claim.claim_amount || 0).toLocaleString();
    const statusLabel = newStatus === 'approved' ? '✅ APPROVED' : '❌ REJECTED';
    const responseNotes = claim.response_notes || 'No additional notes provided.';

    const subject = `[HIMS] Insurance Claim ${statusLabel} — ${patientName} (${schemeName})`;

    const bodyText = [
      `Insurance claim status update from Zomba City Private Clinic HIMS.`,
      ``,
      `Status: ${statusLabel}`,
      `Patient: ${patientName}`,
      `Scheme: ${schemeName}`,
      `Claim Amount: MWK ${claimAmount}`,
      `Response Notes: ${responseNotes}`,
      ``,
      `Claim ID: ${claim.id}`,
      `Invoice ID: ${claim.invoice_id || 'N/A'}`,
      ``,
      `This is an automated notification. Please review and take necessary action.`,
    ].join('\n');

    // Send to all admin users
    const results = [];
    for (const admin of adminUsers) {
      if (!admin.email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject,
          body: bodyText,
          from_name: 'Zomba City HIMS — Claims',
        });
        results.push({ email: admin.email, sent: true });
      } catch (e) {
        results.push({ email: admin.email, sent: false, error: e.message });
      }
    }

    // Also create an in-app notification
    await base44.asServiceRole.entities.Notification.create({
      title: `Claim ${newStatus === 'approved' ? 'Approved' : 'Rejected'}: ${patientName}`,
      message: `${schemeName} claim for ${patientName} (MWK ${claimAmount}) has been ${newStatus}. ${newStatus === 'rejected' ? 'Reason: ' + responseNotes : 'Payment processing pending.'}`,
      type: 'alert',
      target_role: 'admin',
      action_url: '/billing',
    });

    return Response.json({
      success: true,
      claim_id: claim.id,
      status: newStatus,
      patient: patientName,
      emails_sent: results.length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});