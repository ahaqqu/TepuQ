import { buildDemoCard } from './card.js';

let demoTimer = null;

export function startDemoCards(objects, settings) {
  stopDemoCards();
  const active = objects.filter((o) => o.active);
  if (active.length === 0) return;

  const elModePicker = document.getElementById('modePicker');
  const game = document.getElementById('game');

  const showDemo = () => {
    if (elModePicker.classList.contains('hidden')) return;
    const obj = active[Math.floor(Math.random() * active.length)];
    const card = buildDemoCard(obj, settings);
    game.appendChild(card);
    setTimeout(() => {
      card.animate(
        [{ opacity: 0.75, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.6)' }],
        { duration: 500, easing: 'ease-in' }
      ).onfinish = () => card.remove();
    }, 1600);
    demoTimer = setTimeout(showDemo, 900 + Math.random() * 700);
  };

  showDemo();
}

export function stopDemoCards() {
  if (demoTimer) clearTimeout(demoTimer);
  demoTimer = null;
  document.querySelectorAll('.demo-card').forEach((c) => c.remove());
}
