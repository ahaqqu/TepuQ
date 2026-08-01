// Shared Cloudflare Pages Function helpers for TepuQ cloud sync.
// These run inside the Pages Functions worker and use crypto.subtle only.

const COOKIE_NAME = 'tepuq_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

export function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

export function setSessionCookie(username) {
  const payload = JSON.stringify({ user: username, iat: Date.now() });
  const value = btoa(payload); // simple obfuscated cookie, signed in full flow
  const secure = 'Secure; SameSite=Strict; HttpOnly';
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; ${secure}`;
}

export async function signToken(username, secret) {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: username, iat: Math.floor(Date.now() / 1000) };
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '');
  return `${data}.${sigB64}`;
}

export async function verifyToken(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigBytes = Uint8Array.from(atob(sigB64.padEnd(sigB64.length + (4 - (sigB64.length % 4)) % 4, '=')).split('').map(c => c.charCodeAt(0)));
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
  if (!ok) return null;
  try {
    const payload = JSON.parse(atob(payloadB64.padEnd(payloadB64.length + (4 - (payloadB64.length % 4)) % 4, '=')));
    return payload.sub || null;
  } catch {
    return null;
  }
}

export function getCookieValue(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function kvKeyForUser(username) {
  return `family:${username}`;
}
