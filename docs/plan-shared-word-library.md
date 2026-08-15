# Plan: Shared Word Library with Per-Game Toggles
 
## Goal
Merge the separate `kata_words` store into the existing `objects` store so there is one shared word/photo library. Each word (object) gets two per-game enable toggles: `active` (Gambar, existing) and `kataEnabled` (Kata, new). The admin merges into one editor with both toggles. Sync/export carry the toggle with the object — no separate Kata word sync needed.
 
## Key design decisions
- **One store, one record shape.** The `objects` record gains a `kataEnabled` boolean (default true for single-word starters, false for multi-word names like "Sikat Gigi"). No new store; `kata_words` is retired.
- **Kata reads from `objects`.** A new `loadKataWordsFromObjects()` in `db.js` projects objects into the shape Kata's game code expects. This is the single adapter seam — `game-picker.js` and the Kata game modules stay almost unchanged.
- **Multi-word exclusion.** Objects whose `name` contains a space are excluded from Kata (not spellable). Their `kataEnabled` stays false and is disabled in the editor.
- **Admin merges into one editor.** The separate Kata admin tab/word-list/editor is removed. The Gambar object editor gains an "Aktif di TepuQ Kata" checkbox (`#inpKataEnabled`) next to the existing "Aktif" (Gambar) checkbox. The object list shows both toggle states.
- **Kata settings stay.** `kata_settings` and `kata_progress` stores remain. The Kata settings tab in admin stays (as a third editor tab).
- **Sync simplifies.** The `kata` block in the sync payload is removed — `kataEnabled` rides along on each object. Legacy payloads without `kataEnabled` default to false.
- **ZIP export/import.** Kata's separate ZIP is removed. The Gambar `config.json` gains `kataEnabled` per object.
- **DB version bump to 7.** The upgrade handler drops `kata_words` and adds `kataEnabled` to existing objects.
 
## Files to change
 
### Data layer (src/config.js, src/db.js)
 
**src/config.js:**
- Remove `KATA_STARTER_WORDS` entirely.
- Add `kataEnabled: true` to each single-word `STARTER_OBJECTS` entry; `kataEnabled: false` for "Sikat Gigi".
- Bump `DB_VERSION` from 6 to 7.
 
**src/db.js:**
- `initDB` upgrade: keep creating objects/settings/meta/kata_settings/kata_progress. Remove `kata_words` creation. On v7 upgrade: delete `kata_words` store if exists, add `kataEnabled` to all existing objects (true if no space in name, false otherwise).
- `seedDefaults`: include `kataEnabled` from STARTER_OBJECTS.
- `isStarterObjectUntouched`: add `kataEnabled` to comparison.
- Remove: `getAllKataWords`, `putKataWord`, `deleteKataWord`, `clearKataWords`, `seedKataDefaults`, `isStarterWordUntouched`.
- Add `loadKataWordsFromObjects()`:
  ```js
  export async function loadKataWordsFromObjects() {
    const objects = await getAllObjects();
    return objects
      .filter((o) => o.kataEnabled && !o.name.includes(' '))
      .map((o) => ({
        id: o.id,
        word: o.name.toLowerCase(),
        display: o.name,
        enabled: o.kataEnabled,
        image: o.imageUrl,
        imageBlob: o.imageBlob,
        audioBlob: o.audioBlob,
        useRecording: o.useRecording,
        audioType: o.audioType,
        category: 'default',
        order: o.order,
        source: o.source,
      }));
  }
  ```
- `loadKataData`: replace `getAllKataWords()` with `loadKataWordsFromObjects()`. Remove the seed-if-empty branch for words (seeding is now Gambar's seedDefaults).
- Keep `getKataSettings/putKataSettings/getKataProgress/putKataProgress/reconcileKataSettings`.
 
### Game layer (src/kata/)
 
**src/kata/renderer.js:**
- Change photo rendering from `wordRecord.image` (bare path + `?v=`) to using `wordRecord.image` (now the full `imageUrl`) + `wordRecord.imageBlob` (mint object URL for custom photos).
- Remove `DB_VERSION` import.
 
**src/kata/game-state.js:** No changes (reads `enabled`, `word` — adapter provides both).
 
**src/kata/index.js:** No changes (filters `w.enabled` — adapter provides).
 
**src/kata/audio.js:** No changes (reads `useRecording`, `audioBlob`, `word` — adapter provides).
 
### Admin layer (src/admin/, src/kata-admin/)
 
**src/admin/editor.js:**
- `selectObject()`: read `obj.kataEnabled` → set `#inpKataEnabled.checked`. Disable checkbox if `name` has a space.
- `addNewObject()`: default `#inpKataEnabled` to checked.
- Save handler: add `kataEnabled: document.getElementById('inpKataEnabled').checked` to `newObj`.
 
**src/admin/object-list.js:**
- Per item, show a small Kata badge (e.g. "🔤" if kataEnabled, dimmed if not, hidden if multi-word).
 
**src/admin/index.js:**
- Remove `bindGameTabs()`, `bindKataEditorTabs()`, and `renderKataAdmin()` call.
- Keep `bindAdminTabs()`, `bindEditorTabs()`.
- Add a third editor tab "Pengaturan Kata" wired to render the Kata settings form.
 
**index.html:**
- Remove `#adminKata`, `#editorKata`, `#adminGameTabs`.
- Add `#inpKataEnabled` checkbox to the object form near `#inpActive`.
- Add third editor tab `data-editortab="kata-settings"` + `#editorTabKataSettings` pane with the Kata settings form (moved from `#editorKata`).
 
**src/admin/import-export.js:**
- `exportZip`: add `kataEnabled: o.kataEnabled` per object.
- `importZip`: add `kataEnabled: o.kataEnabled !== false` per object.
 
**src/admin/sync-serializer.js:**
- `buildSyncPayload`: add `kataEnabled: o.kataEnabled` per object. Remove the entire `kata` block.
- `parseSyncPayload`: add `kataEnabled: o.kataEnabled !== false`. Remove `parseKataBlock` and `kata` from return.
- `configToLogString`: remove the `kata.words` redaction loop.
 
**src/admin/sync.js:**
- `handlePush`: remove `loadKataData()` and `kataData` arg. Call `buildSyncPayload(objects, settings)`.
- `handlePull`/`loginAndPull`: remove `kata` from destructuring. Call `applyPulledData(objects, settings)`.
- `applyPulledData`: remove `kata` param and kata merge branch. Only objects + settings + meta.
- Remove imports of `loadKataData`, `getAllKataWords`, `clearKataWords`, `putKataWord`, `putKataSettings`, `mergeImportedWords`.
 
**src/admin/merge-objects.js:**
- Add `kataEnabled: custom.kataEnabled` to the merged record. For new imported objects, carry `kataEnabled` from import.
 
**src/kata-admin/:**
- Delete `merge-words.js`, `import-export.js`, `word-list.js`, `editor.js`.
- Keep `settings-form.js`.
- Rewrite `index.js` to only wire the Kata settings form.
 
### Tests
 
- `tests/unit/kata-merge-words.test.js`: **Delete** (merge-words.js removed).
- `tests/unit/kata-game-state.test.js`: No changes (store-agnostic).
- `tests/unit/kata-slots.test.js`: No changes (pure string logic).
- `tests/unit/sync-serializer.test.js`: Add `kataEnabled` to fixtures, remove `kata` block assertions, assert `kataEnabled` round-trips.
- `tests/unit/object-source.test.js`: Add `kataEnabled` to fixtures if needed.
- `tests/unit/import-export.test.js`: Add `kataEnabled` to fixtures/assertions if needed.
- `tests/e2e/kata.spec.js`: No changes (DOM-level, store-agnostic).
- `tests/e2e/deploy-smoke.spec.js`: No changes.
- `tests/e2e/admin.spec.js`: Update if it references `#adminKata`, `#editorKata`, or `.game-tab`.
- `tests/e2e/game.spec.js`: No changes.
 
## Implementation order
1. `src/config.js` + `src/db.js` — new schema, adapter, remove kata_words, bump DB_VERSION to 7
2. `src/kata/renderer.js` — image URL fix (use imageUrl/imageBlob instead of bare image path)
3. `src/admin/editor.js` + `src/admin/object-list.js` + `index.html` — add `#inpKataEnabled` checkbox, show Kata badge in list, remove `#adminKata`/`#editorKata`/`#adminGameTabs`, add Kata settings as third editor tab
4. `src/admin/index.js` — remove `bindGameTabs`/`bindKataEditorTabs`/`renderKataAdmin`, wire Kata settings tab
5. `src/admin/import-export.js` + `src/admin/sync-serializer.js` + `src/admin/sync.js` + `src/admin/merge-objects.js` — add `kataEnabled` to serialization/merge, remove `kata` block from sync
6. Delete `src/kata-admin/` files (merge-words.js, import-export.js, word-list.js, editor.js). Rewrite `index.js` to only wire Kata settings.
7. Update tests — delete kata-merge-words.test.js, update sync-serializer/object-source/import-export fixtures, update admin.spec.js if needed
8. Run full suite (`bun run test:unit`, `bun run test:e2e`, `bun run build`) — all must pass
9. Commit, push to main, watch GitHub Action deploy, verify prod on `https://tepuq.pages.dev`
 
## Record shape after refactor (objects store)
```js
{
  id: 'obj_001',
  name: 'Papa',
  ttsText: 'Papa',
  color: '#4A90D9',
  animation: 'random',
  imageUrl: 'assets/starter/papa.jpg?v=7',
  imageBlob: null,
  imageSource: 'starter',
  audioBlob: null,
  useRecording: false,
  audioType: 'tts',
  active: true,          // Gambar toggle (existing)
  kataEnabled: true,     // Kata toggle (NEW)
  order: 0,
  keyBindings: [],
  source: 'starter',
}
```
 
## What gets removed
- `KATA_STARTER_WORDS` constant (config.js)
- `kata_words` IndexedDB store
- `getAllKataWords`, `putKataWord`, `deleteKataWord`, `clearKataWords`, `seedKataDefaults`, `isStarterWordUntouched` (db.js)
- `src/kata-admin/merge-words.js`
- `src/kata-admin/import-export.js`
- `src/kata-admin/word-list.js`
- `src/kata-admin/editor.js`
- `#adminKata`, `#editorKata`, `#adminGameTabs` (index.html)
- The `kata` block in sync payload (sync-serializer.js, sync.js)
- `tests/unit/kata-merge-words.test.js`
 
## What stays
- `kata_settings` store + `KATA_DEFAULT_SETTINGS` (Kata game knobs)
- `kata_progress` store (per-device progress)
- `src/kata-admin/settings-form.js` (Kata settings admin UI)
- `src/kata-admin/index.js` (rewired to only Kata settings)
- All `src/kata/` game modules (unchanged except renderer image fix)
- All existing Gambar code (unchanged except adding `kataEnabled` field)
