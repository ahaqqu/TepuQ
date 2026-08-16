import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetKataState, getKataState, prepareSession, loadCurrentWord,
  placeTile, isWordComplete, advanceWord, currentWord,
} from '@/kata-game/game-state.js';

const words = [
  { id: 'kata_001', word: 'mama', enabled: true },
  { id: 'kata_002', word: 'papa', enabled: true },
  { id: 'kata_003', word: 'api', enabled: false },
];
const settings = { sessionLength: 10 };

const seqRng = (() => { let n = 0; return () => { n += 0.01; return n % 1; }; })();

beforeEach(() => resetKataState());

describe('prepareSession', () => {
  it('selects only enabled words', () => {
    prepareSession(words, settings, seqRng);
    const ids = getKataState().words.map((w) => w.id);
    expect(ids).not.toContain('kata_003');
    expect(ids).toHaveLength(2);
  });

  it('respects sessionLength', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ id: 'w' + i, word: 'w' + i, enabled: true }));
    prepareSession(many, { sessionLength: 5 }, seqRng);
    expect(getKataState().words).toHaveLength(5);
  });

  it('enters VICTORY when there are no enabled words', () => {
    prepareSession([{ id: 'x', word: 'x', enabled: false }], settings, seqRng);
    expect(getKataState().phase).toBe('VICTORY');
  });
});

describe('loadCurrentWord', () => {
  it('builds slots and tiles for the current word', () => {
    prepareSession(words, settings, seqRng);
    const word = loadCurrentWord();
    expect(word).toBeTruthy();
    expect(getKataState().slots).toHaveLength(word.word.length);
    expect(getKataState().tiles).toHaveLength(word.word.length);
    expect(getKataState().phase).toBe('PLAYING');
  });
});

describe('placeTile (duplicate letters)', () => {
  it('marks a tile and slot as placed when letters match', () => {
    prepareSession([{ id: 'm', word: 'mama', enabled: true }], settings, seqRng);
    loadCurrentWord();
    const done = placeTile(0, 0); // first 'm' tile into first 'm' slot
    expect(done).toBe(false);
    expect(getKataState().slots[0].filled).toBe(true);
    expect(getKataState().tiles[0].placed).toBe(true);
  });

  it('rejects a mismatched letter', () => {
    prepareSession([{ id: 'm', word: 'mama', enabled: true }], settings, seqRng);
    loadCurrentWord();
    const result = placeTile(1, 0); // 'a' tile into 'm' slot
    expect(result).toBe(false);
    expect(getKataState().slots[0].filled).toBe(false);
  });

  it('rejects an already-filled slot', () => {
    prepareSession([{ id: 'm', word: 'mama', enabled: true }], settings, seqRng);
    loadCurrentWord();
    placeTile(0, 0);
    const result = placeTile(2, 0); // second 'm' tile into filled slot 0
    expect(result).toBe(false);
  });

  it('reports word complete when all tiles are placed', () => {
    prepareSession([{ id: 'a', word: 'api', enabled: true }], settings, seqRng);
    loadCurrentWord();
    placeTile(0, 0); // a -> slot 0
    placeTile(1, 1); // p -> slot 1
    const done = placeTile(2, 2); // i -> slot 2
    expect(done).toBe(true);
    expect(isWordComplete()).toBe(true);
  });
});

describe('advanceWord', () => {
  it('moves to the next word and increments completed', () => {
    prepareSession(words, settings, seqRng);
    loadCurrentWord();
    advanceWord();
    expect(getKataState().completed).toBe(1);
    expect(getKataState().index).toBe(1);
    expect(currentWord().id).toBe(getKataState().words[1].id);
  });

  it('enters VICTORY after the last word', () => {
    prepareSession([{ id: 'a', word: 'api', enabled: true }, { id: 'b', word: 'bola', enabled: true }], settings, seqRng);
    loadCurrentWord();
    advanceWord(); // word 0 done
    advanceWord(); // word 1 done
    expect(getKataState().phase).toBe('VICTORY');
  });
});