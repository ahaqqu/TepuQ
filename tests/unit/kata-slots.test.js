import { describe, it, expect } from 'vitest';
import { buildSlots, scatterLetters, findSnapSlot, distance } from '@/kata-game/slots.js';

describe('buildSlots', () => {
  it('builds one slot per letter in order', () => {
    const slots = buildSlots('are');
    expect(slots).toEqual([
      { index: 0, letter: 'a' },
      { index: 1, letter: 'r' },
      { index: 2, letter: 'e' },
    ]);
  });

  it('keeps duplicate letters as distinct slots distinguished by position', () => {
    const slots = buildSlots('mama');
    expect(slots.map((s) => s.letter)).toEqual(['m', 'a', 'm', 'a']);
    expect(slots.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it('lowercases the word', () => {
    expect(buildSlots('MAMA').map((s) => s.letter)).toEqual(['m', 'a', 'm', 'a']);
  });

  it('handles an empty word', () => {
    expect(buildSlots('')).toEqual([]);
  });
});

describe('scatterLetters', () => {
  it('produces one position per letter', () => {
    const rng = () => 0.5;
    const area = { width: 600, height: 400 };
    const positions = scatterLetters('are', area, 90, rng);
    expect(positions).toHaveLength(3);
  });

  it('keeps positions within the bounded area', () => {
    const rng = () => 0.9;
    const area = { width: 500, height: 300 };
    const positions = scatterLetters('kucing', area, 90, rng);
    positions.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(area.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(area.height);
    });
  });

  it('returns positions in tile order', () => {
    const rng = () => 0.3;
    const area = { width: 600, height: 400 };
    const positions = scatterLetters('bola', area, 90, rng);
    expect(positions).toHaveLength(4);
    positions.forEach((p) => {
      expect(p).toHaveProperty('x');
      expect(p).toHaveProperty('y');
    });
  });

  it('never fully overlaps tiles, even for long words in a short area', () => {
    // The photo layout gives the scatter area a short vertical range; a long
    // word must still scatter with every tile staying inside the area and its
    // center never covered by another tile's box (distance >= tileSize/2), so
    // no letter is ever hidden behind another.
    const area = { width: 900, height: 334 };
    const tileSize = 110;
    for (let trial = 0; trial < 500; trial++) {
      const positions = scatterLetters('kucing', area, tileSize, Math.random);
      positions.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(area.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(area.height);
      });
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          expect(distance(positions[i], positions[j])).toBeGreaterThanOrEqual(tileSize / 2);
        }
      }
    }
  });

  it('grid-first mode keeps every tile inside a tight area without overlap', () => {
    // A phone-sized scatter area above the photo: 6 letters must stay inside
    // the bounds and stay tappable (no overlap).
    const area = { width: 359, height: 433 };
    const tileSize = 118;
    for (let trial = 0; trial < 50; trial++) {
      const positions = scatterLetters('pisang', area, tileSize, Math.random, { gridFirst: true });
      positions.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(area.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(area.height);
      });
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          expect(distance(positions[i], positions[j])).toBeGreaterThanOrEqual(tileSize);
        }
      }
    }
  });

  it('returns positions in shuffled tile order in grid-first mode', () => {
    const rng = () => 0.5;
    const area = { width: 360, height: 440 };
    const positions = scatterLetters('bola', area, 110, rng, { gridFirst: true });
    expect(positions).toHaveLength(4);
    positions.forEach((p) => {
      expect(p).toHaveProperty('x');
      expect(p).toHaveProperty('y');
    });
  });
});

describe('findSnapSlot', () => {
  const slots = [
    { index: 0, letter: 'm', center: { x: 100, y: 100 }, filled: false },
    { index: 1, letter: 'a', center: { x: 200, y: 100 }, filled: false },
    { index: 2, letter: 'm', center: { x: 300, y: 100 }, filled: false },
    { index: 3, letter: 'a', center: { x: 400, y: 100 }, filled: false },
  ];

  it('snaps to the nearest unfilled matching slot within the snap distance', () => {
    // 'm' tile near slot 2 (x=300) — closer than slot 0 (x=100).
    const result = findSnapSlot('m', { x: 290, y: 100 }, slots, 60);
    expect(result).toBe(2);
  });

  it('handles duplicate letters by nearest unfilled position', () => {
    // 'a' tile near slot 1 (x=200).
    expect(findSnapSlot('a', { x: 210, y: 100 }, slots, 60)).toBe(1);
  });

  it('returns null when no matching slot is within snap distance', () => {
    expect(findSnapSlot('m', { x: 500, y: 100 }, slots, 60)).toBeNull();
  });

  it('returns null for a letter that does not appear in any slot', () => {
    expect(findSnapSlot('z', { x: 100, y: 100 }, slots, 60)).toBeNull();
  });

  it('skips already-filled slots', () => {
    const filledSlots = slots.map((s) => (s.index === 2 ? { ...s, filled: true } : s));
    // 'm' near slot 0 (x=100) snaps to slot 0; slot 2 (x=300) is filled and skipped.
    expect(findSnapSlot('m', { x: 110, y: 100 }, filledSlots, 60)).toBe(0);
  });
});

describe('distance', () => {
  it('computes Euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});