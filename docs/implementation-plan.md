# TepuQ Enhancement Implementation Plan

**Version:** 3.0  
**Goal:** Refactor TepuQ from a single large `index.html` into a maintainable Vite + Bun static site, add regression tests, new features (camera, sound recording, key bindings, local account reminder), and deploy to Cloudflare Pages.

**Core Principles (must be preserved):**
- **Fun and simple** — every feature must stay easy for parents and delightful for toddlers.
- **Minimal changes** — only touch what is needed.
- **Default settings must not break** — the default experience must work without configuration.
- **Browser-first** — no backend server required; all data stays in the browser.

---

## Cloudflare Permissions Required

For the GitHub Actions workflow to deploy to Cloudflare Pages, the repository needs these **Actions secrets** (`Settings > Secrets and variables > Actions`):

| Secret | Description | Where to get it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Token with `Cloudflare Pages:Edit` permission. | Cloudflare dash → **My Profile** → **API Tokens** → **Create Token** → use the **"Cloudflare Pages"** template → select your account and zone. |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID. | Cloudflare dash sidebar → any domain overview page, look for **Account ID**, or Pages dashboard URL. |

### Recommended API token permissions
- **Account:** `Cloudflare Pages:Edit`
- **Zone:** None required if you only deploy to Pages (no custom domain DNS changes).
- **Resources:** Include the account where the Pages project lives.

After creating the Cloudflare Pages project, set the secret `CLOUDFLARE_PROJECT_NAME` if your project name differs from `tepuq`.

---

## Phase 0 — Refactor into Vite + Bun Project

### Why
The current `index.html` is 2,200 lines mixing HTML, CSS, and JavaScript. This causes regressions when multiple agents edit the same file. Splitting the code makes it easier to test, review, and extend while keeping the final output a simple static site.

### Target structure
```
TepuQ/
├── index.html                      # Vite shell: loads bundled main.js
├── package.json                    # Bun scripts + dev deps
├── bun.lockb                       # Bun lockfile
├── vite.config.js                  # Vite build config
├── vitest.config.js                # Vitest config
├── playwright.config.js            # Playwright E2E config
├── wrangler.jsonc                  # Cloudflare Pages project config
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD: test + build + deploy
├── src/
│   ├── main.js                     # App bootstrap + admin/game routing
│   ├── config.js                   # DEFAULT_SETTINGS, starter objects, constants
│   ├── db.js                       # IndexedDB wrapper (objects, settings, meta)
│   ├── utils.js                    # escapeHtml, extFromBlob, placeholder helpers
│   ├── speech.js                   # Web Speech API TTS
│   ├── styles/
│   │   └── main.css                # All styles extracted from index.html
│   ├── game/
│   │   ├── index.js                # initGame, mode picker, demo cards
│   │   ├── input.js                # keyboard, pointer, touch, back trigger
│   │   ├── card.js                 # createCard, populate, sizing, no-border-on-image
│   │   ├── animations.js           # entry/exit animation resolvers
│   │   ├── background.js           # background effect layers
│   │   └── effects.js              # particle celebrations
│   └── admin/
│       ├── index.js                # renderAdmin, tab switching
│       ├── object-list.js          # object list + drag-and-drop reorder
│       ├── editor.js               # object form, camera capture, audio recorder
│       ├── settings-form.js        # game settings form
│       └── import-export.js        # ZIP export/import
├── tests/
│   ├── unit/                       # Vitest unit tests
│   │   ├── chooseNext.test.js
│   │   ├── animations.test.js
│   │   ├── utils.test.js
│   │   └── settings.test.js
│   └── e2e/
│       ├── game.spec.js            # Game mode smoke tests
│       └── admin.spec.js           # Admin mode smoke tests
├── AGENTS.md                       # Agent instructions (English)
├── README.md                       # Updated user-facing README
└── docs/
    ├── tepuq-design-doc.md         # Updated design doc
    └── implementation-plan.md      # This file
```

### Steps
1. Initialize `package.json` with Bun scripts:
   - `bun install`
   - `bun run dev` — start Vite dev server.
   - `bun run build` — build static site to `dist/`.
   - `bun run preview` — preview the build locally.
   - `bun test` — run Vitest unit tests.
   - `bun run test:e2e` — run Playwright E2E tests.
2. Create `vite.config.js`, `vitest.config.js`, `playwright.config.js`.
3. Extract CSS to `src/styles/main.css` without changing rules.
4. Extract JavaScript into modules listed above, preserving behavior.
5. Update `index.html` to a minimal shell.
6. Verify `bun run build` produces a working `dist/` and `bun run preview` passes.

### Acceptance criteria
- `bun install` succeeds.
- `bun run dev` serves the app at `http://localhost:5173`.
- `bun run build` produces `dist/` with `index.html`, bundled JS/CSS, and vendor assets.
- `bun run preview` shows the game and admin mode correctly.

---

## Phase 1 — Regression Tests

### Unit tests (Vitest)
Test pure functions that do not need the DOM or browser APIs.

| Test file | What it covers |
|---|---|
| `logic.test.js` | `random`, `sequential`, `round-robin` play modes; single object edge case; no immediate repeat in random mode; key binding lookup. |
| `animations.test.js` | `resolveEntryAnimation`, `resolveExitAnimation` honor per-object override, global setting, and random fallback. |
| `utils.test.js` | `escapeHtml`, `extFromBlob`, `fitAspectRatio`, `normalizeKey`, `keyStringToBindings` correctness. |
| `settings.test.js` | Default settings structure and expected values. |

### E2E tests (Playwright)
Run against `bun run build && bun run preview`.

| Test file | Scenarios |
|---|---|
| `game.spec.js` | Game loads; mode picker visible; Bebas mode advances on keypress; Target mode advances on card tap, misses outside card do nothing; default settings work. |
| `admin.spec.js` | Admin page loads; add object; edit color/tts; export ZIP contains `config.json` and `images/`; import ZIP restores objects and settings. |

### Acceptance criteria
- `bun run test:unit` passes all unit tests.
- `bun run test:e2e` passes default-settings smoke tests.

---

## Phase 2 — No Border When Image Is Set

### What changes
- Update `createCard()` and the static `#card` CSS class.
- If `obj.imageBlob` exists, apply `border: none`.
- If no image exists (text placeholder), keep the colored `var(--card-border)` border.
- Apply the same rule to `.demo-card` in mode picker and the admin preview box.

### Acceptance criteria
- Cards with uploaded photos render without a colored border.
- Cards without photos still show the colored border and initial letter.

---

## Phase 3 — Camera Photo + Sound Recording in Admin

### Data model changes
Add to each object:
- `audioBlob` — recorded audio Blob, or `null`.
- `useRecording` — boolean; if true and `audioBlob` exists, play recording instead of TTS.
- `keyBindings` — array of lowercase single-character strings, e.g. `["p"]`.

### Admin UI additions in object editor
- **Camera capture:** button "Ambil Foto" opens `<input type="file" accept="image/*" capture="environment">`; shows preview immediately.
- **Audio recorder:**
  - "Rekam Suara" button requests mic permission and starts `MediaRecorder` with `audio/webm`.
  - Show recording state (recording / stopped).
  - "Putar" to preview recording.
  - "Hapus Rekaman" to remove `audioBlob`.
- **Audio toggle:** checkbox "Gunakan rekaman suara (jika ada)" maps to `useRecording`.
- **Quick keys:** input "Tombol cepat (contoh: p)" to set `keyBindings`.

### Game audio changes
- In game, when showing an object:
  - If `useRecording && audioBlob`, play via `<audio>` element.
  - Otherwise use existing TTS via `speech.js`.

### Import/export changes
- Export ZIP includes `audio/` folder with `{id}.webm` files.
- Import ZIP restores `audioBlob` from `audio/{id}.webm`.
- `config.json` exports `audioType` as `"tts"` or `"recording"` and `keyBindings`.

### Acceptance criteria
- Admin can take a photo and save the object.
- Admin can record audio and hear it back in the editor.
- In game, the recorded audio plays when `useRecording` is enabled.
- Export/import preserves both images and recordings.

---

## Phase 4 — Key Bindings

### Behavior
- Each object can have one or more quick keys stored as lowercase.
- In game `onKeyDown`:
  1. Normalize pressed key to lowercase.
  2. Find active object whose `keyBindings` includes the key.
  3. If found, show that object next (in both Bebas and Target modes).
  4. If not found, fall back to existing random/sequential logic.
- Collision: if two objects share a key, use the first active one in order.

### Acceptance criteria
- Binding `"p"` to Papa makes pressing `P` or `p` show Papa.
- Unbound keys keep the default random/sequential behavior.
- Works in both TepuQ Bebas and TepuQ Target.

---

## Phase 5 — Local User Account + Export Reminder

### Scope
- **One local account only.** No SSO, no login, no server.
- Data remains in browser IndexedDB.

### UI additions
- Admin header shows a persistent banner:
  > **Your data is saved only in this browser. Click "Export ZIP" to backup your settings so nothing is lost.**
- "Export ZIP" button is highlighted as the backup action.
- Optionally store a `lastExportReminder` timestamp; if more than 7 days since last export, banner turns yellow with stronger wording.

### Acceptance criteria
- Banner is visible in admin mode.
- Export ZIP works as before.
- No login or account creation flow exists.

---

## Phase 6 — Cloudflare Pages Deployment

### Files to create
- `wrangler.jsonc` — Pages project config.
- `.github/workflows/deploy.yml` — GitHub Actions workflow.

### Workflow steps
1. Checkout code.
2. Install Bun.
3. Run `bun install`.
4. Run `bun test` (unit tests).
5. Run `bun run build`.
6. Deploy `dist/` to Cloudflare Pages using Wrangler Action.

### Required repository secrets
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PROJECT_NAME` (optional, defaults to `tepuq`)

### Acceptance criteria
- Merging to `main` triggers deployment.
- Cloudflare Pages URL serves the game and admin mode.

---

## Phase 7 — AGENTS.md

Write `AGENTS.md` in English. It must include:
- Project overview and core principles (**fun and simple**).
- How to run the project and tests with Bun.
- Manual smoke-test checklist for default settings.
- "What must not break" list.
- Agent rules: minimal changes, run tests after edits, no commits unless explicitly asked, update docs when structure changes.

---

## Order of Execution

1. Phase 0 — Refactor
2. Phase 1 — Tests
3. Phase 2 — No border on image
4. Phase 3 — Camera + sound
5. Phase 4 — Key bindings
6. Phase 5 — Export reminder
7. Phase 6 — Cloudflare deploy
8. Phase 7 — AGENTS.md + README update

Each phase ends with a working build and passing default-setting tests.
