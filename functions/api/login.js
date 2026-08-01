import { json, error, signToken, setSessionCookie, getCookieValue } from './_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
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

  if (user !== expectedUser || pass !== expectedPass) {
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
