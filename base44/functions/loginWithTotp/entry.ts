import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Base32 decoder
function base32Decode(encoded) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = [];
  let bits = 0;
  let value = 0;

  for (const char of encoded.toUpperCase()) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

// TOTP RFC 6238 - verify a token with ±1 time window
async function verifyTOTP(secret, token) {
  const key = base32Decode(secret);
  const code = parseInt(token, 10);

  if (isNaN(code) || code < 0 || code > 999999 || token.length !== 6) {
    return false;
  }

  const now = Math.floor(Date.now() / 30000);

  for (let t = now - 1; t <= now + 1; t++) {
    const counter = new ArrayBuffer(8);
    const view = new DataView(counter);
    view.setBigInt64(0, BigInt(t), false);

    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counter));

    const offset = hmac[19] & 0x0f;
    const truncated = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    ) >>> 0;

    if ((truncated % 1000000) === code) {
      return true;
    }
  }
  return false;
}

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
    if (token && token.length === 6 && userSecurity.totp_secret) {
      try {
        verified = await verifyTOTP(userSecurity.totp_secret, token);
      } catch (e) {
        // Invalid secret format, treat as failed verification
        verified = false;
      }
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