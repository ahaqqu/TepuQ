# ADR 0006 — TepuQ Tembak as a Standalone Static Game under `public/tembak/`

**Status:** Accepted

**Date:** 2026-08-16

## Context
A third game — a toy-diorama marble shooter (Three.js, Zuma-like chain matching) —
is being migrated into the TepuQ & TariQ shell as **TepuQ Tembak**. Unlike Gambar
and Kata, Tembak is a full 3D game: its own WebGL canvas, render loop, procedural
audio, HUD overlays, and a vendored Three.js runtime (~2 MB). It does not share
IndexedDB objects, speech/TTS, or the admin library with the toddler games.

We considered three homes for it:

1. **Fold it into `src/tembak-game/` and mount it on the SPA like Kata.** Same
   router and lifecycle, but the shell's CSS/DOM would fight the game's full-page
   canvas, and shipping Three.js inside the main bundle slows first paint for
   Gambar/Kata.
2. **A second Vite entry (`tembak.html`) processed by the bundler.** Cleaner than
   (1) for isolation, but adds multi-entry build config, import-map removal, and
   forces Three.js through the bundler for no gameplay benefit.
3. **A self-contained static site under `public/tembak/`, linked from the Game
   Picker.** Zero coupling to the shell, Vite copies `public/` into `dist/` as-is,
   Cloudflare Pages serves it at `/tembak/`, and the existing deploy workflow needs
   no changes.

## Decision
Ship TepuQ Tembak as a **standalone static page** at `public/tembak/`.

- The Game Picker lists **TepuQ Tembak** as a real `<a href="/tembak/">` (native
  mobile tap, no `preventDefault` risk) styled like the other `mode-btn` entries.
- The game keeps its own `index.html`, `game.js`, `style.css`, `src/` modules, and
  `vendor/three.*.js`. Import map stays; no bundler involvement.
- A **‹ Menu** control in the game links back to `/` (the Game Picker).
- Branding is **TepuQ Tembak** (was GunBatte Balls). Gameplay, levels, and tests
  from the source project are preserved inside `public/tembak/`.

## Rationale
- **Minimal changes.** The shell (main.js, db.js, speech.js, admin) is untouched
  except for one picker link. Existing Gambar/Kata behavior cannot regress.
- **Instant toddler path.** Gambar/Kata first paint does not download Three.js.
- **Deploy for free.** `public/` is already copied into `dist/`; the existing
  Cloudflare Pages workflow ships Tembak with no wrangler or CI edits.
- **Clear boundary.** Tembak is a game page, not a shell module — future refactors
  of IndexedDB/sync cannot break it.

## Consequences
- **Positive:** one deploy serves all three games; Tembak can evolve independently
  (levels, powers, art) without touching shell code; mobile navigation is a plain
  link.
- **Negative:** Tembak does not participate in admin settings, cloud sync, or TTS
  (acceptable — it has its own local `best` score and procedural audio). Deep SPA
  routing (back button gesture inside the shell) does not apply; players use the
  in-game **‹ Menu** button. Unit tests for Tembak logic stay outside Vitest unless
  we later extract pure modules.

## Related
- `CONTEXT.md` — TepuQ Tembak definition.
- ADR 0002 — TepuQ as a multi-game shell (Game Picker as the seam).
- `public/tembak/ARCHITECTURE.md` — source game architecture (mechanics/assets/levels).
