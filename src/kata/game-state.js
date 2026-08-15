// Centralized mutable Kata game state + a small state machine. State lives in
// one object so the game loop and renderer read/write a single source of
// truth, mirroring TepuQ Gambar's src/game/game-state.js pattern.
//
// States: LOADING -> PLAYING -> CELEBRATING -> NEXT_WORD -> PLAYING ... -> VICTORY

import { buildSlots } from './slots.js';

let state = null;

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

export function getKataState() {
  return state;
}

export function setKataState(patch) {
  if (!state) state = {};
  Object.assign(state, patch);
  return state;
}

// Prepare the session: pick enabled words, shuffle, reset progress counters.
export function prepareSession(words, settings, rng = Math.random) {
  const enabled = words.filter((w) => w.enabled);
  const shuffled = shuffle(enabled, rng);
  const sessionLength = settings?.sessionLength || 10;
  state.words = shuffled.slice(0, Math.min(sessionLength, shuffled.length));
  state.index = 0;
  state.completed = 0;
  state.phase = state.words.length > 0 ? 'PLAYING' : 'VICTORY';
  return state;
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