import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '@/config.js';

describe('DEFAULT_SETTINGS', () => {
  it('contains expected default keys', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      backgroundStyle: 'combined',
      globalEntryAnimation: 'random',
      globalExitAnimation: 'random',
      cardSize: 'medium',
      playMode: 'round-robin',
      enabledModes: ['bebas', 'target'],
    });
  });

  it('has numeric ranges within expected bounds', () => {
    expect(DEFAULT_SETTINGS.burstWindow).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SETTINGS.cardVisibleSeconds).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SETTINGS.debounceMs).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SETTINGS.volume).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SETTINGS.volume).toBeLessThanOrEqual(1);
  });
});
