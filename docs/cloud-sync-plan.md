# TepuQ Cloud Sync — Implementation Plan

## Goal
Add optional, cookie-based cloud sync for a single hardcoded user so your TepuQ **settings, custom objects, photos, and voice recordings** can travel across any device/browser. The default offline/local experience must remain untouched.

## Decisions
- **Login is optional.** Everything works without it.
- **One hardcoded user** whose credentials live only in Cloudflare secrets, never in source code.
- **Cookie-based auth** so after one login you stay logged in forever unless the cookie is deleted.
- **Pull merges** with local data (same merge strategy as ZIP import).
- **Explicit push/pull only** — no auto-sync.
- **Cloudflare KV** is used for storage; the deploy script must create the KV namespace if missing.
- **ZIP export/import stays unchanged.**

## Architecture

```text
┌─────────────────┐         ┌──────────────────────────────┐
│  TepuQ Admin UI │         │  Cloudflare Pages Functions   │
│  src/admin/sync.js│◄────►│  /api/login  /api/sync        │
└─────────────────┘         └──────────────┬───────────────┘
                                             │
                                             ▼
                                     ┌───────────────┐
                                     │  Cloudflare KV │
                                     │  user:<name>   │
                                     └───────────────┘
```

### Backend
- `POST /api/login` — validates `TEPUQ_USER`/`TEPUQ_PASS`, sets a secure `HttpOnly` JWT cookie, returns `{ok:true}`.
- `GET /api/sync` — validates cookie, reads KV key `user:<username>`, returns JSON payload or `204`.
- `POST /api/sync` — validates cookie, writes the payload to KV key `user:<username>`.

### Frontend
- `src/admin/sync.js` — UI + cookie-aware fetch helpers + base64 serialization/deserialization.
- `src/admin/index.js` — wires the sync UI into admin.
- `index.html` — adds a **Sinkron** section (toolbar or tab).

### Data Format Stored in KV
Same as current `config.json` from ZIP export, but image/audio blobs are base64 strings so they stay JSON-safe.

```json
{
  "version": "3.0",
  "settings": { ... },
  "objects": [
    {
      "id": "...",
      "name": "...",
      "image": "images/obj_xxx.png",
      "imageData": "base64...",
      "audio": "audio/obj_xxx.webm",
      "audioData": "base64...",
      ...
    }
  ]
}
```

## Required Cloudflare Secrets
Set these via Wrangler CLI or Cloudflare dashboard:

| Secret / Env | Purpose |
|---|---|
| `TEPUQ_USER` | Hardcoded sync username |
| `TEPUQ_PASS` | Hardcoded sync password |
| `TEPUQ_JWT_SECRET` | JWT signing secret (generate a long random string) |
| `CLOUDFLARE_KV_NAMESPACE_ID` | ID of the `TEPUQ_SYNC` KV namespace |

## Implementation Order
1. **Backend skeleton** — create `functions/api/login.js`, `functions/api/sync.js`, and a shared auth helper using `crypto.subtle`.
2. **Frontend sync UI** — add sync HTML to admin and create `src/admin/sync.js`.
3. **Serialization & merge** — extract reusable merge logic from `import-export.js`; add base64 blob helpers.
4. **Cookie UX** — set a long-lived cookie on login; detect cookie on admin load to show logged-in state.
5. **Wrangler / KV config** — add KV binding; update `wrangler.jsonc` or switch to `wrangler.toml`.
6. **GitHub Actions** — add a step that creates the KV namespace if missing and injects its ID.
7. **Tests** — add unit tests for serializer/merge; optionally add E2E tests with mocked backend.
8. **Docs** — update `AGENTS.md` with sync setup and smoke tests.

## Acceptance Criteria
- [ ] Admin shows optional login/sync UI.
- [ ] Login sets a long-lived cookie and remembers the user.
- [ ] Push sends all settings + custom objects + blobs to KV.
- [ ] Pull fetches KV payload and merges it into local IndexedDB.
- [ ] No login required for normal local play/admin.
- [ ] ZIP export/import still works unchanged.
- [ ] `bun run test:unit` passes.
- [ ] `bun run build` passes.
- [ ] `bun run test:e2e` passes.
- [ ] `AGENTS.md` updated.

## Notes / Risks
- KV value size limit is **25 MB**. Add a size guard before push and warn if exceeded.
- Use `crypto.subtle` directly in the worker to avoid heavy JWT libraries.
- Local dev requires `wrangler pages dev` to test functions + KV together.
