# ADR 0003 — TariQ Kata Data Stores and Sync Scope

**Status:** Accepted

**Date:** 2026-08-15

## Context
ADR 0002 folds the spelling game (TariQ Kata) into the TepuQ & TariQ repo. Kata needs persistent data: word definitions (with optional per-word custom audio), its own settings (letter/slot size, snap distance, session length, TTS rate/pitch/volume, distractor toggle, language), and per-device progress (completed words, current streak, total sessions). TepuQ's existing `tepuq_db` (v4) has card-only stores: `objects`, `settings`, `meta`. The existing cloud sync (ADR 0001) pushes/pulls Gambar custom objects + settings per Family; progress is not synced.

We had to decide three things: where Kata's data lives, what a word record looks like, and what syncs.

**Database layout — alternatives considered:**
1. Same `tepuq_db` with new `kata_*` stores. (Chosen.)
2. A second IndexedDB database `tepuq_kata_db`.
3. Reuse the existing `objects`/`settings` stores with a `kind` tag.

**Word record shape — alternatives considered:**
1. String IDs, `audioBlob` stored as a Blob (object URL created at play time), slots derived at runtime from the word string as ordered positions. (Chosen.)
2. Numeric auto-increment IDs, Blob URL stored, as in the original TariQ vibe prompt.
3. String IDs with an explicit per-word array of slot objects.

**Sync scope — alternatives considered:**
1. Sync Kata custom words + Kata settings; keep progress local. (Chosen.)
2. Kata local + ZIP only, no cloud sync.
3. Ship local + ZIP now, wire sync later.

## Decision

**Database:** Keep one database, `tepuq_db`, bumped to v5. Add three Kata-only stores:
- `kata_words` — word definitions + custom audio.
- `kata_settings` — Kata's settings, single record keyed `kata_settings`.
- `kata_progress` — per-device progress, single record keyed `kata_progress`.

The existing `objects`, `settings`, `meta` stores are untouched and remain Gambar-only. `src/db.js` keeps the single connection; `src/kata/kata-db.js` owns CRUD for the `kata_*` stores.

**Word record shape:**
```
{
  id: 'kata_001',          // stable string id (sync/import-safe)
  word: 'are',             // lowercase
  display: 'are',          // same as word for MVP
  category: 'default',     // string
  order: 0,                // display order
  enabled: true,           // soft-delete
  audioBlob: null,         // Blob | null (object URL created at play time)
  audioType: 'tts',        // 'tts' | 'recording'
  useRecording: false,
  source: 'starter'        // 'starter' | 'custom'
}
```
Slots are **derived at runtime** from the word string as ordered letter positions. For a word with duplicate letters (e.g. "mama"), a tile snaps into the next unfilled slot whose letter matches — so matching is by letter *and* position, not letter alone. This mirrors TepuQ Gambar's object record conventions (`audioBlob`/`audioType`/`useRecording`/`source`) and is sync-safe.

**Sync scope:** Kata custom words + Kata settings join the Family Sync Store. A Push serializes `kata_words` (custom only, starter words excluded) + `kata_settings`; a Pull overwrites local Kata custom data using the same merge strategy as ZIP import. `kata_progress` stays local per device, exactly as Gambar has no progress sync. Starter words are seeded locally on first run and are not synced individually.

## Rationale
- **Single database.** Matches TepuQ's existing convention; one connection to manage; sync and ZIP touch one database. A second database would diverge from the pattern and force the sync serializer to coordinate two connections.
- **Separate `kata_*` stores.** Keeps Kata data independent within the shared database — a Kata bug can't corrupt Gambar's `objects`, and sync/ZIP can include the `kata_*` group cleanly. Reusing `objects` with a `kind` tag would overload the Gambar "object" concept and complicate filtering/reset.
- **String IDs.** Auto-increment IDs collide on ZIP import and across two devices both creating the same integer. String IDs are stable and sync-safe.
- **Blob storage.** Blob URLs do not survive a page reload; storing the Blob and minting an object URL at play time (as Gambar does) is durable.
- **Runtime-derived slots.** Storing an explicit slot array denormalizes data that can be computed and complicates admin. Deriving slots handles duplicate letters by position.
- **Sync words + settings, not progress.** Symmetric with Gambar (custom content + settings sync; per-device state does not). Keeps the Family model coherent: a family shares its word library, not its child's streak.

## Consequences
- **Positive:**
  - Kata data is isolated in its own stores but lives in the one shared database.
  - Sync and ZIP extend naturally: the serializer adds the `kata_*` group; the merge logic gets a Kata equivalent.
  - Word records are import/sync-safe and consistent with Gambar's record style.

- **Negative:**
  - `src/db.js`'s upgrade handler grows the v5 migration (create three stores); a future Kata schema change is another bump.
  - `sync-serializer.js` and the sync Functions must carry the `kata_*` group; the KV 25 MB limit now covers both games' custom data.
  - `merge-objects.js` needs a Kata-word merge (by id) alongside the Gambar object merge.
  - Starter words, like starter objects, are assumed identical on every device and refreshed from the bundle on version bump.

## Related
- `CONTEXT.md` — TepuQ & TariQ, TariQ Kata, Local Data, Custom Object, Starter Object, Sync Store, Push, Pull.
- ADR 0001 — Cloud Sync as a Single Family Account.
- ADR 0002 — TepuQ & TariQ as a Multi-Game Shell.