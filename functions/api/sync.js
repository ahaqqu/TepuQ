import { json, error, verifyToken, getCookieValue, kvKeyForUser } from './_utils.js';

const COOKIE_NAME = 'tepuq_session';
const MAX_KV_SIZE = 25 * 1024 * 1024; // 25 MB

async function getUser(context) {
  const { request, env } = context;
  const secret = env.TEPUQ_JWT_SECRET;
  if (!secret) return null;
  const token = getCookieValue(request, COOKIE_NAME);
  if (!token) return null;
  return verifyToken(token, secret);
}

export async function onRequestGet(context) {
  const user = await getUser(context);
  if (!user) return error('Unauthorized', 401);

  const { env } = context;
  const key = kvKeyForUser(user);
  const value = await env.TEPUQ_SYNC.get(key);
  if (!value) {
    return new Response(null, { status: 204 });
  }
  return json({ ok: true, payload: value });
}

export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return error('Unauthorized', 401);

  const { request, env } = context;
  let body = {};
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON');
  }

  const payload = body.payload;
  if (typeof payload !== 'string') {
    return error('Missing payload string');
  }

  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return error('Invalid JSON payload', 400);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.objects)) {
    return error('Malformed payload', 400);
  }
  if (parsed.version && parsed.version !== '3.0') {
    return error('Unsupported payload version', 400);
  }

  const encoder = new TextEncoder();
  const size = encoder.encode(payload).length;
  if (size > MAX_KV_SIZE) {
    return error(`Payload too large: ${size} bytes (max ${MAX_KV_SIZE})`, 413);
  }

  const key = kvKeyForUser(user);
  await env.TEPUQ_SYNC.put(key, payload);
  return json({ ok: true, size });
}
