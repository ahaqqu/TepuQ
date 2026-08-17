# ADR 0005 — Shared Word/Photo Library and Per-Game Folder Separation

**Status:** Accepted

**Date:** 2026-08-20

## Context

TepuQ Gambar and TariQ Kata each kept their own starter data: Gambar seeded
`STARTER_OBJECTS` into the `objects` store, while Kata seeded
`KATA_STARTER_WORDS` into a separate `kata_words` store (ADR 0003). The two
lists had to be kept in sync by hand so the toddler saw the same words and
photos in both games. Parents also had two parallel admin UIs — a Gambar object
editor and a Kata word editor — even though "Mama" in Gambar and "mama" in Kata
are the same thing.

The code folders were also uneven: `src/game/` + `src/admin/` were Gambar-only,
`src/kata/` + `src/kata-admin/` were Kata-only, and only the root-level
services (config, db, utils, speech, game-picker) were shared.

## Decision

**One shared word/photo library.** The `kata_words` store is retired
(DB_VERSION 7 drops it). TepuQ Kata reads its words from the same `objects`
store as TepuQ Gambar through a single adapter seam,
`loadKataWordsFromObjects()` in `src/db.js:340`. Each object carries two per-game
toggles: `active` (Gambar) and `kataEnabled` (Kata, new). Objects whose name
contains a space ("Sikat Gigi") are not spellable and are always excluded from
Kata.

Consequences:

- The admin merges into **one shared object editor** with a "Aktif di TariQ
  Kata" checkbox. The separate Kata word list/editor/ZIP is removed.
- Kata gameplay shows the object's photo (starter HTTP URL or custom blob)
  next to the slots, so the toddler learns the word and its meaning at once.
- Sync and ZIP export carry `kataEnabled` on each object; the separate `kata`
  sync block is removed. Legacy payloads default to enabled for single-word
  objects.
- `kata_settings` and `kata_progress` stores stay (Kata game knobs + per-device
  progress).

**Folder separation per game, shared code in plain folders:**

```
src/gambar-game/   # TepuQ Gambar gameplay (was src/game/)
src/kata-game/     # TariQ Kata gameplay (was src/kata/)
src/admin/         # SHARED admin: main admin page + shared library
                   # (editor, object list, ZIP, sync, merge)
src/gambar-admin/  # Gambar-specific admin tab: "Pengaturan Game"
src/kata-admin/    # Kata-specific admin tab: "Pengaturan Kata"
src/ root          # shared services: config.js, db.js, utils.js,
                   # speech.js, game-picker.js, main.js
```

## Alternatives considered

1. **Keep two stores and sync them** (status quo): duplicated data, two admin
   UIs, and a manual sync rule between the starter lists. Rejected.
2. **Shared store with a `kind` tag instead of a toggle**: objects would be
   duplicated per game kind. Rejected — one record per real-world thing is
   simpler; the two toggles express "this thing appears in game X".
3. **Rename `src/admin/` to `src/gambar-admin/`**: rejected because after the
   merge the admin is shared by both games; the plain `admin` name signals the
   shared shell, while per-game tabs live in `gambar-admin/` and `kata-admin/`.
