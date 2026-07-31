import { SLIDE_DIRECTIONS } from '../config.js';

const BALLOON_COLORS = ['#4CAF50', '#FFC107', '#B0BEC5', '#FF69B4', '#42A5F5'];

export function applyBackground(elBgEffects, styleName) {
  elBgEffects.innerHTML = '';
  elBgEffects.className = 'bg-layer';
  const style = styleName || 'combined';
  const active = style === 'combined' ? ['gradient-flow', 'floating-bubbles'] : [style];

  if (active.includes('gradient-flow')) {
    for (let i = 0; i < 10; i++) {
      const r = document.createElement('div');
      r.className = 'mini-rainbow';
      r.textContent = '🌈';
      r.style.left = (2 + Math.random() * 90) + 'vw';
      r.style.top = (4 + Math.random() * 80) + 'vh';
      r.style.fontSize = (3 + Math.random() * 3) + 'vmin';
      r.style.animationDuration = (4 + Math.random() * 3) + 's';
      r.style.animationDelay = (-Math.random() * 4) + 's';
      elBgEffects.appendChild(r);
    }
    for (let i = 0; i < 4; i++) {
      const b = document.createElement('div');
      b.className = 'blob';
      b.style.left = (8 + Math.random() * 80) + 'vw';
      b.style.top = (10 + Math.random() * 70) + 'vh';
      b.style.background = `hsla(${Math.floor(Math.random() * 360)},80%,65%,0.22)`;
      b.style.animationDuration = (14 + Math.random() * 12) + 's';
      b.style.animationDelay = (-Math.random() * 15) + 's';
      elBgEffects.appendChild(b);
    }
  }
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
    for (let i = 0; i < 10; i++) {
      const b = document.createElement('div');
      b.className = 'balloon';
      const size = 5 + Math.random() * 7;
      b.style.width = size + 'vmin';
      b.style.height = size + 'vmin';
      b.style.setProperty('--bal-color', BALLOON_COLORS[i % BALLOON_COLORS.length]);
      b.style.left = Math.random() * 100 + 'vw';
      b.style.animationDuration = (12 + Math.random() * 10) + 's';
      b.style.animationDelay = (-Math.random() * 18) + 's';
      b.innerHTML = '<span class="balloon-shine"></span>';
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
  if (style === 'combined') {
    const emojis = ['✨', '⭐', '🌈'];
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('div');
      s.className = 'sparkle';
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.top = Math.random() * 100 + 'vh';
      s.style.fontSize = (2 + Math.random() * 2.5) + 'vmin';
      s.style.animationDuration = (4 + Math.random() * 5) + 's';
      s.style.animationDelay = (-Math.random() * 6) + 's';
      elBgEffects.appendChild(s);
    }
  }
}

export function applyCardSize(cardSize) {
  const map = { small: '40vmin', medium: '55vmin', large: '70vmin' };
  document.documentElement.style.setProperty('--card-size', map[cardSize] || map.medium);
}
