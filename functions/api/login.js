import { json, error, signToken, setSessionCookie, constantTimeStringEquals, getClientIP } from './_utils.js';

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const attempts = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record) return false;
  if (now - record.firstAttempt > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip) {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    attempts.set(ip, { firstAttempt: now, count: 1 });
  } else {
    record.count += 1;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const clientIP = getClientIP(request);
  if (isRateLimited(clientIP)) {
    return error('Too many attempts', 429);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON');
  }

  const { user, pass } = body;
  if (!user || !pass) {
    return error('Missing user or pass');
  }

  const expectedUser = env.TEPUQ_USER;
  const expectedPass = env.TEPUQ_PASS;
  if (!expectedUser || !expectedPass) {
    return error('Sync not configured', 500);
  }

  const userOk = await constantTimeStringEquals(user, expectedUser);
  const passOk = await constantTimeStringEquals(pass, expectedPass);
  if (!userOk || !passOk) {
    recordAttempt(clientIP);
    return error('Invalid credentials', 401);
  }

  const secret = env.TEPUQ_JWT_SECRET;
  if (!secret) {
    return error('Sync secret not configured', 500);
  }

  const token = await signToken(user, secret);
  return json({ ok: true }, 200, {
    'Set-Cookie': setSessionCookie(token),
  });
}
