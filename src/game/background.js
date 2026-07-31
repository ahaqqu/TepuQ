import { SLIDE_DIRECTIONS } from '../config.js';

export function applyBackground(elBgEffects, styleName) {
  elBgEffects.innerHTML = '';
  elBgEffects.className = 'bg-layer';
  const style = styleName || 'combined';
  const active = style === 'combined' ? ['gradient-flow', 'floating-bubbles'] : [style];

  if (active.includes('floating-bubbles')) {
    for (let i = 0; i < 18; i++) {
      const b = document.createElement('div');
      b.className = 'bubble';
      const size = 3 + Math.random() * 10;
      b.style.width = size + 'vmin';
      b.style.height = size + 'vmin';
      b.style.left = Math.random() * 100 + 'vw';
      b.style.animationDuration = (8 + Math.random() * 12) + 's';
      b.style.animationDelay = (-Math.random() * 15) + 's';
      elBgEffects.appendChild(b);
    }
  }
  if (active.includes('confetti-rain')) {
    elBgEffects.classList.add('bg-confetti');
    for (let i = 0; i < 40; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.animationDuration = (4 + Math.random() * 6) + 's';
      c.style.animationDelay = (-Math.random() * 8) + 's';
      c.style.color = `hsl(${Math.random() * 360},80%,60%)`;
      elBgEffects.appendChild(c);
    }
  }
  if (active.includes('twinkle-stars')) {
    elBgEffects.classList.add('bg-twinkle');
    for (let i = 0; i < 50; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      s.style.left = Math.random() * 100 + 'vw';
      s.style.top = Math.random() * 100 + 'vh';
      s.style.animationDelay = (Math.random() * 2) + 's';
      elBgEffects.appendChild(s);
    }
  }
}

export function applyCardSize(cardSize) {
  const map = { small: '40vmin', medium: '55vmin', large: '70vmin' };
  document.documentElement.style.setProperty('--card-size', map[cardSize] || map.medium);
}
