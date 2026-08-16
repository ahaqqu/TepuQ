# TepuQ — Agent Instructions

## Project Purpose

TepuQ is a fun and simple browser game for toddlers (15+ months) and their parents. It is a multi-game shell: **TepuQ Gambar** (the original photo-card game) and **TepuQ Kata** (a drag-and-drop spelling game). The main page shows a Game Picker; picking a game routes into it. Parents configure everything through a shared admin mode with per-game tabs. An optional cloud-sync feature lets a family share custom objects, settings, and Kata words across devices.

**Core principles (do not break):**
- **Fun and simple** — keep the experience joyful and easy.
- **Default settings must work** — the game should run immediately without configuration.
- **Browser-first** — all data lives in the browser (IndexedDB). Cloud sync is optional and uses a minimal backend.
- **Minimal changes** — only touch what is needed.
- **Test after changing** — run unit and E2E tests before finishing.

---

## Tech Stack

- **Build tool:** Vite
- **Package manager:** Bun
- **Frontend:** Vanilla JavaScript + HTML + CSS (no frameworks)
- **Local storage:** IndexedDB in the browser
- **Cloud sync:** Cloudflare Pages Functions + KV
- **Tests:** Vitest (unit) + Playwright (E2E)
- **Deployment:** Cloudflare Pages via GitHub Actions

---

## Project Structure

```
TepuQ/
├── index.html              # Vite shell (Game Picker + Gambar + Kata + Admin)
├── functions/              # Cloudflare Pages Functions
│   └── api/                # /api/login, /api/logout, /api/me, /api/sync
├── scripts/                # helper scripts (e.g. dynamic E2E port runner)
├── src/
│   ├── main.js             # bootstrap (admin vs game; game -> Game Picker)
│   ├── game-picker.js      # top-level Game Picker (TepuQ Gambar / TepuQ Kata)
│   ├── config.js           # defaults + constants (Gambar + Kata)
│   ├── db.js               # IndexedDB (objects + settings + meta + kata_settings/kata_progress)
│   ├── utils.js            # helpers
│   ├── speech.js           # TTS + recorded audio (shared by both games)
│   ├── gambar-game/        # TepuQ Gambar game logic modules (Gambar-only)
│   │   ├── game-state.js   # centralized mutable game state
│   │   ├── mode-manager.js # Gambar sub-picker (Bebas/Target), startMode
│   │   ├── demo.js         # background demo cards on the picker
│   │   ├── input.js        # keyboard/touch/pointer input handlers
│   │   ├── logic.js        # core game rules and card advancement
│   │   ├── card.js         # card rendering and object URL lifecycle
│   │   └── ...
│   ├── kata-game/          # TepuQ Kata (spelling game) modules (Kata-only)
│   │   ├── index.js        # game loop + state machine
│   │   ├── game-state.js   # Kata state machine (LOADING/PLAYING/VICTORY)
│   │   ├── slots.js        # slot derivation + snap hit-testing (pure)
│   │   ├── drag-engine.js  # touch+mouse drag with magnetic snap
│   │   ├── renderer.js     # DOM: slots, tiles, photo, confetti, win screen
│   │   └── audio.js        # TTS letters/word + success chime
│   ├── admin/              # SHARED admin: main admin page + shared word/photo library
│   │   ├── index.js        # admin shell (tabs: Objek, Sinkron; editor tabs wiring)
│   │   ├── editor.js       # shared object editor (incl. "Aktif di TepuQ Kata" toggle)
│   │   ├── object-list.js  # shared object list with Kata badge + drag reorder
│   │   ├── import-export.js# shared ZIP export/import (objects carry kataEnabled)
│   │   ├── sync.js         # cloud sync (objects + settings only)
│   │   ├── sync-serializer.js
│   │   └── merge-objects.js # shared import/sync merge strategy
│   ├── gambar-admin/       # Gambar-specific admin tab ("Pengaturan Game")
│   │   ├── index.js        # tab entry point
│   │   └── settings-form.js
│   ├── kata-admin/         # Kata-specific admin tab ("Pengaturan Kata")
│   │   ├── index.js        # tab entry point
│   │   └── settings-form.js # Kata settings (letter/slot/snap/session)
│   └── styles/             # CSS: base, gameplay, theme, admin, kata
├── public/
│   ├── assets/             # bundled CC0 starter images + audio
│   └── vendor/             # third-party JS libraries
├── tests/
│   ├── unit/               # Vitest tests
│   └── e2e/                # Playwright tests
├── AGENTS.md               # this file
├── package.json            # Bun scripts
├── vite.config.js
├── vitest.config.js
├── playwright.config.js
├── wrangler.jsonc          # Cloudflare Pages config
└── .github/workflows/deploy.yml
```

---

## How to Run

```bash
bun install        # install dependencies
bun run dev        # start Vite dev server at http://localhost:5173
bun run build      # build static site to dist/
bun run preview    # preview the build on port 4173
bun run test:unit  # run Vitest unit tests
bun run test:e2e   # run Playwright E2E tests against the current dist/
                   # scripts/run-e2e.js finds a free port automatically, so
                   # multiple agents can run E2E concurrently and won't clash
                   # with a separate `bun run preview` on port 4173

# Override the E2E preview port manually if needed:
TEPUQ_E2E_PORT=4180 bun run test:e2e

# For cloud sync local dev (serves Pages Functions + KV from wrangler.jsonc):
bunx wrangler pages dev dist
```

---

## Manual Smoke Test Checklist

After any change, verify at least these default-setting flows:

1. `bun run dev`
2. Open `http://localhost:5173`
3. See the **Game Picker** with TepuQ Gambar and TepuQ Kata buttons.
4. Click **TepuQ Gambar** → see the Bebas/Target sub-picker → click **TepuQ Bebas** → press any key → a card appears and audio speaks.
5. Long-press top-left corner → return to mode picker; "Pilih Game" returns to the Game Picker.
6. Click **TepuQ Kata** → a word appears with its shared photo, empty slots, and scattered letter tiles → drag a letter into its slot → it snaps and turns green.
7. Open `http://localhost:5173?mode=admin` → see the object list (shared library) with the Objek/Sinkron tabs and the Editor Objek / Pengaturan Game / Pengaturan Kata editor tabs.
8. Add a new object, save it, and see it in the list; with a single-word name it is also a Kata word (🔤 badge); multi-word names are Kata-excluded automatically.
9. Export ZIP and confirm `config.json` only contains custom objects/recordings and carries the `kataEnabled` toggle per object. Import merges with defaults.
10. (If sync is implemented) Open admin, log in with the shared family credentials, push, then pull; custom objects, settings, and the kataEnabled toggles round-trip across Devices.
11. Build passes: `bun run build`.
12. Unit tests pass: `bun run test:unit`.

---

## What Must Not Break

- Default settings in `src/config.js` (Gambar + Kata).
- Starter objects list and seeding in `src/db.js`; each starter object's `kataEnabled` toggle.
- Game Picker: both games must launch from the main page.
- TepuQ Gambar: Bebas and Target must both work.
- TepuQ Kata: drag a letter into the correct slot snaps it; wrong slot bounces back; completing the session shows the win screen; each word shows its shared library photo.
- Admin mode: add/edit/delete object, settings, export/import ZIP. The object editor is the single shared library editor — the "Aktif di TepuQ Kata" toggle decides which objects are Kata words.
- Import/export of images and recorded audio (shared objects).
- Key bindings (case-insensitive, Gambar).
- No-border rule when an image is set (Gambar).
- Optional cloud sync: login, push, pull, and logout (when implemented). Push/pull carries custom objects + settings; `kataEnabled` rides on each object.

---

## Rules for Agents

0. **Always end chat with sentence "Roger Sir TepuQ, this is the end."**

1. **Make minimal changes.** Do not refactor unrelated code.
2. **Run tests before finishing.** At minimum `bun run test:unit`, `bun run test:e2e`, and `bun run build` must all pass.
3. **Prefer editing existing files.** Avoid creating new files unless required.
4. **Update this file (AGENTS.md)** if you change project structure, scripts, or deployment.
5. **Do not commit, push, or create pull requests** unless explicitly asked.
6. **Keep it fun and simple.** If a feature adds complexity, propose a simpler alternative.
7. **Use `bun` and `bunx`.** This is a Bun project. Use `bun install`, `bun run ...`, and `bunx playwright ...`. Do not use `npm`, `npx`, or `yarn` unless specifically instructed.
8. **Write tests in BDD style.** E2E tests should read as `Given / When / Then` steps using Playwright `test.step`. Unit tests should describe behavior, not implementation.
9. **Avoid `page.waitForTimeout` in E2E tests.** Prefer explicit Playwright waits (e.g., `await expect(locator).toBeVisible()`, `await expect(locator).toHaveClass(...)`). If a timeout is unavoidable because the app has an async, UI-undetectable side effect (e.g., image resize before save), keep it small, comment why, and pair it with an explicit DOM assertion.

## Pull Requests

### PR Checklist
Before creating a PR, the agent must:
1. Check if a PR already exists for the same fix. If yes, update that branch instead of creating a new PR.
2. Ensure the branch is based on the latest `origin/main` (`git fetch origin main && git rebase origin/main`).
3. Verify the PR is mergeable via `gh pr view` before declaring it ready.
4. If a replacement branch is created, close the old PR immediately and explain why.
5. Never create a second PR for the same fix unless the first one was already closed or merged.
6. **Write the PR title and description in English.** The project uses English for commit messages and PR descriptions so they are readable for all contributors. Indonesian is fine for user-facing copy inside the app.

### Updating PR title and description
- **Use `gh api --input` to update PR title/description.** Avoid `gh pr edit`; it can fail silently due to GraphQL issues. Also avoid `--field title=... --field body=...` when the body contains newlines or quotes, because the shell will send a JSON-escaped literal to GitHub and the PR description will render as broken escaped text.

   Create a JSON payload file and send it with `--input`:
   ```bash
   cat >/tmp/pr-payload.json <<'JSON'
   {
     "title": "feat: ...",
     "body": "### What changed\n- ...\n\n### Tests\n- [x] bun run test:unit"
   }
   JSON
   gh api repos/<owner>/<repo>/pulls/<number> \
     --method PATCH \
     --input /tmp/pr-payload.json
   ```
- Always verify with `gh pr view <number> --json title,body`.

### Push / PR description rule
Every time a branch is pushed after additional commits or fixes, the agent must re-read the PR description and update it so it accurately reflects the final state of the branch. Do not leave the PR description stale or referencing outdated commits/files.

---

## Development Rule: Tap / Click Must Work on Mobile

During development, whenever adding or changing interactive elements (links, buttons, forms, inputs) on the main page, ensure taps still work on mobile. The game's input handlers can silently break mobile taps:

**The trap:** `src/gambar-game/input.js`'s `onTouchStart` calls `e.preventDefault()`. On mobile, `preventDefault()` on `touchstart` cancels the browser's synthetic `click` and blocks input focus — any element that relies on native clicks (links, forms, buttons) stops working while the mode picker is visible.

**Development rules (follow when touching `input.js` or adding interactive UI):**
1. Do **not** call `e.preventDefault()` while the mode picker is visible. Let normal UI interactions (links, form inputs, submit buttons) work natively.
2. Skip `INPUT`, `TEXTAREA`, and `SELECT` targets entirely so typing/focus is never blocked.
3. Keep `e.preventDefault()` only for actual gameplay touches (mode picker hidden), so accidental touches don't advance cards on the picker screen.
4. Touch on the `#backTrigger` is handled separately with its own listeners — do not rely on the document-level handler for it.
5. Every game input handler must early-return when `document.body.classList.contains('admin')` — check `onTouchStart`/`onPointerDown`/`onKeyDown` guards.
6. Before finishing, verify at least the Admin link (`⚙️ Admin`) and the username/password inputs are tappable on a phone-sized viewport.

Current correct behavior lives in `onTouchStart` in `src/gambar-game/input.js`. If you restructure the input handlers, keep these rules.

---

## Cloudflare Deployment Notes

The GitHub Action in `.github/workflows/deploy.yml` deploys the `dist/` folder to Cloudflare Pages. It will create the Pages project automatically if it does not already exist. Required repository secrets:

- `CLOUDFLARE_API_TOKEN` — with `Cloudflare Pages:Edit` permission.
- `CLOUDFLARE_ACCOUNT_ID` — from Cloudflare dashboard.
- `CLOUDFLARE_PROJECT_NAME` — optional, defaults to `tepuq`.

For cloud sync, also set these repository secrets:

- `TEPUQ_USER` — shared family sync username.
- `TEPUQ_PASS` — shared family sync password.
- `TEPUQ_JWT_SECRET` — JWT signing secret (long random string).

The GitHub Action creates the `TEPUQ_SYNC` KV namespace automatically if it is missing and writes its ID into `wrangler.jsonc` before deploying. The deploy step strips JSONC comments before parsing `wrangler.jsonc` so inline comments do not break the workflow. No manual Wrangler or Cloudflare dashboard setup is required.

Wrangler is a pinned dev dependency (`wrangler` in `package.json`). Local data stays in the browser; the cloud deployment serves static files plus the optional sync API.

## Starter Assets

Default images and audio are bundled in `public/assets/` and seeded into IndexedDB on first run.

- **Images:** bright real photographs from Unsplash and CC0 sources.
- **Audio:** default uses browser Text-to-Speech; parents can record their own voice per object in admin mode.
- Parents can replace any starter object’s photo or recording in admin mode.

### Cache-busting rule

Starter images are served as plain HTTP URLs and cached by the browser; IndexedDB only stores the URL string. **Whenever a bundled starter image (or any `public/assets/starter/` file) changes, bump `DB_VERSION` in `src/config.js` in the same commit.** The version is baked into the stored starter URLs (`?v=<DB_VERSION>`), and `src/db.js` normalizes the URLs on every load — so the moment the new build runs, browsers request the new URL and fetch the updated file instead of serving a stale cached image. Changing an asset without bumping the version leaves browsers serving the old cached image.

See `docs/assets-sources.md` for the full list of files, URLs, and licenses.

---

## CSS Structure

Styles live in `src/styles/` and are imported through `src/styles/main.css`:

- `base.css` — reset, loader, shared utilities, toast message.
- `gameplay.css` — structural game CSS: layout, sizing, touch/keyboard behavior, hit areas, functional animations, card/particle shells, hints.
- `theme.css` — visual styling: colors, gradients, decorative background effects, mode picker look, hover/focus states. Safe to override or swap without breaking gameplay.
- `admin.css` — admin UI layout and components (shared admin + per-game tabs).
- `kata.css` — TepuQ Kata gameplay styling (stage, slots, tiles, photo, win screen).

When changing styling, prefer editing `theme.css`. When changing game behavior that relies on layout or animations, edit `gameplay.css`.

---

## Useful References

- Game state: `src/gambar-game/game-state.js`
- Mode picker / startMode: `src/gambar-game/mode-manager.js`
- Game input handlers: `src/gambar-game/input.js`
- Game logic: `src/gambar-game/logic.js`
- Card rendering (including border/no-border): `src/gambar-game/card.js`
- Admin shell (shared admin page): `src/admin/index.js`
- Shared object editor (incl. "Aktif di TepuQ Kata" toggle): `src/admin/editor.js`
- Gambar settings tab: `src/gambar-admin/settings-form.js`
- Kata settings tab: `src/kata-admin/settings-form.js`
- Kata game loop: `src/kata-game/index.js`
- Kata photo/slot rendering: `src/kata-game/renderer.js`
- Objects → Kata words adapter: `loadKataWordsFromObjects()` in `src/db.js`
- Import/export ZIP: `src/admin/import-export.js`
- Import/sync merge strategy: `src/admin/merge-objects.js`
- Cloud sync: `src/admin/sync.js`, `functions/api/login.js`, `functions/api/me.js`, `functions/api/sync.js`

---

## Hard-Won Lessons (problems + solutions)

Recorded so the next agent reuses these solutions instead of re-solving them:

### 1. White line inside Kata letters on Android — never use `-webkit-text-stroke` on FILLED letters
- **Problem:** on real Android devices a horizontal white line appears across thin horizontal strokes of the Kata letter tiles. Desktop Chrome and DevTools device emulation render fine, so it cannot be reproduced or verified locally — only the real device shows it.
- **Diagnosis without image vision:** decode the screenshot's PNG pixels (Node `zlib.inflateSync` + PNG scanline unfiltering) and scan for white bands crossing glyph strokes. The cause: Android Chrome paints `-webkit-text-stroke` **over** the glyph fill, so the stroke's inner half eats thin strokes.
- **Solution (already applied in `src/styles/kata.css`):** filled letters (`.kata-tile-letter`, `.kata-tile.snapped .kata-tile-letter`) use an 8-direction hard `text-shadow` white outline instead of the stroke — shadows render behind the fill on every browser. Do **not** reintroduce `-webkit-text-stroke` on filled letters. Slot targets (`color: transparent` + stroke) are unaffected and may keep the stroke.

### 2. Victory TTS was silently broken by a missing import
- **Problem:** the celebration never spoke, and the bare `try/catch` around the `speak()` call hid the cause: `speak` was never imported into `src/kata-game/index.js` (ReferenceError swallowed silently).
- **Solution:** import `{ speak } from '../speech.js'` there; never rely on a bare catch around a speech call — a missing import fails silently. Greeting text: `Selamat <username>, kamu hebat!` (fallback without username).

### 3. Playwright E2E stubbing gotchas
- `window.speechSynthesis` is a read-only accessor on `Window`: plain assignment is silently ignored. In `page.addInitScript` use `Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true })` and define `SpeechSynthesisUtterance` the same way. Otherwise the app feeds fake utterances to the native engine and throws `Failed to execute 'speak' on 'SpeechSynthesis'`.
- `page.waitForFunction(fn)` serializes `fn` to the browser — Node closure variables are NOT available there. Pass them as the second argument: `waitForFunction((i) => ..., i, { timeout })`.
- To assert file-based sound playback, patch `HTMLMediaElement.prototype.play` in an init script and record `this.src`. Web Audio oscillator chimes (success/victory) bypass `HTMLMediaElement`, which is how the tests distinguish the two.

### 4. Sourcing Mixkit sound effects
- `curl` hits a Cloudflare challenge; load pages with Playwright (real Chromium) instead.
- Search URL: `https://mixkit.co/free-sound-effects/discover/<term>/`.
- Download URL pattern: `https://assets.mixkit.co/active_storage/sfx/<id>/<id>.wav` (preview: `<id>-preview.mp3`).
- Mixkit Free License: free for commercial use, no attribution, do not redistribute as-is. Record every new asset in `docs/assets-sources.md`.
- The try-again "boing" is shared by both games via `playTryAgainSfx()` in `src/speech.js` (250 ms debounce against pointer + touch double-firing on one tap). Kata's `onReject` (letter dropped outside a target) and Gambar Target's off-card tap (see `onPointerDown`/`onTouchStart` in `src/gambar-game/input.js`) both call it. `src/kata-game/audio.js` re-exports it as `playEncourageSfx`.

### 5. Kata word rotation ("putar semua") — celebration must not reset it
- **Problem:** the victory "Main Lagi" button restarted the session from only the finished session's words, so the same 3 words repeated forever — the celebration effectively reset the rotation.
- **Solution (already applied):** keep the FULL word list in a module variable at `initKata` and pass it to `prepareSession` on Main Lagi. The exhausted-words set lives at module level in `src/kata-game/game-state.js`, cleared only when every enabled word has been shown once or when the game starts again (`resetExhaustedWords()` in `initKata`). See the rotation tests in `tests/unit/kata-game-state.test.js`.

### 6. The dev-machine Node.js must be an official build (DSH harness)
- **Problem:** the agent `run_code` tool failed every call with `Node.js is not compiled with TypeScript support` — Ubuntu's distro `nodejs` package is built without amaro (type stripping), which the harness needs.
- **Solution:** install an official Node tarball into `/usr/local` (it takes PATH priority over `/usr/bin/node`) and restart the DSH server. Verify with: `printf 'const x: number = 1;\n' > /tmp/t.ts && node /tmp/t.ts`
