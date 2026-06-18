import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Base32 decoder
function base32Decode(encoded) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let output = new Uint8Array(Math.floor((encoded.length * 5) / 8));
  let outIdx = 0;
  let bits = 0;
  let value = 0;

  for (let i = 0; i < encoded.length; i++) {
    const idx = alphabet.indexOf(encoded[i].toUpperCase());
    if (idx === -1) throw new Error('Invalid character in base32: ' + encoded[i]);
    
    value = (value << 5) | idx;
    bits += 5;
    
    if (bits >= 8) {
      bits -= 8;
      output[outIdx++] = (value >> bits) & 255;
    }
  }
  
  return output.slice(0, outIdx);
}

// HMAC-SHA1
async function hmacSha1(key, message) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, message));
}

// TOTP verification - RFC 6238
async function verifyTOTP(secret, token, window = 1) {
  const key = base32Decode(secret);
  const tokenNum = parseInt(token, 10);
  
  if (isNaN(tokenNum) || tokenNum < 0 || tokenNum > 999999) {
    return false;
  }
  
  const now = Math.floor(Date.now() / 1000 / 30);
  
  for (let offset = -window; offset <= window; offset++) {
    let counter = now + offset;
    const counterBytes = new Uint8Array(8);
    
    for (let i = 7; i >= 0; i--) {
      counterBytes[i] = counter & 0xff;
      counter = counter >>> 8;
    }
    
    const hmac = await hmacSha1(key, counterBytes);
    const offset_val = hmac[19] & 0x0f;
    
    const code = (
      ((hmac[offset_val] & 0x7f) << 24) |
      ((hmac[offset_val + 1] & 0xff) << 16) |
      ((hmac[offset_val + 2] & 0xff) << 8) |
      (hmac[offset_val + 3] & 0xff)
    ) >>> 0;
    
    if ((code % 1000000) === tokenNum) {
      return true;
    }
  }
  
  return false;
}

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

    // If no secret provided, fetch from UserSecurity
    if (!totp_secret) {
      const userSecurityRecords = await base44.entities.UserSecurity.filter(
        { user_id: user.id },
        '-created_date',
        1
      );

      if (userSecurityRecords.length === 0 || !userSecurityRecords[0].totp_secret) {
        return Response.json({ error: 'TOTP not enabled' }, { status: 400 });
      }

      totp_secret = userSecurityRecords[0].totp_secret;
    }

    // Verify with RFC 6238 implementation
    const verified = await verifyTOTP(totp_secret, token, 1);

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