import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { scheme_id, action, changes } = await req.json();
    if (!scheme_id || !action) {
      return Response.json({ error: 'Missing scheme_id or action' }, { status: 400 });
    }

    const auditRecord = {
      entity_type: 'MedicalAidScheme',
      entity_id: scheme_id,
      action,
      user_id: user.id,
      user_email: user.email,
      timestamp: new Date().toISOString(),
      changes: changes ? JSON.stringify(changes) : null,
      details: `${action} by ${user.email}`,
    };

    await base44.asServiceRole.entities.AuditLog.create(auditRecord);

    return Response.json({
      status: 'logged',
      audit_id: scheme_id,
      action,
      timestamp: auditRecord.timestamp,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});