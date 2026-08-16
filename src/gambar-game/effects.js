const PALETTE = ['#ffd93d', '#ff6b6b', '#4ecdc4', '#ff9a3c', '#ffffff'];

export function createParticles(elParticles, card, color, x, y) {
  const rect = card.getBoundingClientRect();
  const cx = x ?? rect.left + rect.width / 2;
  const cy = y ?? rect.top + rect.height / 2;
  const colors = [color || '#fff', ...PALETTE];

  for (let i = 0; i < 32; i++) {
    const p = document.createElement('div');
    const roll = Math.random();
    p.className = 'particle' + (roll < 0.3 ? ' particle-star' : roll < 0.55 ? ' particle-square' : '');
    p.style.background = colors[i % colors.length];
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    elParticles.appendChild(p);
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 150;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    p.animate(
      [
        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.15) rotate(${Math.random() * 360}deg)`, opacity: 0 },
      ],
      { duration: 500 + Math.random() * 350, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    ).onfinish = () => p.remove();
  }

  const ring = document.createElement('div');
  ring.className = 'effect-ring';
  ring.style.left = cx + 'px';
  ring.style.top = cy + 'px';
  ring.style.borderColor = color || '#fff';
  elParticles.appendChild(ring);
  ring.animate(
    [
      { transform: 'translate(-50%,-50%) scale(0.15)', opacity: 0.9 },
      { transform: 'translate(-50%,-50%) scale(2.4)', opacity: 0 },
    ],
    { duration: 600, easing: 'ease-out' }
  ).onfinish = () => ring.remove();

  const flash = document.createElement('div');
  flash.className = 'effect-flash';
  flash.style.left = cx + 'px';
  flash.style.top = cy + 'px';
  flash.style.background = color || '#fff';
  elParticles.appendChild(flash);
  flash.animate(
    [
      { transform: 'translate(-50%,-50%) scale(0.6)', opacity: 0.9 },
      { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 },
    ],
    { duration: 250, easing: 'ease-out' }
  ).onfinish = () => flash.remove();
}

export function thumpCard(card) {
  if (!card) return;
  card.classList.remove('thump');
  void card.offsetWidth;
  card.classList.add('thump');
}

export function hintCard(card) {
  const target = card || document.querySelector('.card-pop') || document.getElementById('card');
  if (!target) return;
  target.classList.remove('hint-wobble');
  void target.offsetWidth;
  target.classList.add('hint-wobble');
}
