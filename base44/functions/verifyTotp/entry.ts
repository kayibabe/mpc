import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Base32 decoding function (RFC 4648)
function base32Decode(encoded) {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  encoded = encoded.toUpperCase();
  
  let bits = '';
  for (let i = 0; i < encoded.length; i++) {
    const idx = base32chars.indexOf(encoded[i]);
    if (idx === -1) throw new Error('Invalid base32 character: ' + encoded[i]);
    bits += idx.toString(2).padStart(5, '0');
  }
  
  const bytes = [];
  for (let i = 0; i < bits.length - 4; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  
  return new Uint8Array(bytes);
}

// HMAC-SHA1 function for TOTP verification
async function hmacSha1(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, message));
}

// TOTP verification - RFC 6238 compliant
async function verifyTOTP(secret, token, window = 3) {
  const key = base32Decode(secret);
  const tokenNum = parseInt(token, 10);
  
  if (isNaN(tokenNum) || tokenNum < 0 || tokenNum > 999999) {
    throw new Error('Invalid token: must be 6 digits');
  }
  
  // Current time in 30-second intervals
  const now = Math.floor(Date.now() / 1000 / 30);
  
  // Try current and surrounding time windows
  for (let offset = -window; offset <= window; offset++) {
    const counter = now + offset;
    const msg = new BigUint64Array(1);
    msg[0] = BigInt(counter);
    const msgBytes = new Uint8Array(msg.buffer);
    
    const hash = await hmacSha1(key, msgBytes);
    const lastByte = hash[hash.length - 1];
    const pos = lastByte & 0x0f;
    
    const dyn = ((hash[pos] & 0x7f) << 24) |
                ((hash[pos + 1] & 0xff) << 16) |
                ((hash[pos + 2] & 0xff) << 8) |
                (hash[pos + 3] & 0xff);
    
    const code = dyn % 1000000;
    
    if (code === tokenNum) {
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

    // Verify the token using custom TOTP implementation (supports ±3 time windows for clock skew)
    let verified = false;
    try {
      verified = await verifyTOTP(totp_secret, token, 3);
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