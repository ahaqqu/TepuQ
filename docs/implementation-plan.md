# TepuQ Implementation Plan

## Objective
Build a working local version of TepuQ: a single-file browser game for a 15-month-old child with two play modes, parent admin, and ZIP export/import.

---

## Current Status

| # | Task | Status |
|---|------|--------|
| 1 | Finalize design doc | ✅ Done |
| 2 | Create implementation plan | 🔄 In progress |
| 3 | Implement `index.html` | ⬜ Pending |
| 4 | Implement admin mode | ⬜ Pending |
| 5 | Implement game mode (Bebas + Target) | ⬜ Pending |
| 6 | Implement animations & celebration effects | ⬜ Pending |
| 7 | Implement audio (TTS `id-ID`) | ⬜ Pending |
| 8 | Implement IndexedDB storage | ⬜ Pending |
| 9 | Implement ZIP export/import | ⬜ Pending |
| 10 | Add local run script | ⬜ Pending |
| 11 | Test end-to-end in Chrome | ⬜ Pending |
| 12 | Bug fixes and polish | ⬜ Pending |

---

## Modules

### M1: Core HTML/CSS Shell
- Single `index.html`.
- CSS custom properties for colors, sizes, durations.
- Fullscreen game area, hidden admin panel.
- Mode picker overlay.

### M2: Data Layer
- IndexedDB wrapper: `tepuq_db` with stores `objects`, `settings`, `meta`.
- Default settings + starter objects seeded on first run.
- Load/save objects and settings.

### M3: Admin Mode
- URL detection: `?mode=admin`.
- Two-panel layout.
- Object list: thumbnails, name, active toggle, edit/delete/test buttons, drag-and-drop reorder.
- Object editor: name, TTS text, photo upload/preview, color picker, animation dropdown, active toggle.
- Settings panel: background, animations, card size, play mode, repeat threshold, debounce, speech rate/pitch/volume, auto-smash delay, enabled game modes.
- Test TTS button.
- Export ZIP button.
- Import ZIP file input.

### M4: Game Mode
- Mode picker if both modes enabled and no session choice.
- TepuQ Bebas: any key/tap advances.
- TepuQ Target: tap inside card (or any key) advances; miss outside card triggers hint wobble.
- Random card position each time.
- Entry/exit animations.
- Celebration particle burst on success.
- Auto-cycle after inactivity if enabled.
- Background animation.

### M5: Audio
- Web Speech API `id-ID`.
- Cancel previous utterance on new interaction.
- Rate/pitch/volume from settings.
- First gesture unlock fallback.

### M6: ZIP Export/Import
- Build `tepuq-data.zip` with `config.json` + `images/`.
- Import reads ZIP, restores objects/settings, saves blobs to IndexedDB.
- JSZip via CDN with inline fallback or local vendor.

### M7: Local Run Script
- `run-local.sh`: start Python HTTP server on `localhost:8080`, optionally open Chrome.
- Works on Linux.

---

## Acceptance Criteria

- [ ] Open `http://localhost:8080?mode=admin` in Chrome and configure objects.
- [ ] Upload at least one photo and hear correct Indonesian TTS.
- [ ] Export ZIP contains `config.json` and `images/`.
- [ ] Open `http://localhost:8080` and pick a mode.
- [ ] TepuQ Bebas: any tap/key shows new card + plays audio + celebration.
- [ ] TepuQ Target: tapping outside card hints; tapping inside advances.
- [ ] Auto-cycle advances after inactivity when enabled.
- [ ] Import ZIP restores configuration after clearing IndexedDB.

---

## Notes

- No Cloudflare deployment in this phase.
- No recorded audio in this phase (TTS only).
- Family photos are placeholders; user will add real photos later.
- Keep code self-contained and readable for future maintenance.
