import { describe, it, expect } from 'vitest';
import { buildSlots, scatterLetters, findSnapSlot, distance } from '@/kata/slots.js';

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