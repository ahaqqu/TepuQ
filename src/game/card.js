import {
  getImageAspectRatio,
  fitAspectRatio,
  parseCardSize,
  getPlaceholder,
  revokeObjectURLs,
} from '../utils.js';
import { resolveEntryAnimation, addEntryAnimationClasses } from './animations.js';

const objectURLs = [];

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    revokeObjectURLs(objectURLs);
  });
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

  const hasImage = !!obj.imageBlob;
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

export async function positionAndPopulateCard(card, obj) {
  let rectSize = parseCardSize();
  if (obj.imageBlob) {
    const aspect = await getImageAspectRatio(obj.imageBlob);
    if (aspect > 0) {
      const base = Math.min(rectSize.width, rectSize.height);
      rectSize = fitAspectRatio(aspect, base);
    }
  }
  const maxLeft = Math.max(0, window.innerWidth - rectSize.width);
  const maxTop = Math.max(0, window.innerHeight - rectSize.height);
  const pad = 16;
  const left = pad + Math.random() * Math.max(0, maxLeft - pad * 2);
  const top = pad + Math.random() * Math.max(0, maxTop - pad * 2);
  card.style.left = left + 'px';
  card.style.top = top + 'px';
  card.style.setProperty('--card-color', obj.color || '#4A90D9');

  if (obj.imageBlob) {
    const imgSrc = URL.createObjectURL(obj.imageBlob);
    objectURLs.push(imgSrc);
    card.style.background = obj.color || '#4A90D9';
    card.style.width = rectSize.width + 'px';
    card.style.height = rectSize.height + 'px';
    card.innerHTML = `<img src="${imgSrc}" alt="${escapeAttr(obj.name)}" draggable="false" style="max-width:100%;max-height:100%;object-fit:contain;pointer-events:none;display:block;">`;
  } else {
    card.style.background = obj.color || '#4A90D9';
    card.style.width = rectSize.width + 'px';
    card.style.height = rectSize.height + 'px';
    card.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1vmin;width:100%;height:100%;padding:3vmin;text-align:center;">
        <span style="font-size:16vmin;font-weight:800;color:rgba(255,255,255,0.95);text-shadow:0 0.5vmin 1.5vmin rgba(0,0,0,0.2);">${(obj.name || '?').charAt(0).toUpperCase()}</span>
        <span style="font-size:5vmin;font-weight:700;color:rgba(255,255,255,0.95);text-shadow:0 0.3vmin 0.8vmin rgba(0,0,0,0.2);">${escapeHtml(obj.name || '')}</span>
      </div>`;
  }
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
  const hasImage = !!obj.imageBlob;
  el.style.border = hasImage ? 'none' : 'var(--card-border) solid ' + (obj.color || '#4A90D9');
}

export function buildDemoCard(obj, settings = {}) {
  const card = document.createElement('div');
  card.className = 'demo-card';
  card.style.border = obj.imageBlob ? 'none' : 'var(--card-border) solid ' + (obj.color || '#4A90D9');
  card.style.setProperty('--card-color', obj.color || '#4A90D9');
  card.style.width = 'var(--card-size)';
  card.style.height = 'var(--card-size)';
  positionAndPopulateCard(card, obj);

  const anim = resolveEntryAnimation(obj, settings);
  addEntryAnimationClasses(card, anim);
  return card;
}
