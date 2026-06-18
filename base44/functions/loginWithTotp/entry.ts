import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as speakeasy from 'npm:speakeasy@2.0.0';

Deno.serve(async (req) => {
  try {
    const { token, backup_code } = await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch user's TOTP secret from UserSecurity
    const userSecurityRecords = await base44.entities.UserSecurity.filter(
      { user_id: user.id },
      '-created_date',
      1
    );

    if (userSecurityRecords.length === 0 || !userSecurityRecords[0].is_totp_enabled) {
      return Response.json({ verified: true }); // TOTP not enabled, user already logged in via base44.auth
    }

    const userSecurity = userSecurityRecords[0];
    let verified = false;

    // Verify TOTP token if provided
    if (token && token.length === 6) {
      verified = speakeasy.totp.verify({
        secret: userSecurity.totp_secret,
        encoding: 'base32',
        token: token,
        window: 2,
      });
    }

    // Verify backup code if TOTP failed and backup code provided
    if (!verified && backup_code) {
      let backupCodes = [];
      try {
        backupCodes = JSON.parse(userSecurity.backup_codes || '[]');
      } catch (e) {
        backupCodes = [];
      }

      const codeIndex = backupCodes.indexOf(backup_code);
      if (codeIndex >= 0) {
        verified = true;
        // Remove used backup code
        backupCodes.splice(codeIndex, 1);
        await base44.entities.UserSecurity.update(userSecurity.id, {
          backup_codes: JSON.stringify(backupCodes),
        });
      }
    }

    if (verified) {
      // Update last verification and create login session
      await base44.entities.UserSecurity.update(userSecurity.id, {
        last_totp_verify: new Date().toISOString(),
      });

      // Record login session with 2FA flag
      await base44.entities.LoginSession.create({
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name || user.email,
        user_role: user.role,
        login_date: new Date().toISOString(),
        is_active: true,
        totp_verified: true,
        device_info: req.headers.get('user-agent') || 'unknown',
      });
    }

    return Response.json({ verified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});