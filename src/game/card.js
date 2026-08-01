import {
  parseCardSize,
  revokeObjectURLs,
} from '../utils.js';
import { resolveEntryAnimation, addEntryAnimationClasses } from './animations.js';

const objectURLs = [];
const imageAspectCache = new Map();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    revokeObjectURLs(objectURLs);
  });
}

function cacheKeyForSource(source) {
  if (source instanceof Blob) return `blob:${source.size}:${source.type}`;
  return String(source);
}

function getCachedAspect(source) {
  return imageAspectCache.get(cacheKeyForSource(source)) || 0;
}

function setCachedAspect(source, aspect) {
  imageAspectCache.set(cacheKeyForSource(source), aspect);
}

function measureImageAspect(source) {
  return new Promise((resolve) => {
    if (!source) { resolve(0); return; }
    const img = new Image();
    let url = null;
    if (source instanceof Blob) {
      url = URL.createObjectURL(source);
      img.src = url;
    } else {
      img.src = source;
    }
    img.onload = () => {
      if (url) URL.revokeObjectURL(url);
      resolve(img.naturalWidth / img.naturalHeight || 1);
    };
    img.onerror = () => {
      if (url) URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

function fitImageToBounds(aspect, maxWidth, maxHeight) {
  let width = maxHeight * aspect;
  let height = maxHeight;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspect;
  }
  return { width, height };
}

export function clearPopCards() {
  document.querySelectorAll('.card-pop').forEach((c) => c.remove());
}

export function createCard(obj, settings = {}) {
  const card = document.createElement('div');
  card.className = 'card-pop';
  card.dataset.objectId = obj.id;
  card.style.position = 'absolute';
  card.style.borderRadius = '4vmin';
  card.style.boxShadow = 'var(--shadow)';
  card.style.display = 'flex';
  card.style.alignItems = 'center';
  card.style.justifyContent = 'center';
  card.style.overflow = 'hidden';
  card.style.zIndex = '10';
  card.style.pointerEvents = 'auto';
  card.style.setProperty('--card-color', obj.color || '#4A90D9');

  const sizeStyle = getComputedStyle(document.documentElement).getPropertyValue('--card-size');
  card.style.width = sizeStyle;
  card.style.height = sizeStyle;

  const hasImage = !!(obj.imageUrl || obj.imageBlob);
  if (hasImage) {
    card.style.border = 'none';
  } else {
    card.style.border = 'var(--card-border) solid ' + (obj.color || '#4A90D9');
  }

  positionAndPopulateCard(card, obj);

  const anim = resolveEntryAnimation(obj, settings);
  addEntryAnimationClasses(card, anim);
  card.addEventListener('animationend', () => {
    card.classList.remove('anim-' + anim);
    if (card.dataset.autoRemove) {
      const visibleMs = Math.max(0, Number(settings.cardVisibleSeconds) || 0) * 1000;
      const fadeOut = () => {
        card.animate(
          [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.6)' }],
          { duration: 400, easing: 'ease-in' }
        ).onfinish = () => card.remove();
      };
      if (visibleMs > 0) {
        setTimeout(fadeOut, visibleMs);
      } else {
        fadeOut();
      }
    }
  }, { once: true });

  return card;
}

export function positionAndPopulateCard(card, obj) {
  const rectSize = parseCardSize();
  const imageSource = obj.imageUrl || obj.imageBlob;
  const hasImage = !!imageSource;
  const pad = 16;
  const maxCardWidth = Math.min(rectSize.width, window.innerWidth - pad * 2);
  const maxCardHeight = Math.min(rectSize.height, window.innerHeight - pad * 2);

  function applySize(width, height) {
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - height);
    const left = pad + Math.random() * Math.max(0, maxLeft - pad * 2);
    const top = pad + Math.random() * Math.max(0, maxTop - pad * 2);
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.width = width + 'px';
    card.style.height = height + 'px';
  }

  card.style.setProperty('--card-color', obj.color || '#4A90D9');

  if (hasImage) {
    let width = maxCardWidth;
    let height = maxCardHeight;
    const aspect = getCachedAspect(imageSource);
    if (aspect > 0) {
      const fitted = fitImageToBounds(aspect, maxCardWidth, maxCardHeight);
      width = fitted.width;
      height = fitted.height;
    }
    applySize(width, height);
    card.style.background = 'transparent';

    const safeBlob = obj.imageBlob ? normalizeImageBlob(obj.imageBlob) : null;
    const imgSrc = safeBlob ? URL.createObjectURL(safeBlob) : obj.imageUrl;
    if (safeBlob) objectURLs.push(imgSrc);

    card.innerHTML = `<img src="${escapeAttr(imgSrc)}" alt="${escapeAttr(obj.name)}" draggable="false" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:contain;pointer-events:none;display:block;">`;

    if (!aspect) {
      measureImageAspect(imageSource).then((measured) => {
        if (!measured || !card.isConnected) return;
        setCachedAspect(imageSource, measured);
        const fitted = fitImageToBounds(measured, maxCardWidth, maxCardHeight);
        applySize(fitted.width, fitted.height);
      });
    }
  } else {
    applySize(maxCardWidth, maxCardHeight);
    card.style.background = obj.color || '#4A90D9';
    card.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1vmin;width:100%;height:100%;padding:3vmin;text-align:center;">
        <span style="font-size:16vmin;font-weight:800;color:rgba(255,255,255,0.95);text-shadow:0 0.5vmin 1.5vmin rgba(0,0,0,0.2);">${(obj.name || '?').charAt(0).toUpperCase()}</span>
        <span style="font-size:5vmin;font-weight:700;color:rgba(255,255,255,0.95);text-shadow:0 0.3vmin 0.8vmin rgba(0,0,0,0.2);">${escapeHtml(obj.name || '')}</span>
      </div>`;
  }
}

function normalizeImageBlob(blob) {
  if (!blob) return blob;
  const type = blob.type || '';
  if (type === 'image/jpg' || type === '') {
    return new Blob([blob], { type: 'image/jpeg' });
  }
  return blob;
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(str) {
  return (str || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function renderStaticCard(el, obj) {
  if (!el) return;
  positionAndPopulateCard(el, obj);
  const hasImage = !!(obj.imageUrl || obj.imageBlob);
  el.style.border = hasImage ? 'none' : 'var(--card-border) solid ' + (obj.color || '#4A90D9');
}

export function buildDemoCard(obj, settings = {}) {
  const card = document.createElement('div');
  card.className = 'demo-card';
  card.style.border = (obj.imageUrl || obj.imageBlob) ? 'none' : 'var(--card-border) solid ' + (obj.color || '#4A90D9');
  card.style.setProperty('--card-color', obj.color || '#4A90D9');
  card.style.width = 'var(--card-size)';
  card.style.height = 'var(--card-size)';
  positionAndPopulateCard(card, obj);

  const anim = resolveEntryAnimation(obj, settings);
  addEntryAnimationClasses(card, anim);
  return card;
}
