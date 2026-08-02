import { parseCardSize } from '../utils.js';
import { resolveEntryAnimation, addEntryAnimationClasses } from './animations.js';

const imageAspectCache = new Map();

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

function fitImageToBounds(aspect, maxWidth, maxHeight) {
  let width = maxHeight * aspect;
  let height = maxHeight;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspect;
  }
  return { width, height };
}

export function revokeCardURL(card) {
  if (!card) return;
  const url = card.dataset.objectUrl;
  if (url) {
    try { URL.revokeObjectURL(url); } catch {}
    delete card.dataset.objectUrl;
  }
}

export function clearPopCards() {
  document.querySelectorAll('.card-pop').forEach((c) => {
    revokeCardURL(c);
    c.remove();
  });
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

  const anim = resolveEntryAnimation(obj, settings);
  // For image cards whose aspect is not known yet, the card stays hidden
  // until the image loads and is sized, then the entry animation runs.
  const revealed = positionAndPopulateCard(card, obj, () => addEntryAnimationClasses(card, anim));
  if (revealed) addEntryAnimationClasses(card, anim);

  card.addEventListener('animationend', () => {
    card.classList.remove('anim-' + anim);
    if (card.dataset.autoRemove) {
      const visibleMs = Math.max(0, Number(settings.cardVisibleSeconds) || 0) * 1000;
      const fadeOut = () => {
        card.animate(
          [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.6)' }],
          { duration: 400, easing: 'ease-in' }
        ).onfinish = () => {
          revokeCardURL(card);
          card.remove();
        };
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

export function positionAndPopulateCard(card, obj, onReveal = null) {
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
    const aspect = getCachedAspect(imageSource);
    let usedAspect = 0;
    if (aspect > 0) {
      const fitted = fitImageToBounds(aspect, maxCardWidth, maxCardHeight);
      applySize(fitted.width, fitted.height);
      usedAspect = aspect;
    } else {
      // Aspect unknown: keep the card hidden until the image loads and the
      // card is sized, so no letterbox gap shows around the photo.
      applySize(maxCardWidth, maxCardHeight);
      card.style.visibility = 'hidden';
    }
    card.style.background = 'transparent';

    const safeBlob = obj.imageBlob ? normalizeImageBlob(obj.imageBlob) : null;
    const imgSrc = safeBlob ? URL.createObjectURL(safeBlob) : obj.imageUrl;
    if (safeBlob) card.dataset.objectUrl = imgSrc;

    const img = document.createElement('img');
    img.src = imgSrc;
    img.alt = obj.name || '';
    img.draggable = false;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.pointerEvents = 'none';
    img.style.display = 'block';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return;
      const measured = w / h;
      setCachedAspect(imageSource, measured);
      if (!card.isConnected) return;
      if (Math.abs(measured - usedAspect) > 0.001) {
        const fitted = fitImageToBounds(measured, maxCardWidth, maxCardHeight);
        applySize(fitted.width, fitted.height);
      }
      if (card.style.visibility === 'hidden') {
        card.style.visibility = 'visible';
        if (onReveal) onReveal();
      }
    };
    img.onerror = () => {
      img.style.display = 'none';
      if (card.style.visibility === 'hidden') {
        card.style.visibility = 'visible';
        if (onReveal) onReveal();
      }
    };
    card.appendChild(img);
  } else {
    applySize(maxCardWidth, maxCardHeight);
    card.style.background = obj.color || '#4A90D9';
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.gap = '1vmin';
    wrap.style.width = '100%';
    wrap.style.height = '100%';
    wrap.style.padding = '3vmin';
    wrap.style.textAlign = 'center';

    const big = document.createElement('span');
    big.style.fontSize = '16vmin';
    big.style.fontWeight = '800';
    big.style.color = 'rgba(255,255,255,0.95)';
    big.style.textShadow = '0 0.5vmin 1.5vmin rgba(0,0,0,0.2)';
    big.textContent = (obj.name || '?').charAt(0).toUpperCase();

    const small = document.createElement('span');
    small.style.fontSize = '5vmin';
    small.style.fontWeight = '700';
    small.style.color = 'rgba(255,255,255,0.95)';
    small.style.textShadow = '0 0.3vmin 0.8vmin rgba(0,0,0,0.2)';
    small.textContent = obj.name || '';

    wrap.append(big, small);
    card.appendChild(wrap);
  }

  return card.style.visibility !== 'hidden';
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

  const anim = resolveEntryAnimation(obj, settings);
  const revealed = positionAndPopulateCard(card, obj, () => addEntryAnimationClasses(card, anim));
  if (revealed) addEntryAnimationClasses(card, anim);
  return card;
}
