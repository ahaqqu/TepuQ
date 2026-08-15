import { describe, it, expect } from 'vitest';
import { mergeImportedWords, normalizeWordText } from '@/kata-admin/merge-words.js';

const starters = [
  { id: 'kata_001', word: 'mama', category: 'keluarga', order: 0, enabled: true, audioBlob: null, useRecording: false, audioType: 'tts', source: 'starter' },
  { id: 'kata_002', word: 'papa', category: 'keluarga', order: 1, enabled: true, audioBlob: null, useRecording: false, audioType: 'tts', source: 'starter' },
];

describe('normalizeWordText', () => {
  it('lowercases and trims', () => {
    expect(normalizeWordText('  Mama ')).toBe('mama');
  });
});

describe('mergeImportedWords', () => {
  it('overrides an existing starter word with a matching imported custom word', () => {
    const imported = [{ id: 'kata_001', word: 'mama', category: 'custom-cat', order: 5, enabled: true, audioBlob: null, useRecording: false, audioType: 'tts', source: 'custom' }];
    const merged = mergeImportedWords(starters, imported);
    const mama = merged.find((w) => w.id === 'kata_001');
    expect(mama.category).toBe('custom-cat');
    expect(mama.source).toBe('custom');
    expect(mama.order).toBe(5);
  });

  it('matches by word text when id differs', () => {
    const imported = [{ id: 'kata_999', word: 'mama', category: 'new', order: 2, enabled: true, audioBlob: null, useRecording: false, audioType: 'tts', source: 'custom' }];
    const merged = mergeImportedWords(starters, imported);
    // The imported word matches the starter 'mama' by text, so it overrides
    // rather than adding a duplicate.
    const mamas = merged.filter((w) => normalizeWordText(w.word) === 'mama');
    expect(mamas).toHaveLength(1);
    expect(mamas[0].category).toBe('new');
  });

  it('adds a brand-new word that does not match any existing one', () => {
    const imported = [{ id: 'kata_100', word: 'bola', category: 'benda', order: 2, enabled: true, audioBlob: null, useRecording: false, audioType: 'tts', source: 'custom' }];
    const merged = mergeImportedWords(starters, imported);
    expect(merged).toHaveLength(3);
    expect(merged.some((w) => w.word === 'bola')).toBe(true);
  });

  it('preserves starter words that are not in the import', () => {
    const merged = mergeImportedWords(starters, []);
    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe('starter');
  });
});