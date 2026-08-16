// Centralized mutable Kata game state + a small state machine. State lives in
// one object so the game loop and renderer read/write a single source of
// truth, mirroring TepuQ Gambar's src/gambar-game/game-state.js pattern.
//
// States: LOADING -> PLAYING -> CELEBRATING -> NEXT_WORD -> PLAYING ... -> VICTORY

import { buildSlots } from './slots.js';

let state = null;
let exhaustedIds = new Set(); // word ids already shown in this lifetime of the picker

export function resetKataState() {
  state = {
    phase: 'LOADING',
    words: [],          // the session's shuffled word records (enabled only)
    index: 0,           // index into words of the current word
    slots: [],          // current word's slots [{index, letter, filled, center}]
    tiles: [],          // current word's tiles [{letter, slotIndex, placed, origin, center}]
    completed: 0,       // words completed this session
    settings: null,
  };
}

export function resetExhaustedWords() {
  exhaustedIds.clear();
}

export function getKataState() {
  return state;
}

export function setKataState(patch) {
  if (!state) state = {};
  Object.assign(state, patch);
  return state;
}

// Prepare the session: pick enabled words in random order with no repeats
// until every enabled word has been shown once ("putar semua"), then start a
// new rotation. The rotation survives word celebrations and session restarts;
// it resets only when the list is exhausted or when the game is started again
// (initKata).
export function prepareSession(words, settings, rng = Math.random) {
  const enabled = words.filter((w) => w.enabled);
  const sessionLength = settings?.sessionLength || 10;
  state.words = pickSessionWords(enabled, sessionLength, rng);
  state.index = 0;
  state.completed = 0;
  state.phase = state.words.length > 0 ? 'PLAYING' : 'VICTORY';
  return state;
}

function pickSessionWords(enabled, sessionLength, rng) {
  if (enabled.length === 0) return [];

  // Words not yet shown in the current rotation cycle ("putar semua").
  let fresh = enabled.filter((w) => !exhaustedIds.has(w.id));
  if (fresh.length === 0) {
    // Every word has been shown once: start a new rotation so words may repeat.
    exhaustedIds.clear();
    fresh = enabled;
  }

  // Random order, no repeats until every enabled word has been shown. If the
  // session would need more words than remain in the cycle, the session simply
  // ends early (the win screen shows) and the next session starts the new
  // rotation — repeats are allowed only after the whole list was exhausted.
  const selected = shuffle(fresh, rng).slice(0, Math.min(sessionLength, fresh.length));
  selected.forEach((w) => exhaustedIds.add(w.id));
  return selected;
}

// Load the current word: build its slots and tiles. Slot centers are filled in
// by the renderer once the DOM is laid out; here we only set structure.
export function loadCurrentWord(rng = Math.random) {
  const word = state.words[state.index];
  if (!word) return null;
  const slots = buildSlots(word.word).map((s) => ({ ...s, filled: false, center: null }));
  const letters = word.word.toLowerCase().split('');
  const tiles = letters.map((letter, i) => ({
    letter,
    slotIndex: i,
    placed: false,
    origin: null,
    center: null,
  }));
  state.slots = slots;
  state.tiles = tiles;
  state.phase = 'PLAYING';
  return word;
}

// Mark a tile as snapped into its slot. Returns true when the word is complete.
export function placeTile(tileIndex, slotIndex) {
  const tile = state.tiles[tileIndex];
  const slot = state.slots[slotIndex];
  if (!tile || !slot || slot.filled || slot.letter !== tile.letter) return false;
  tile.placed = true;
  tile.slotIndex = slotIndex;
  slot.filled = true;
  return state.tiles.every((t) => t.placed);
}

export function isWordComplete() {
  return state.tiles.length > 0 && state.tiles.every((t) => t.placed);
}

export function advanceWord() {
  state.index += 1;
  state.completed += 1;
  if (state.index >= state.words.length) {
    state.phase = 'VICTORY';
    return null;
  }
  return loadCurrentWord();
}

export function currentWord() {
  return state.words[state.index] || null;
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}