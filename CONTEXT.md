# TepuQ — Domain Glossary

## Core Concepts

### TepuQ
The household app shell that hosts two games and a shared admin/sync layer. "TepuQ" is the product; a player picks one game from the Game Picker, then plays that game.

### Game Picker
The top-level menu on the main page. Lists the installed games: TepuQ Gambar and TepuQ Kata. Choosing a game routes the player into that game; it is not a play-style.

### TepuQ Gambar
The original TepuQ card game: shows photo cards and speaks Indonesian names when the child taps or presses keys. Has two play modes, Bebas and Target, selected on the Gambar sub-picker. Formerly called just "TepuQ."

### TepuQ Kata
The spelling game: a word is shown as empty letter slots and the child drags scattered letter tiles into the correct slots. Distinct from TepuQ Gambar — different gameplay, different data, different code folder (`src/kata/`).

### Play Mode
A variant *within* a game. TepuQ Gambar has Bebas and Target. TepuQ Kata currently has one play mode (spell the word); the concept exists so future Kata variants can hang off the same Game → Play Mode structure.

### Family
A single household that uses TepuQ together. A Family is the unit of identity for cloud sync: all devices logged in with the same credentials share the same Family data. There is no per-person identity inside a Family.

### Device
One browser instance on one phone, tablet, or computer. Each Device keeps its own copy of the Family data in IndexedDB. A Family may have many Devices.

### Local Data
The objects, settings, photos, and voice recordings stored in a Device's browser (IndexedDB). Local Data works offline and independently of cloud sync.

### Custom Object
An object created or edited by a parent through Admin mode. Custom objects travel with ZIP export/import and cloud sync. Starter objects are not exported or synced individually; they are assumed identical on every Device.

### Starter Object
One of the bundled default objects shipped with TepuQ. Starter objects are seeded into Local Data on first run and refreshed from the app bundle on schema updates.

### Sync Store
The cloud copy of a Family's custom objects and settings. Exactly one Sync Store exists per Family. Pulling from the Sync Store overwrites the Device's Local custom data using the same merge strategy as ZIP import.

## Actions

### Push
Upload the Device's current custom objects and settings to the Family's Sync Store.

### Pull
Download the Family's Sync Store and overwrite the Device's local custom data with it.

### Export ZIP
Download a backup file (`tepuq-data.zip`) containing custom objects, settings, images, and audio. Independent of cloud sync.

### Import ZIP
Restore custom objects and settings from a ZIP file into Local Data. Replaces/merges using name/id matching; starter objects are preserved.

## TepuQ Kata Concepts

### Word
A spelling target in TepuQ Kata: a lowercase string (e.g. "are") shown to the child as empty Slots to fill. Stored as a record in `kata_words` with a stable string id, category, order, enabled flag, and optional custom audio. A Word is either a Starter Word or a Custom Word; only Custom Words sync and export.

### Starter Word
A Word bundled with TepuQ Kata and seeded into Local Data on first run. Starter Words are assumed identical on every Device and are refreshed from the app bundle on schema updates. They are not synced or exported individually.

### Custom Word
A Word created or edited by a parent through Kata admin. Custom Words travel with ZIP export/import and cloud sync.

### Letter Tile
A draggable letter shown scattered below the Slots. For MVP, only the Word's correct letters appear (no distractor tiles). A Tile is matched to a Slot by letter **and** the next unfilled position, so duplicate letters in a Word (e.g. "mama") each snap into their own Slot.

### Slot
An outlined empty position at the top of the Kata screen, one per letter of the Word, in order. A Tile snaps into a Slot when the Tile's center is within the snap distance of the Slot's center and the letters match. Filled Slots turn solid green.

### Session
One playthrough of the session-length number of Words (default 10). Completing all Words shows the Win Screen. Session progress (completed Words, current streak, total sessions) is per-Device Local Data and is not synced.

## Deployment

### Pages Project
The single Cloudflare Pages project (`tepuq`) that serves the whole TepuQ shell — both TepuQ Gambar and TepuQ Kata — from one build at `https://tepuq.pages.dev`. There is one deploy per push to `main`; both games ship together.
