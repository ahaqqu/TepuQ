import { json, setSessionCookie } from './_utils.js';

export async function onRequestPost(context) {
  return json({ ok: true }, 200, {
    'Set-Cookie': `tepuq_session=; Path=/; Max-Age=0; Secure; SameSite=Strict; HttpOnly`,
  });
}
