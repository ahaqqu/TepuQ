import { json, error, verifyToken, getCookieValue } from './_utils.js';

const COOKIE_NAME = 'tepuq_session';

export async function onRequestGet(context) {
  const { request, env } = context;
  const secret = env.TEPUQ_JWT_SECRET;
  if (!secret) return error('Sync secret not configured', 500);
  const token = getCookieValue(request, COOKIE_NAME);
  if (!token) return error('Unauthorized', 401);
  const user = await verifyToken(token, secret);
  if (!user) return error('Unauthorized', 401);
  return json({ ok: true, user });
}
