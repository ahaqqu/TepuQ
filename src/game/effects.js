export function createParticles(elParticles, card, color) {
  const rect = card.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.background = color || '#fff';
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    elParticles.appendChild(p);
    const angle = (Math.PI * 2 * i) / 24;
    const dist = 60 + Math.random() * 100;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    p.animate(
      [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }],
      { duration: 600 + Math.random() * 200, easing: 'ease-out' }
    ).onfinish = () => p.remove();
  }
}

export function hintCard(card) {
  const target = card || document.querySelector('.card-pop') || document.getElementById('card');
  if (!target) return;
  target.classList.remove('hint-wobble');
  void target.offsetWidth;
  target.classList.add('hint-wobble');
}
