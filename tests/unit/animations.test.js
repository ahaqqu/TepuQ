import { describe, it, expect } from 'vitest';
import { resolveEntryAnimation, resolveExitAnimation } from '@/gambar-game/animations.js';
import { ENTRY_ANIMATIONS, EXIT_ANIMATIONS } from '@/config.js';

describe('resolveEntryAnimation', () => {
  it('uses per-object override when set', () => {
    const obj = { animation: 'bounce' };
    expect(resolveEntryAnimation(obj, { globalEntryAnimation: 'pop' })).toBe('bounce');
  });

  it('falls back to global setting when object is random', () => {
    const obj = { animation: 'random' };
    expect(resolveEntryAnimation(obj, { globalEntryAnimation: 'flip' })).toBe('flip');
  });

  it('randomizes when no preference is set', () => {
    const result = resolveEntryAnimation({}, {});
    expect(ENTRY_ANIMATIONS).toContain(result);
  });
});

describe('resolveExitAnimation', () => {
  it('uses global setting when set', () => {
    expect(resolveExitAnimation({ globalExitAnimation: 'shrink' })).toBe('shrink');
  });

  it('randomizes when global is random', () => {
    const result = resolveExitAnimation({ globalExitAnimation: 'random' });
    expect(EXIT_ANIMATIONS).toContain(result);
  });
});
