import { describe, it, expect, vi } from 'vitest';
import { onRequestPost } from '../../functions/api/sync.js';
import { signToken } from '../../functions/api/_utils.js';

const SECRET = 'test-secret-for-unit-tests';

function request(body, cookie) {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  return {
    headers,
    json: async () => body,
  };
}

function context(body, kv, cookie) {
  return {
    request: request(body, cookie),
    env: { TEPUQ_JWT_SECRET: SECRET, TEPUQ_SYNC: kv },
  };
}

async function authedContext(body, kv) {
  const token = await signToken('family', SECRET);
  return context(body, kv, `tepuq_session=${encodeURIComponent(token)}`);
}

describe('cloud sync POST API', () => {
  it('accepts the compressed gz payload format the client sends', async () => {
    const kv = { put: vi.fn(), get: vi.fn() };
    const ctx = await authedContext({ payload: 'gz:H4sIAAAAAAA' }, kv);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    expect(kv.put).toHaveBeenCalledWith('family:family', 'gz:H4sIAAAAAAA');
  });

  it('accepts the raw fallback payload format', async () => {
    const kv = { put: vi.fn(), get: vi.fn() };
    const ctx = await authedContext({ payload: 'raw:eyJvYmplY3RzIjpbXX0=' }, kv);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    expect(kv.put).toHaveBeenCalledWith('family:family', 'raw:eyJvYmplY3RzIjpbXX0=');
  });

  it('accepts legacy plain JSON payloads', async () => {
    const kv = { put: vi.fn(), get: vi.fn() };
    const payload = JSON.stringify({ version: '3.0', objects: [] });
    const ctx = await authedContext({ payload }, kv);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    expect(kv.put).toHaveBeenCalledWith('family:family', payload);
  });

  it('rejects payloads that are neither compressed nor valid JSON', async () => {
    const kv = { put: vi.fn(), get: vi.fn() };
    const ctx = await authedContext({ payload: 'not-json-or-compressed' }, kv);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('rejects missing payload strings', async () => {
    const kv = { put: vi.fn(), get: vi.fn() };
    const ctx = await authedContext({}, kv);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    const kv = { put: vi.fn(), get: vi.fn() };
    const ctx = context({ payload: 'gz:H4sIAAAAAAA' }, kv);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(401);
    expect(kv.put).not.toHaveBeenCalled();
  });
});
