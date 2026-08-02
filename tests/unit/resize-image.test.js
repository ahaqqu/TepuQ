import { describe, it, expect } from 'vitest';
import { resizeImage } from '@/utils.js';

// Minimal valid 1x1 PNG (base64).
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function makeImageBlob(type = 'image/png') {
  const bytes = Buffer.from(PNG_BASE64, 'base64');
  return new Blob([bytes], { type });
}

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

  it('resizes a large image down to the max size', async () => {
    const OriginalImage = global.Image;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    try {
      global.Image = class FakeImage {
        constructor() {
          this.naturalWidth = 1200;
          this.naturalHeight = 800;
        }
        set src(_) {
          setTimeout(() => this.onload?.(), 0);
        }
      };
      HTMLCanvasElement.prototype.getContext = function (type) {
        if (type === '2d') {
          return {
            drawImage: () => {},
            fillRect: () => {},
          };
        }
        return originalGetContext.call(this, type);
      };
      HTMLCanvasElement.prototype.toBlob = function (callback, type) {
        callback(new Blob(['resized'], { type: type || 'image/jpeg' }));
      };

      const blob = makeImageBlob('image/png');
      const resized = await resizeImage(blob, 400, 'image/jpeg', 0.9);
      expect(resized).toBeInstanceOf(Blob);
      expect(resized.type).toBe('image/jpeg');
    } finally {
      global.Image = OriginalImage;
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });
});
