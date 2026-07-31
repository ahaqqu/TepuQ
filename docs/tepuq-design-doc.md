# TepuQ — Design Document
## Personalized Keyboard/Touch Game for Toddlers (15+ Months)

**Version:** 3.0  
**Target Age:** 15+ months  
**Language:** Bahasa Indonesia (id-ID)  
**Platform:** Browser (Desktop first; tablet/touch ready)  
**Deployment:** Cloudflare Pages

---

## 1. Overview

TepuQ is a browser game for a 15-month-old child. The child smashes the keyboard or taps the screen to reveal photo cards of family members and familiar objects, accompanied by Indonesian text-to-speech audio or recorded audio. It has two play modes:

- **TepuQ Bebas** — any keypress or tap anywhere triggers the next card.
- **TepuQ Target** — the child must tap the visible photo card (or press any key) to advance. This adds gentle hand–vision coordination practice.

The main screen has zero visible text, buttons, or menus. An admin mode lets parents configure objects, upload photos, record audio, adjust settings, and export/import data as a ZIP.

---

## 2. Goals

1. **Object recognition** — child learns names of family members and everyday objects.
2. **Audio–visual association** — Indonesian speech is paired with a clear photo.
3. **Cause and effect** — every interaction produces a fun reaction.
4. **Hand–vision coordination** *(Target mode)* — child learns to aim at the card.
5. **Parent-friendly setup** — add photos, names, audio, and key bindings via a simple admin UI.

---

## 3. Architecture

### 3.1 Vite + Bun Project
- Modular JavaScript under `src/`, CSS under `src/styles/`, HTML shell in `index.html`.
- Vanilla JS only. No external UI frameworks.
- Local vendor copies of `JSZip` and `FileSaver` in `public/vendor/`.

### 3.2 Modes
| Mode | URL / Trigger | Purpose |
|------|---------------|---------|
| **Mode Picker** | Default first launch | Parent chooses TepuQ Bebas or TepuQ Target. |
| **Game Mode** | After picking mode, or directly if only one is enabled | Child plays. |
| **Admin Mode** | `?mode=admin` | Parent configures objects, photos, audio, settings. |

### 3.3 Storage Strategy
- **Admin editing:** Browser IndexedDB.
- **Backup/Portability:** Export/Import via ZIP (`tepuq-data.zip`).
- **Deployment:** Static files built to `dist/` and deployed to Cloudflare Pages.

### 3.4 Data Flow (Local)
```
Admin Mode → IndexedDB → Export ZIP → local backup
                                     ↓
                               Import ZIP restores IndexedDB
                                     ↓
                               Game Mode reads IndexedDB
```

---

## 4. Game Mode

### 4.1 Launch Flow
1. App checks URL:
   - `?mode=admin` → Admin Mode.
   - Default → Show **Mode Picker** overlay.
2. Mode Picker shows two large, visual buttons.
3. Parent taps/click a mode. Choice is remembered for this session (`sessionStorage`).
4. Admin can disable one or both modes in settings.

### 4.2 Visual Design
- **Background:** Fancy animated background always moving.
  - Options: Gradient Flow, Floating Bubbles, Confetti Rain, Twinkle Stars, Combined.
  - Default: Gradient Flow + Floating Bubbles combined.
- **Card:**
  - Size: 55% of viewport by default (configurable Small/Medium/Large).
  - Rounded corners, soft shadow.
  - **No border when a photo is set.** Colored border only appears on text-placeholder cards.
  - Random position every time for surprise.
  - `object-fit: contain` — full photo visible, no crop/stretch.
- **No visible text, buttons, menus, or UI chrome** on the main screen.
- **Celebration effects:** particle burst at card location on every successful interaction.

### 4.3 Input Handling

#### TepuQ Bebas
| Input | Behavior |
|-------|----------|
| Any keyboard key | Triggers next card + audio. |
| Bound key (e.g. `P`) | Shows the bound object (Papa). |
| Tap anywhere on screen | Triggers next card + audio. |

#### TepuQ Target
| Input | Behavior |
|-------|----------|
| Any keyboard key | Triggers next card + audio. |
| Bound key | Shows the bound object. |
| Tap **inside the card** | Triggers next card + audio. |
| Tap **outside the card** | Ignored (soft miss). Card wobbles gently to hint "tap here". |

Both modes:
- Prevent browser shortcuts, zoom, scroll, context menu.
- Debounce rapid inputs within ~300ms (configurable).

### 4.4 Audio System
- Web Speech API with `id-ID` voice by default.
- Optional recorded audio per object, controlled by a toggle.
- New interaction cancels previous audio.
- Speech rate, pitch, and volume configurable.

---

## 5. Admin Mode (`?mode=admin`)

### 5.1 Layout
- Two-panel: Object list (left), Editor (right).
- Backup reminder banner at the top.

### 5.2 Object Editor
| Field | Type | Description |
|-------|------|-------------|
| Name | Text | Indonesian object name, e.g. "Papa". |
| TTS Text | Text | Defaults to Name. Override, e.g. "Ini Papa!". |
| Quick Keys | Text | Comma-separated keys; case-insensitive. |
| Photo | File upload / Camera | JPG, PNG, WEBP. Stored as Blob in IndexedDB. |
| Audio | MediaRecorder | Record custom audio; toggle to use instead of TTS. |
| Color Theme | Color picker | Tint for placeholder and behind photo. |
| Animation | Dropdown | Preferred entry animation, or "Random". |
| Active | Toggle | Include in game rotation. |

### 5.3 Settings
Settings for background, entry/exit animations, card size, play mode, debounce, speech rate/pitch/volume, auto-smash delay, and enabled game modes.

### 5.4 Export/Import ZIP
- **Export ZIP** generates `tepuq-data.zip` containing `config.json`, `images/`, and `audio/`.
- **Import ZIP** restores objects and settings into IndexedDB.

---

## 6. Data Schema

### 6.1 config.json
```json
{
  "version": "3.0",
  "settings": {
    "backgroundStyle": "combined",
    "globalEntryAnimation": "random",
    "globalExitAnimation": "random",
    "cardSize": "medium",
    "playMode": "random",
    "burstWindow": 1.5,
    "debounceMs": 300,
    "speechRate": 0.8,
    "speechPitch": 1.0,
    "volume": 0.8,
    "autoSmashDelay": 6,
    "enabledModes": ["bebas", "target"]
  },
  "objects": [
    {
      "id": "obj_001",
      "name": "Papa",
      "ttsText": "Papa",
      "color": "#4A90D9",
      "animation": "random",
      "image": "images/obj_001.png",
      "audio": "audio/obj_001.webm",
      "useRecording": false,
      "audioType": "tts",
      "active": true,
      "order": 0,
      "keyBindings": ["p"]
    }
  ]
}
```

### 6.2 IndexedDB Schema
- **Database:** `tepuq_db` (version 2)
- **Stores:**
  - `objects`: object data + image Blob + optional audio Blob.
  - `settings`: key-value pairs.
  - `meta`: version, last modified, last export reminder.

---

## 7. Starter Objects

22 default objects (Papa, Mama, Qila, animals, body parts, foods, etc.) seeded on first run.

---

## 8. Technical Details

### 8.1 Key APIs
- Web Speech API (`id-ID`).
- IndexedDB.
- JSZip.
- MediaRecorder.
- FileReader / Blob.

### 8.2 Build & Test
- Vite builds to `dist/`.
- Vitest for unit tests.
- Playwright for E2E smoke tests.

### 8.3 Browser Support
- Primary: Chrome/Edge on laptop and tablet.
- Touch ready.

---

## 9. File Structure

```
TepuQ/
├── index.html              # Vite shell
├── src/
│   ├── main.js             # bootstrap
│   ├── config.js           # defaults
│   ├── db.js               # IndexedDB
│   ├── utils.js            # helpers
│   ├── speech.js           # TTS + recorded audio
│   ├── styles/
│   │   └── main.css        # all styles
│   ├── game/               # game logic modules
│   └── admin/              # admin logic modules
├── tests/
│   ├── unit/               # Vitest tests
│   └── e2e/                # Playwright tests
├── public/vendor/          # JSZip + FileSaver
├── docs/
│   ├── tepuq-design-doc.md
│   └── implementation-plan.md
├── AGENTS.md
├── README.md
├── package.json
├── vite.config.js
├── vitest.config.js
├── playwright.config.js
├── wrangler.jsonc
└── .github/workflows/deploy.yml
```

---

*End of Design Document*
