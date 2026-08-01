# ADR 0001 — Cloud Sync as a Single Family Account on Cloudflare KV

**Status:** Accepted

**Date:** 2026-08-01

## Context
TepuQ stores all data locally in the browser. Parents can already back up and move data via ZIP export/import. We need a cloud-sync feature so one family can keep the same custom objects, photos, and voice recordings across multiple devices without manual file transfers.

We considered several approaches:
1. **Improve ZIP backup UX only** — simpler, but still manual.
2. **Full per-user accounts with SSO** — future-proof, but too complex for a toddler game.
3. **Cloudflare Functions + KV with one shared family credential** — adds a small backend, but stays free and simple.
4. **KV metadata + R2 for blobs** — more robust storage, but more moving parts.
5. **Client-side passphrase encryption** — server stays simpler, but families must remember and re-enter a password on every pull/push.

## Decision
We will implement cloud sync as a **single shared family account** backed by **Cloudflare Pages Functions and KV**.

- The unit of identity is the **Family**, not the parent or the device.
- One username/password pair, stored in Cloudflare secrets, identifies the family.
- The backend issues a long-lived HttpOnly JWT cookie on login.
- All custom data is serialized to JSON, gzip-compressed, base64-encoded, and stored as a single KV value per family.
- Pull uses the same overwrite/merge strategy as ZIP import.
- Push and pull are explicit actions; there is no automatic sync.

## Rationale
- **Simplicity.** KV is included in the Cloudflare free tier and requires no extra service. One shared password avoids identity plumbing.
- **Cost.** No paid database or object store is needed at family scale.
- **Alignment with existing merge logic.** Reusing the ZIP import merge keeps the data model consistent and reduces new code.
- **SSO deferred.** The long-term goal is not SSO; a family-shared credential is sufficient.

## Consequences
- **Positive:**
  - Families can sync across devices with one login.
  - The implementation stays small and free.
  - Existing ZIP backup/export flow remains unchanged.

- **Negative:**
  - The 25 MB KV value limit caps total custom data size. We must add a size guard and warn users.
  - Eventual consistency in KV means a push may not be visible on another device immediately.
  - The shared password cannot be revoked per device. Anyone with the password can pull or overwrite the family data.
  - Pages Functions are required, so local sync testing needs `wrangler pages dev`, not Vite preview.

## Related
- `CONTEXT.md` — Family, Device, Sync Store definitions.
- `docs/cloud-sync-plan.md` — implementation details.
- `src/admin/import-export.js` — merge logic reused for pull.
