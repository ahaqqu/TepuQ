# TepuQ Cloud Sync — Implementation Plan

## Goal
Add optional cloud sync so one **Family** can keep its TepuQ **settings, custom objects, photos, and voice recordings** in sync across any number of **Devices**. The default offline/local experience must remain untouched.

## Domain
See `CONTEXT.md` for the project glossary. The short version:
- A **Family** is the unit of sync identity.
- A **Device** is one browser instance.
- **Push** uploads local custom data to the cloud.
- **Pull** downloads the cloud copy and overwrites local custom data using the same merge strategy as ZIP import.

## Decisions
- **Login is optional.** Everything works without it.
- **One shared Family credential.** `TEPUQ_USER` / `TEPUQ_PASS` live in Cloudflare secrets, never in source code.
- **Cookie-based auth.** After login the Device stays logged in until logout or cookie deletion.
- **Pull overwrites/merges** with local data using the same logic as ZIP import.
- **Explicit push/pull only.** No automatic background sync.
- **Cloudflare KV** stores one compressed payload per Family.
- **ZIP export/import stays unchanged.** Cloud sync is an additional backup path, not a replacement.

## Why KV
- It is free for the expected family-scale payload.
- It requires no extra services (no R2, no D1, no database).
- The whole dataset fits a single value when compressed.
- The trade-off is a **25 MB per-value limit**; we guard against that and warn before push.

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
                                     │  family:<user> │
                                     └───────────────┘
```

### Backend
- `POST /api/login` — validates `TEPUQ_USER`/`TEPUQ_PASS`, sets a secure `HttpOnly` JWT cookie, returns `{ok:true}`.
- `GET /api/sync` — validates cookie, reads KV key `family:<username>`, returns the compressed payload or `204`.
- `POST /api/sync` — validates cookie, compresses and writes the payload to KV key `family:<username>`.

### Frontend
- `src/admin/sync.js` — UI + cookie-aware fetch helpers + serialization/deserialization.
- `src/admin/index.js` — wires the sync UI into admin.
- `index.html` — adds a **Sinkron** section in admin.

### Data Format Stored in KV
Same JSON shape as `config.json` from ZIP export, with images/audio as base64 strings. The JSON text is gzip-compressed and then base64-encoded so KV stores a compact, JSON-safe string.

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

## Required GitHub Action Secrets
Set these in the repository (`Settings > Secrets and variables > Actions`):

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Deploy token with `Cloudflare Pages:Edit` permission |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_PROJECT_NAME` | Optional, defaults to `tepuq` |
| `TEPUQ_USER` | Shared family sync username |
| `TEPUQ_PASS` | Shared family sync password |
| `TEPUQ_JWT_SECRET` | JWT signing secret (generate a long random string) |

## KV Binding
`wrangler.jsonc` contains a placeholder KV namespace ID. The GitHub Action creates the `TEPUQ_SYNC` namespace automatically (if it does not exist) and overwrites `wrangler.jsonc` with the real ID before deploying. No manual Wrangler or dashboard setup is required.

## Implementation Order
1. **Backend skeleton** — create `functions/api/login.js`, `functions/api/sync.js`, and a shared auth helper using `crypto.subtle`.
2. **Frontend sync UI** — add sync HTML to admin and create `src/admin/sync.js`.
3. **Serialization & merge** — reuse `importZip` merge logic; add base64 blob helpers and gzip compression.
4. **Cookie UX** — set cookie on login; detect cookie on admin load to show logged-in state; add logout.
5. **Wrangler / KV config** — add KV binding to `wrangler.jsonc`.
6. **Tests** — add unit tests for serializer/compression; mock backend for any new E2E sync tests.
7. **Docs** — update `AGENTS.md` with sync setup and smoke tests.

## Acceptance Criteria
- [ ] Admin shows optional login/sync UI.
- [ ] Login sets a long-lived cookie and remembers the Family.
- [ ] Logout clears the cookie.
- [ ] Push sends all settings + custom objects + blobs to KV.
- [ ] Pull fetches KV payload and merges it into local IndexedDB using the ZIP import strategy.
- [ ] No login required for normal local play/admin.
- [ ] ZIP export/import still works unchanged.
- [ ] `bun run test:unit` passes.
- [ ] `bun run build` passes.
- [ ] `bun run test:e2e` passes.
- [ ] `AGENTS.md` updated.

## Notes / Risks
- KV value size limit is **25 MB compressed**. Add a size guard before push and warn if exceeded.
- Use `crypto.subtle` directly in the worker to avoid heavy JWT libraries.
- Local sync dev requires `wrangler pages dev` because Vite preview does not serve Pages Functions.
- The shared Family password must be distributed manually; there is no per-Device identity.
