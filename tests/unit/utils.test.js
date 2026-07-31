import { describe, it, expect } from 'vitest';
import { escapeHtml, extFromBlob, fitAspectRatio, normalizeKey, keyStringToBindings } from '@/utils.js';

describe('escapeHtml', () => {
  it('escapes special characters', () => {
    expect(escapeHtml('<div>Tom & Jerry\'s "stuff" &amp;</div>')).toBe(
      '&lt;div&gt;Tom &amp; Jerry&#39;s &quot;stuff&quot; &amp;amp;&lt;/div&gt;'
    );
  });
});

describe('extFromBlob', () => {
  it('detects common image types', () => {
    expect(extFromBlob({ type: 'image/png' })).toBe('png');
    expect(extFromBlob({ type: 'image/jpeg' })).toBe('jpg');
    expect(extFromBlob({ type: 'image/webp' })).toBe('webp');
  });

  it('returns empty for unknown blob type', () => {
    expect(extFromBlob({ type: 'application/json' })).toBe('');
  });
});

describe('fitAspectRatio', () => {
  it('keeps square for aspect 1', () => {
    expect(fitAspectRatio(1, 100)).toEqual({ width: 100, height: 100 });
  });

  it('grows width for wide images', () => {
    expect(fitAspectRatio(2, 100)).toEqual({ width: 100, height: 50 });
  });

  it('grows height for tall images', () => {
    expect(fitAspectRatio(0.5, 100)).toEqual({ width: 50, height: 100 });
  });
});

describe('key helpers', () => {
  it('normalizes keys to lowercase', () => {
    expect(normalizeKey('P')).toBe('p');
    expect(normalizeKey(' Enter ')).toBe('enter');
  });

  it('splits key input into bindings', () => {
    expect(keyStringToBindings('p, q r')).toEqual(['p', 'q', 'r']);
  });
});
