import { describe, it, expect } from 'vitest';
import { isStarterObjectUntouched, starterImageUrl } from '../../src/db.js';

const STARTER_PAPA = {
  name: 'Papa',
  color: '#4A90D9',
  image: '/assets/starter/papa.jpg',
  kataEnabled: true,
};

function starterObject(overrides = {}) {
  return {
    id: 'obj_001',
    name: 'Papa',
    ttsText: 'Papa',
    color: '#4A90D9',
    imageUrl: starterImageUrl(STARTER_PAPA),
    imageBlob: null,
    imageSource: 'starter',
    audioBlob: null,
    useRecording: false,
    keyBindings: [],
    active: true,
    kataEnabled: true,
    ...overrides,
  };
}

describe('starter object source reconciliation', () => {
  it('treats an unmodified starter object as untouched', () => {
    expect(isStarterObjectUntouched(starterObject(), STARTER_PAPA)).toBe(true);
  });

  it.each([
    ['name changed', { name: 'Ayah' }],
    ['tts text changed', { ttsText: 'Ini Ayah' }],
    ['color changed', { color: '#ff0000' }],
    ['image replaced', { imageBlob: new Blob(['x'], { type: 'image/jpeg' }) }],
    ['image source changed', { imageSource: 'custom' }],
    ['audio recorded', { audioBlob: new Blob(['x'], { type: 'audio/webm' }) }],
    ['recording enabled', { useRecording: true }],
    ['key bound', { keyBindings: ['p'] }],
    ['deactivated', { active: false }],
    ['kata toggle changed', { kataEnabled: false }],
  ])('treats an object with %s as customized', (_label, overrides) => {
    expect(isStarterObjectUntouched(starterObject(overrides), STARTER_PAPA)).toBe(false);
  });
});
