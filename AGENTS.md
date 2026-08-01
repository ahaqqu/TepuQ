# TepuQ — Agent Instructions

## Project Purpose

TepuQ is a fun and simple browser game for toddlers (15+ months) and their parents. It shows photo cards and speaks Indonesian names when the child taps the screen or presses keys. Parents configure everything through an admin mode. An optional cloud-sync feature lets a family share custom objects and settings across devices.

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
├── index.html              # Vite shell
├── functions/              # Cloudflare Pages Functions
│   └── api/                # /api/login, /api/sync
├── src/
│   ├── main.js             # bootstrap
│   ├── config.js           # defaults and constants
│   ├── db.js               # IndexedDB
│   ├── utils.js            # helpers
│   ├── speech.js           # TTS + recorded audio
│   ├── game/               # game logic modules
│   ├── admin/              # admin logic modules
│   └── styles/             # CSS: base.css, game.css, admin.css, main.css
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
bun run preview    # preview the build
bun run test:unit  # run Vitest unit tests
bun run test:e2e   # run Playwright E2E tests (builds and previews first)

# For cloud sync local dev (serves Pages Functions + KV from wrangler.jsonc):
bunx wrangler pages dev dist
```

---

## Manual Smoke Test Checklist

After any change, verify at least these default-setting flows:

1. `bun run dev`
2. Open `http://localhost:5173`
3. See the mode picker with both buttons.
4. Click **TepuQ Bebas** → press any key → a card appears and audio speaks.
5. Long-press top-left corner → return to mode picker.
6. Click **TepuQ Target** → tap the card → it advances.
7. Open `http://localhost:5173?mode=admin`
8. Add a new object, save, and see it in the list.
9. Export ZIP and confirm `config.json` only contains custom objects/recordings; import merges them with defaults.
10. (If sync is implemented) Open admin, log in with the shared family credentials, push, then pull; custom objects and settings round-trip across Devices.
11. Build passes: `bun run build`.
12. Unit tests pass: `bun run test:unit`.

---

## What Must Not Break

- Default settings in `src/config.js`.
- Starter objects list and seeding in `src/db.js`.
- Game mode: Bebas and Target must both work.
- Admin mode: add/edit/delete object, settings, export/import ZIP.
- Import/export of images and recorded audio.
- Key bindings (case-insensitive).
- No-border rule when an image is set.
- Optional cloud sync: login, push, pull, and logout (when implemented).

---

## Rules for Agents

0. **Always end chat with sentence "Roger Sir TepuQ, this is the end."**

1. **Make minimal changes.** Do not refactor unrelated code.
2. **Run tests before finishing.** At minimum `bun run test:unit`, `bun run test:e2e`, and `bun run build` must all pass.
3. **Prefer editing existing files.** Avoid creating new files unless required.
4. **Update this file (AGENTS.md)** if you change project structure, scripts, or deployment.
5. **Do not commit, push, or create pull requests** unless explicitly asked.
6. **Keep it fun and simple.** If a feature adds complexity, propose a simpler alternative.
7. **One fix, one PR.** See the PR Checklist below for details.
8. **Use `bun` and `bunx`.** This is a Bun project. Use `bun install`, `bun run ...`, and `bunx playwright ...`. Do not use `npm`, `npx`, or `yarn` unless specifically instructed.
9. **Write tests in BDD style.** E2E tests should read as `Given / When / Then` steps using Playwright `test.step`. Unit tests should describe behavior, not implementation.
10. **Avoid `page.waitForTimeout` in E2E tests.** Prefer explicit Playwright waits (e.g., `await expect(locator).toBeVisible()`, `await expect(locator).toHaveClass(...)`). If a timeout is unavoidable because the app has an async, UI-undetectable side effect (e.g., image resize before save), keep it small, comment why, and pair it with an explicit DOM assertion.

### PR Checklist
Before creating a PR, the agent must:
1. Check if a PR already exists for the same fix. If yes, update that branch instead of creating a new PR.
2. Ensure the branch is based on the latest `origin/main` (`git fetch origin main && git rebase origin/main`).
3. Verify the PR is mergeable via `gh pr view` before declaring it ready.
4. If a replacement branch is created, close the old PR immediately and explain why.
5. Never create a second PR for the same fix unless the first one was already closed or merged.
6. **Write the PR title and description in English.** The project uses English for commit messages and PR descriptions so they are readable for all contributors. Indonesian is fine for user-facing copy inside the app.
7. **Use `gh api` to update PR title/description.** Avoid `gh pr edit`; it can fail silently due to GraphQL issues. Example:
   ```bash
   gh api repos/<owner>/<repo>/pulls/<number> \
     --method PATCH \
     --field title="feat: ..." \
     --field body="### What changed\n- ...\n\n### Tests\n- [x] bun run test:unit"
   ```
   Always verify with `gh pr view <number> --json title,body`.

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

The GitHub Action creates the `TEPUQ_SYNC` KV namespace automatically if it is missing and writes its ID into `wrangler.jsonc` before deploying. No manual Wrangler or Cloudflare dashboard setup is required.

Wrangler is a pinned dev dependency (`wrangler` in `package.json`). Local data stays in the browser; the cloud deployment serves static files plus the optional sync API.

## Starter Assets

Default images and audio are bundled in `public/assets/` and seeded into IndexedDB on first run.

- **Images:** bright real photographs from Unsplash and CC0 sources.
- **Audio:** default uses browser Text-to-Speech; parents can record their own voice per object in admin mode.
- Parents can replace any starter object’s photo or recording in admin mode.

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

- Game logic: `src/game/logic.js`
- Card rendering (including border/no-border): `src/game/card.js`
- Admin editor (camera, audio, key bindings): `src/admin/editor.js`
- Settings form: `src/admin/settings-form.js`
- Import/export ZIP: `src/admin/import-export.js`
- Cloud sync: `src/admin/sync.js`, `functions/api/login.js`, `functions/api/sync.js`
