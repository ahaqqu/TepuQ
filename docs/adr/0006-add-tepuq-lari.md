# ADR 0006 — Add TepuQ Lari as a Third Game via the Game Picker

**Status:** Accepted

**Date:** 2026-10-18

## Context
A standalone Three.js toddler endless runner ("Bunny Rainbow Runner 3D") was developed outside this repo. It teaches surrounding-object names (kucing, susu, pisang…) while the child runs, jumps, slides, and lane-changes. The family wants it available next to TepuQ Gambar and TariQ Kata on the same site (`tepuq.pages.dev` / `tepuq.ahaqqu.com`), under the TepuQ brand as **TepuQ Lari**.

ADR 0002 established TepuQ & TariQ as a multi-game shell with a Game Picker, folder-per-game code, one Vite app, and one Cloudflare Pages deploy (ADR 0004). Lari is heavier than the DOM games: it is a full-screen WebGL experience with its own HUD, overlays, and audio, and it needs the `three` package.

We considered three homes:

1. **A separate repo / separate Pages project.** Isolates the WebGL bundle, but duplicates the deploy pipeline and forces the family to two bookmarks — rejected by ADR 0002/0004 precedent.
2. **A second Vite HTML entry (`lari.html`) linked from the Game Picker.** Minimal risk to the shell, but splits the main page and loses the single-stage Game Picker pattern.
3. **Fold Lari into the shell as a third game stage** (`#lariStage`), matching Kata's `initKata`/`destroyKata` router seam. (Chosen.)

## Decision
Ship TepuQ Lari inside the existing multi-game shell:

- Game Picker gains a **TepuQ Lari** button; selecting it lazy-loads `src/lari-game/` (so the Three.js chunk is not in the shell's first paint) and shows `#lariStage`.
- Code lives in `src/lari-game/` only: `index.js` (init/destroy), `markup.js` (stage HTML), `game.js` (`createLariGame()` + destroy), `styles.css` scoped under `#lariStage`.
- `three` is a runtime dependency, code-split by Vite via dynamic `import()`.
- In-game **‹ Pilih Game** (start / pause / game-over) returns to the Game Picker using the same `tepuq:lari-back-to-menu` custom-event pattern as Kata, avoiding a circular import with `game-picker.js`.
- Lari has **no IndexedDB stores and no admin tab**. It is self-contained; the shared object library is not used. Learn-word labels are Indonesian to match TepuQ's educational purpose.
- Deploy uses the **existing** Cloudflare Pages pipeline unchanged (ADR 0004). The post-deploy smoke suite gains a TepuQ Lari assertion.

## Rationale
- **One family URL.** Same shell, same deploy, same smoke pipeline as Gambar and Kata.
- **Folder boundary.** `src/lari-game/` depends on the shell only through `game-picker.js`'s router events; it does not touch `db.js`, admin, or the other games' modules.
- **Lazy load keeps the shell light.** Gambar/Kata first paint stays fast; Three.js downloads only when Lari is chosen.
- **Scoped CSS.** Lari styles cannot leak into the shared picker/admin chrome.
- **Destroy is explicit.** `createLariGame()` returns `{ destroy }` (AbortController listeners, cancel rAF, dispose renderer, close AudioContext) so leaving Lari does not leak GPU or input handlers.

## Consequences
- **Positive:**
  - Third game on the same menu with no new secrets, workflows, or Pages projects.
  - Lazy-loaded WebGL keeps the existing games' bundle small.
  - Proven router seam (`init*` / `destroy*` / back-to-menu event) scales to more games.

- **Negative:**
  - `three` adds a large code-split chunk (~580 KB minified) on first Lari launch — acceptable for a 3D game, not for the menu.
  - Lari does not use the shared word library, so parents cannot edit its learn list in admin (v1 keeps the built-in Indonesian list).
  - A broken Lari chunk can still take down the shared deploy if `main` is bad; mitigated by the full suite before merge and the post-deploy smoke.

## Related
- ADR 0002 — TepuQ & TariQ as a Multi-Game Shell.
- ADR 0004 — Deploy via the Existing tepuq.pages.dev Pipeline.
- `src/lari-game/`, `src/game-picker.js`, `tests/e2e/lari.spec.js`, `tests/e2e/deploy-smoke.spec.js`.
