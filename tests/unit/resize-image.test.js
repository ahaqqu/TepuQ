import { describe, it, expect } from 'vitest';
import { resizeImage } from '@/utils.js';

describe('resizeImage', () => {
  it('is exported as a function', () => {
    expect(typeof resizeImage).toBe('function');
  });

  it('rejects non-image blobs', async () => {
    const textBlob = new Blob(['not an image'], { type: 'text/plain' });
    await expect(resizeImage(textBlob)).rejects.toThrow();
  });

  it('rejects when blob is missing', async () => {
    await expect(resizeImage(null)).rejects.toThrow();
  });
});
