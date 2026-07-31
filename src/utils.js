export function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function extFromBlob(blob) {
  const t = blob?.type || '';
  if (t.includes('png')) return 'png';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('webp')) return 'webp';
  if (t.includes('webm')) return 'webm';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('mp4')) return 'mp4';
  return '';
}

export function blobExtFromFilename(filename) {
  if (!filename) return 'png';
  const m = filename.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : 'png';
}

const placeholderCache = {};

export function getPlaceholder(obj) {
  const key = obj?.id || obj?.name || '?';
  if (placeholderCache[key]) return placeholderCache[key];
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = obj?.color || '#4A90D9';
  roundRect(ctx, 0, 0, 512, 512, 60);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 180px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((obj?.name || '?').charAt(0).toUpperCase(), 256, 240);
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(obj?.name || '', 256, 380);
  const url = c.toDataURL('image/png');
  placeholderCache[key] = url;
  return url;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function placeholderToBlob(obj) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      c.toBlob(resolve, 'image/png');
    };
    img.src = getPlaceholder(obj);
  });
}

const MAX_IMAGE_SIZE = 800;

export function resizeImage(blob, maxSize = MAX_IMAGE_SIZE, outputType = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!blob || !blob.type.startsWith('image/')) {
      reject(new Error('File bukan gambar'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxSize || h > maxSize) {
        if (w > h) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        } else {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob((b) => {
        if (!b) reject(new Error('Gagal memproses gambar'));
        else resolve(b);
      }, outputType, quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal membaca gambar'));
    };
    img.src = url;
  });
}

export function getImageAspectRatio(blob) {
  return new Promise((resolve) => {
    if (!blob) { resolve(0); return; }
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth / img.naturalHeight || 1);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    img.src = url;
  });
}

export function fitAspectRatio(aspect, base) {
  let width, height;
  if (aspect >= 1) {
    width = base;
    height = base / aspect;
  } else {
    height = base;
    width = base * aspect;
  }
  return { width, height };
}

export function parseCardSize() {
  const style = getComputedStyle(document.documentElement);
  const val = style.getPropertyValue('--card-size').trim();
  const num = parseFloat(val);
  const unit = val.replace(num.toString(), '');
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const px = unit === 'vmin' ? (num / 100) * vmin : num;
  return { width: px, height: px };
}

export function normalizeKey(key) {
  if (!key) return '';
  return key.toString().trim().toLowerCase();
}

export function keyStringToBindings(str) {
  if (!str) return [];
  return str
    .split(/[,\s]+/)
    .map(s => normalizeKey(s))
    .filter(Boolean);
}

export function revokeObjectURLs(urls) {
  urls.forEach((u) => {
    try { URL.revokeObjectURL(u); } catch {}
  });
}

export function showToast(text, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = text;
  t.className = 'message ' + (isError ? 'error ' : '') + 'show';
  setTimeout(() => t.classList.remove('show'), 3000);
}
