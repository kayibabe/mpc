import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.staff_id) return Response.json({ error: "Missing staff data" }, { status: 400 });

    const user = await base44.asServiceRole.entities.User.get(data.staff_id);
    if (!user) return Response.json({ error: "Staff not found" }, { status: 404 });

    // Define required credentials by role
    const credentialsByRole = {
      "doctor": ["medical_license", "registration", "liability_insurance"],
      "nurse": ["nursing_license", "registration", "cpr_certification"],
      "pharmacist": ["pharmacy_license", "registration"],
      "lab_technician": ["laboratory_certification", "competency_test"],
      "radiographer": ["radiography_license", "registration"],
      "midwife": ["midwifery_license", "registration"],
    };

    const requiredCredentials = credentialsByRole[user.role] || [];
    
    // Check credential status (simulated - would fetch from credentials DB)
    const credentials = {
      "medical_license": { status: "valid", expiry: "2027-12-31" },
      "nursing_license": { status: "valid", expiry: "2026-06-30" },
      "pharmacy_license": { status: "expired", expiry: "2025-12-31" },
      "laboratory_certification": { status: "valid", expiry: "2028-12-31" },
      "radiography_license": { status: "valid", expiry: "2027-06-30" },
      "registration": { status: "valid", expiry: "2026-12-31" },
      "cpr_certification": { status: "expires_soon", expiry: "2026-08-31" },
      "liability_insurance": { status: "valid", expiry: "2026-12-31" },
    };

    const expired = [];
    const expiresSoon = [];

    for (const cred of requiredCredentials) {
      const credInfo = credentials[cred];
      if (credInfo?.status === "expired") {
        expired.push(cred);
      } else if (credInfo?.status === "expires_soon") {
        expiresSoon.push(cred);
      }
    }

    // Alert if credentials are expired or expiring
    if (expired.length > 0) {
      await base44.asServiceRole.entities.Notification.create({
        title: `❌ CRITICAL: ${user.full_name} Credentials Expired`,
        message: `${expired.join(", ")} expired. Suspend from clinical duties until renewed.`,
        is_read: false,
        target_role: "admin",
        priority: "critical",
      });
    }

    if (expiresSoon.length > 0) {
      await base44.asServiceRole.entities.Notification.create({
        title: `⚠️ ${user.full_name} Credentials Expiring Soon`,
        message: `${expiresSoon.join(", ")} expire within 60 days. Remind to renew.`,
        is_read: false,
        target_role: "admin",
        priority: "high",
      });
    }

    return Response.json({
      status: "success",
      staff_id: data.staff_id,
      staff_name: user.full_name,
      role: user.role,
      required_credentials: requiredCredentials,
      expired: expired,
      expiring_soon: expiresSoon,
      can_practice: expired.length === 0,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});