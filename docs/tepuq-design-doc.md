# TepuQ — Design Document
## Personalized Keyboard/Touch Game for Toddlers (15+ Months)

**Version:** 2.0  
**Target Age:** 15+ months  
**Language:** Bahasa Indonesia (id-ID)  
**Platform:** Browser (Desktop first; tablet/touch ready)  
**Deployment:** Static (Cloudflare Pages later; local file/HTTP for now)

---

## 1. Overview

TepuQ is a single-file browser game for a 15-month-old child. The child smashes the keyboard or taps the screen to reveal photo cards of family members and familiar objects, accompanied by Indonesian text-to-speech audio. It has two play modes:

- **TepuQ Bebas** — any keypress or tap anywhere triggers the next card.
- **TepuQ Target** — the child must tap the visible photo card (or press any key while the card is in focus) to advance. This adds gentle hand–vision coordination practice.

The main screen has zero visible text, buttons, or menus. An admin mode lets parents configure objects, upload photos, adjust settings, and export/import data as a ZIP.

---

## 2. Goals

1. **Object recognition** — child learns names of family members and everyday objects.
2. **Audio–visual association** — Indonesian speech is paired with a clear photo.
3. **Cause and effect** — every interaction produces a fun reaction.
4. **Hand–vision coordination** *(Target mode)* — child learns to aim at the card.
5. **Parent-friendly setup** — add photos, names, and audio via a simple admin UI.

---

## 3. Architecture

### 3.1 Single HTML File
- One `index.html` containing HTML, CSS, and JavaScript.
- No external frameworks. Vanilla JS only.
- Optional libraries loaded via CDN with local fallback:
  - `JSZip` for ZIP export/import.
  - `file-saver` (or native download) for saving files.

### 3.2 Modes
| Mode | URL / Trigger | Purpose |
|------|---------------|---------|
| **Mode Picker** | Default first launch | Parent chooses TepuQ Bebas or TepuQ Target. |
| **Game Mode** | After picking mode, or directly if only one is enabled | Child plays. |
| **Admin Mode** | `index.html?mode=admin` | Parent configures objects, photos, audio, settings. |

### 3.3 Storage Strategy
- **Admin editing:** Browser IndexedDB.
- **Backup/Portability:** Export/Import via ZIP (`tepuq-data.zip`).
- **Deployment later:** Static files (`config.json` + `images/` + optional `audio/`).

### 3.4 Data Flow (Local)
```
Admin Mode → IndexedDB → Export ZIP → local project folder
                                    ↓
                              Serve via local HTTP
                                    ↓
                              Game Mode reads config.json + images
```

---

## 4. Game Mode

### 4.1 Launch Flow
1. App checks URL:
   - `?mode=admin` → Admin Mode.
   - Default → Show **Mode Picker** overlay.
2. Mode Picker shows two large, visual buttons:
   - **TepuQ Bebas** (open hand icon)
   - **TepuQ Target** (finger pointing at card icon)
3. Parent taps/click a mode. Choice is remembered for this session (sessionStorage).
4. Next launch within same session skips picker unless user reloads or clears storage.
5. Admin can disable one or both modes in settings.

### 4.2 Visual Design
- **Background:** Fancy animated background always moving.
  - Options: Gradient Flow, Floating Bubbles, Confetti Rain, Twinkle Stars.
  - Default: Gradient Flow + Floating Bubbles combined.
- **Card:**
  - Size: 55% of viewport by default (configurable Small/Medium/Large).
  - Rounded corners, thick colored border, soft shadow.
  - Random position every time for surprise.
  - `object-fit: contain` — full photo visible, no crop/stretch.
  - When a photo is set, the card is sized proportionally to the photo's
    natural aspect ratio so the full image is shown without clipping.
    The largest dimension is capped at the user's chosen card size.
  - Background behind photo: transparent so the animated background shows through.
- **No visible text, buttons, menus, or UI chrome** on the main screen.
- **Celebration effects:** particle burst / confetti explosion at card location on every successful interaction.

### 4.3 Input Handling

#### TepuQ Bebas
| Input | Behavior |
|-------|----------|
| Any keyboard key | Triggers next card + audio. |
| Tap anywhere on screen | Triggers next card + audio. |
| Multi-touch | Treated as single tap. |
| Long press | Card stays; audio does not loop. |

#### TepuQ Target
| Input | Behavior |
|-------|----------|
| Any keyboard key | Triggers next card + audio (keyboard fallback for coordination practice). |
| Tap **inside the card** | Triggers next card + audio. |
| Tap **outside the card** | Ignored (soft miss). Card wobbles gently to hint "tap here". |
| Multi-touch | If any finger lands on the card, counts as success. |
| Long press | Card stays; audio does not loop. |

Both modes:
- Prevent browser shortcuts, zoom, scroll, context menu, double-tap zoom.
- Debounce rapid inputs within ~300ms (configurable).

### 4.4 Interaction Flow
1. Child interacts.
2. Debounce absorbs rapid inputs.
3. If in Target mode and tap is outside the card, card does a small "wobble" hint and no audio plays.
4. On success:
   - Celebration burst at card center.
   - Old card exits with animation.
   - New card enters at a new random position with animation.
   - Indonesian TTS plays the object name immediately.
   - Card stays visible until next interaction.
5. Repeat threshold: same object shown 3 times by default, then switch to a new random object.

### 4.5 Auto-Smash / Screensaver
- If no interaction for 6 seconds (configurable) in **Bebas** mode, the game simulates a rapid keyboard smash: cards pop in and out in quick succession and audio plays.
- In **Target** mode the screen stays idle so the child must intentionally tap the card.

### 4.6 Animation System

#### Entry Animations
- Bounce, Pop, Spin, Slide, Flip, Wobble, Zoom In.
- Per-object override or global random/default.

#### Exit Animations
- Fade Out, Zoom Out, Slide Out, Shrink.

#### Background Animations
- Gradient Flow, Floating Bubbles, Confetti Rain, Twinkle Stars, Combined.

#### Celebration Effects
- Confetti/particle burst at the card position on every successful tap.
- Color matches the object card color.

### 4.7 Audio System
- Web Speech API with `id-ID` voice.
- Plays immediately on successful interaction.
- New interaction cancels previous audio and starts new audio.
- Speech rate slightly slower than default (configurable).
- No visible audio controls.

### 4.8 Start Behavior
- No "Tap to Start" overlay in game mode.
- First interaction unlocks speech if browser requires a user gesture.
- Mode Picker is the only first-launch screen.

---

## 5. Admin Mode (`?mode=admin`)

### 5.1 Layout
- Two-panel: Object list (left), Editor (right).
- Functional, high-contrast UI for parents.

### 5.2 Object List Panel
- Thumbnail cards showing object name and active toggle.
- Actions: Edit, Delete, Test (play in game mode), Reorder via drag-and-drop.
- Global actions: Add Object, Import ZIP, Export ZIP.

### 5.3 Object Editor
| Field | Type | Description |
|-------|------|-------------|
| Name | Text | Indonesian object name, e.g. "Papa". |
| TTS Text | Text | Defaults to Name. Override, e.g. "Ini Papa!". |
| Photo | File upload | JPG, PNG, WEBP. Stored as Blob in IndexedDB. |
| Color Theme | Color picker | Border + subtle tint. |
| Animation | Dropdown | Preferred entry animation, or "Random". |
| Active | Toggle | Include in game rotation. |

### 5.4 Audio Controls
- **Test TTS** button.
- *(Future)* Record own voice via MediaRecorder.
- Default: TTS only.

### 5.5 Settings
| Setting | Options | Default |
|---------|---------|---------|
| Background Style | Gradient Flow, Floating Bubbles, Confetti Rain, Twinkle Stars, Combined | Combined |
| Global Entry Animation | Random, Bounce, Pop, Spin, Slide, Flip, Wobble, Zoom In | Random |
| Global Exit Animation | Random, Fade Out, Zoom Out, Slide Out, Shrink | Random |
| Card Size | Small (40%), Medium (55%), Large (70%) | Medium |
| Play Mode | Random, Sequential | Random |
| Repeat Threshold | 1–10 | 3 |
| Debounce Duration | 100ms–1000ms | 300ms |
| Speech Rate | 0.5x–1.5x | 0.8x |
| Speech Pitch | 0.5–2.0 | 1.0 |
| Volume | 0–100% | 80% |
| Auto-Smash Delay | 0s (off), 3s, 6s, 10s | 6s |
| Enabled Game Modes | Bebas, Target, Both | Both |

### 5.6 Export/Import ZIP
- **Export ZIP** generates `tepuq-data.zip` containing `config.json` and `images/`.
- **Import ZIP** restores objects and settings into IndexedDB.

---

## 6. Data Schema

### 6.1 config.json
```json
{
  "version": "2.0",
  "settings": {
    "backgroundStyle": "combined",
    "backgrounds": ["gradient-flow", "floating-bubbles"],
    "globalEntryAnimation": "random",
    "globalExitAnimation": "random",
    "cardSize": "medium",
    "playMode": "random",
    "repeatThreshold": 3,
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
      "image": "images/papa.jpg",
      "audioType": "tts",
      "active": true,
      "order": 0
    }
  ]
}
```

### 6.2 IndexedDB Schema
- **Database:** `tepuq_db`
- **Stores:**
  - `objects`: object data + image Blob + optional audio Blob.
  - `settings`: key-value pairs.
  - `meta`: version, last modified.

---

## 7. Starter Objects (Updated)

| # | Name | TTS Text | Suggested Color | Photo Source |
|---|------|----------|-----------------|--------------|
| 1 | Papa | "Papa" | Blue `#4A90D9` | User photo |
| 2 | Mama | "Mama" | Pink `#E85D75` | User photo |
| 3 | Qila | "Qila" | Yellow `#F5C542` | User photo |
| 4 | Kucing | "Kucing" | Orange `#F5A623` | User photo / AI |
| 5 | Anjing | "Anjing" | Brown `#8B6914` | User photo / AI |
| 6 | Mobil | "Mobil" | Red `#D0021B` | AI / photo |
| 7 | Pisang | "Pisang" | Yellow `#F8E71C` | Photo / AI |
| 8 | Bola | "Bola" | Green `#7ED321` | Photo / AI |
| 9 | Boneka | "Boneka" | Purple `#BD10E0` | Photo / AI |
| 10 | Rumah | "Rumah" | Teal `#50E3C2` | Photo / AI |
| 11 | Mata | "Mata" | Cyan `#00BCD4` | Close-up photo |
| 12 | Hidung | "Hidung" | Coral `#FF6B6B` | Close-up photo |
| 13 | Telinga | "Telinga" | Lavender `#B39DDB` | Close-up photo |
| 14 | Air | "Air" | Sky `#87CEEB` | Photo |
| 15 | Susu | "Susu" | White `#F5F5F5` | Photo |
| 16 | Buku | "Buku" | Maroon `#800000` | Photo / AI |
| 17 | Pohon | "Pohon" | Forest `#228B22` | Photo / AI |
| 18 | Matahari | "Matahari" | Gold `#FFD700` | Photo / AI |
| 19 | Bulan | "Bulan" | Silver `#C0C0C0` | Photo / AI |
| 20 | Bintang | "Bintang" | Navy `#000080` | AI |
| 21 | Sikat Gigi | "Sikat gigi" | Aqua `#00E5FF` | Photo |
| 22 | Botol Susu | "Botol susu" | Cream `#FFF8E1` | Photo |

---

## 8. Technical Details

### 8.1 Key APIs
- Web Speech API (`id-ID`).
- IndexedDB.
- JSZip (CDN + local fallback).
- MediaRecorder *(future)*.
- FileReader / Blob.

### 8.2 CSS
- No external CSS framework.
- CSS custom properties for theming.
- CSS animations and transitions.
- Viewport units for responsive sizing.

### 8.3 Browser Support
- Primary: Chrome/Edge on laptop.
- Touch ready for future tablet use.

---

## 9. Local Development / Testing

- A local HTTP server is needed because IndexedDB and Speech API may be restricted with `file://` URLs.
- A script (`run-local.sh`) will start a Python HTTP server on `localhost:8080` and optionally open Chrome.

---

## 10. File Structure

```
TepuQ/
├── index.html              # Single file: Game + Admin + CSS + JS
├── run-local.sh            # Start local HTTP server + open Chrome
├── docs/
│   ├── tepuq-design-doc.md
│   └── implementation-plan.md
├── config.json             # Generated by admin
├── images/                 # Generated by admin
│   ├── papa.jpg
│   ├── mama.jpg
│   └── ...
└── audio/                  # Optional future recorded audio
    └── ...
```

---

*End of Design Document*
