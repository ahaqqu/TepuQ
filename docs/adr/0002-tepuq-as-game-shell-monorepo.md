# ADR 0002 — TepuQ & TariQ as a Multi-Game Shell (Gambar + Kata)

**Status:** Accepted

**Date:** 2026-08-15

## Context
TepuQ shipped as a single game: a toddler card game (show a photo, speak the Indonesian name) with two play modes, Bebas and Target. A second toddler game — a drag-and-drop spelling game originally specced as a separate repo `TariQ` — needs to be built. The two games share the same audience, the same local-first + optional-cloud-sync philosophy, the same tech stack (Vite + vanilla JS + IndexedDB + Web Speech API), and the same deployment target (Cloudflare Pages).

We considered three homes for the spelling game:

1. **A separate repo (`TariQ`) mirroring tepuq's structure.** Cleanest isolation, but duplicates all shared infrastructure (DB open/close, TTS wrapper, sync serializer, deploy workflow, CI) and forces families to visit two apps.
2. **A monorepo: fold the spelling game into TepuQ as a second game on the same main page, with a shared menu and separated code.** One app for the family, one deploy, shared infra, but TepuQ stops being "the card game" and becomes a shell hosting multiple games.
3. **A second route/bundle inside the TepuQ repo (`kata.html`), loosely coupled.** Strong code separation, but two Vite entries and two bundles to wire, and it breaks "same main page."

## Decision
TepuQ & TariQ becomes a **multi-game shell**. The repo stays a single Vite app deployed to one Cloudflare Pages project.

- The main page gains a **Game Picker**: a top-level menu listing the installed games. Today those are **TepuQ Gambar** (the original card game, renamed from "TepuQ") and **TariQ Kata** (the spelling game, originally specced as the separate `TariQ` repo).
- Selecting a game routes the player into that game. TepuQ Gambar keeps its existing Bebas/Target sub-picker as the second menu level.
- Code is separated by folder: `src/game/` + `src/admin/` stay Gambar-only; new `src/kata/` + `src/kata-admin/` hold the spelling game and its admin. Shared infrastructure (`src/db.js`, `src/speech.js`, `src/config.js`, `src/utils.js`) is extended, not forked.
- Each game owns its own IndexedDB stores within the single `tepuq_db` database (see ADR 0003 for Kata's stores).
- Admin is one page at `?mode=admin` with per-game tabs; the shared sync/login chrome is rendered once.

## Rationale
- **One app for the family.** A toddler's parent opens TepuQ and picks a game. Two apps would mean two bookmarks, two deploys, two sync backends.
- **Shared infra, not forked.** The IDB connection, TTS wrapper, sync serializer, ZIP merge, and Cloudflare deploy are written once and used by both games. A separate repo would duplicate all of this and risk divergence.
- **Folder separation enforces the boundary.** `src/kata/` depends on shared infra but not on `src/game/`, so the two games cannot accidentally couple. A future split back into a separate repo is still possible.
- **Naming reflects the model.** "TepuQ Gambar" (gambar = picture / tap) and "TariQ Kata" (tariq = drag, kata = word) make the two games self-describing under the TepuQ & TariQ brand.

## Consequences
- **Positive:**
  - One build, one deploy, one sync backend serves both games.
  - Shared infra is maintained once.
  - The Game Picker is a natural seam for adding more games later.

- **Negative:**
  - `src/main.js` becomes a router across games, not just admin-vs-game. The bootstrap path gains one branch.
  - The existing mode picker must be wrapped by a Game Picker, so the card game's first paint changes (we must keep it feeling instant).
  - Shared files (`db.js`, `config.js`, `speech.js`) grow game-conditional logic; we must keep that logic namespaced (e.g. `kata_*` exports) so neither game tangles with the other's data.
  - The admin page grows tabs; the sync serializer and ZIP format must carry both games' stores.

## Related
- `CONTEXT.md` — TepuQ & TariQ, Game Picker, TepuQ Gambar, TariQ Kata, Play Mode definitions.
- ADR 0001 — Cloud Sync as a Single Family Account.
- ADR 0003 — TariQ Kata data stores and sync scope.