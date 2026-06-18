import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { totp } from 'npm:otplib@12.0.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { token, secret } = await req.json();
    if (!token || typeof token !== 'string' || token.length !== 6) {
      return Response.json({ error: 'Invalid token format' }, { status: 400 });
    }

    let totp_secret = secret;

    // If no secret provided, fetch from UserSecurity (for login/disable flow)
    if (!totp_secret) {
      const userSecurityRecords = await base44.entities.UserSecurity.filter(
        { user_id: user.id },
        '-created_date',
        1
      );

      if (userSecurityRecords.length === 0 || !userSecurityRecords[0].totp_secret) {
        return Response.json({ error: 'TOTP not enabled for this user' }, { status: 400 });
      }

      totp_secret = userSecurityRecords[0].totp_secret;
    }

    // Verify the token using otplib
    let verified = false;
    try {
      // otplib's check allows for time window tolerance (default ±1 window = 60 seconds)
      verified = totp.check(token, totp_secret);
    } catch (verifyErr) {
      return Response.json({ error: 'Verification failed: ' + verifyErr.message }, { status: 400 });
    }

    if (!verified) {
      return Response.json({ verified: false });
    }

    // Update last verification timestamp if secret came from DB
    if (!secret) {
      const userSecurityRecords = await base44.entities.UserSecurity.filter(
        { user_id: user.id },
        '-created_date',
        1
      );
      if (userSecurityRecords.length > 0) {
        await base44.entities.UserSecurity.update(userSecurityRecords[0].id, {
          last_totp_verify: new Date().toISOString(),
        });
      }
    }

    return Response.json({ verified: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});