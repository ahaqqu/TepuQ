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
│   ├── db.js               # IndexedDB (shared + kata_* stores + Kata CRUD)
│   ├── utils.js            # helpers
│   ├── speech.js           # TTS + recorded audio (shared by both games)
│   ├── game/               # TepuQ Gambar game logic modules
│   │   ├── game-state.js   # centralized mutable game state
│   │   ├── mode-manager.js # Gambar sub-picker (Bebas/Target), startMode
│   │   ├── demo.js         # background demo cards on the picker
│   │   ├── input.js        # keyboard/touch/pointer input handlers
│   │   ├── logic.js        # core game rules and card advancement
│   │   ├── card.js         # card rendering and object URL lifecycle
│   │   └── ...
│   ├── kata/               # TepuQ Kata (spelling game) modules
│   │   ├── index.js        # game loop + state machine
│   │   ├── game-state.js   # Kata state machine (LOADING/PLAYING/VICTORY)
│   │   ├── slots.js        # slot derivation + snap hit-testing (pure)
│   │   ├── drag-engine.js  # touch+mouse drag with magnetic snap
│   │   ├── renderer.js     # DOM: slots, tiles, confetti, win screen
│   │   └── audio.js        # TTS letters/word + success chime
│   ├── admin/              # TepuQ Gambar admin logic modules
│   │   ├── merge-objects.js # shared import/sync merge strategy
│   │   └── ...
│   ├── kata-admin/         # TepuQ Kata admin logic modules
│   │   ├── index.js        # Kata admin shell (rendered in the Kata admin tab)
│   │   ├── word-list.js    # word CRUD list with drag reorder
│   │   ├── editor.js       # word editor + audio record/upload
│   │   ├── settings-form.js# Kata settings (letter/slot/snap/session)
│   │   ├── merge-words.js  # Kata import/sync merge strategy (pure)
│   │   └── import-export.js# Kata ZIP export/import
│   └── styles/             # CSS: base, gameplay, theme, admin, kata, kata-admin
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
6. Click **TepuQ Kata** → a word appears as empty slots with scattered letter tiles → drag a letter into its slot → it snaps and turns green.
7. Open `http://localhost:5173?mode=admin` → see the Gambar/Kata game tabs.
8. Add a new object (Gambar) and a new word (Kata), save, and see each in its list.
9. Export ZIP (Gambar) and confirm `config.json` only contains custom objects/recordings; export ZIP (Kata) and confirm `kata-words.json` only contains custom words. Import merges each with defaults.
10. (If sync is implemented) Open admin, log in with the shared family credentials, push, then pull; custom objects, settings, and Kata words round-trip across Devices.
11. Build passes: `bun run build`.
12. Unit tests pass: `bun run test:unit`.

---

## What Must Not Break

- Default settings in `src/config.js` (Gambar + Kata).
- Starter objects list and seeding in `src/db.js`; starter words in `KATA_STARTER_WORDS`.
- Game Picker: both games must launch from the main page.
- TepuQ Gambar: Bebas and Target must both work.
- TepuQ Kata: drag a letter into the correct slot snaps it; wrong slot bounces back; completing the session shows the win screen.
- Admin mode: add/edit/delete object (Gambar) and word (Kata), settings, export/import ZIP for each game.
- Import/export of images and recorded audio (Gambar); import/export of per-word audio (Kata).
- Key bindings (case-insensitive, Gambar).
- No-border rule when an image is set (Gambar).
- Optional cloud sync: login, push, pull, and logout (when implemented). Push/pull now carries Kata custom words + settings alongside Gambar data.

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

**The trap:** `src/game/input.js`'s `onTouchStart` calls `e.preventDefault()`. On mobile, `preventDefault()` on `touchstart` cancels the browser's synthetic `click` and blocks input focus — any element that relies on native clicks (links, forms, buttons) stops working while the mode picker is visible.

**Development rules (follow when touching `input.js` or adding interactive UI):**
1. Do **not** call `e.preventDefault()` while the mode picker is visible. Let normal UI interactions (links, form inputs, submit buttons) work natively.
2. Skip `INPUT`, `TEXTAREA`, and `SELECT` targets entirely so typing/focus is never blocked.
3. Keep `e.preventDefault()` only for actual gameplay touches (mode picker hidden), so accidental touches don't advance cards on the picker screen.
4. Touch on the `#backTrigger` is handled separately with its own listeners — do not rely on the document-level handler for it.
5. Every game input handler must early-return when `document.body.classList.contains('admin')` — check `onTouchStart`/`onPointerDown`/`onKeyDown` guards.
6. Before finishing, verify at least the Admin link (`⚙️ Admin`) and the username/password inputs are tappable on a phone-sized viewport.

Current correct behavior lives in `onTouchStart` in `src/game/input.js`. If you restructure the input handlers, keep these rules.

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
- `admin.css` — admin UI layout and components.

When changing styling, prefer editing `theme.css`. When changing game behavior that relies on layout or animations, edit `gameplay.css`.

---

## Useful References

- Game state: `src/game/game-state.js`
- Mode picker / startMode: `src/game/mode-manager.js`
- Game input handlers: `src/game/input.js`
- Game logic: `src/game/logic.js`
- Card rendering (including border/no-border): `src/game/card.js`
- Admin editor (camera, audio, key bindings): `src/admin/editor.js`
- Settings form: `src/admin/settings-form.js`
- Import/export ZIP: `src/admin/import-export.js`
- Import/sync merge strategy: `src/admin/merge-objects.js`
- Cloud sync: `src/admin/sync.js`, `functions/api/login.js`, `functions/api/me.js`, `functions/api/sync.js`
