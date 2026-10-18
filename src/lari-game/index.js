// TepuQ Lari entry point: mounts the 3D runner into #lariStage and exposes
// initLari()/destroyLari() to the app router (src/game-picker.js).
// See ADR 0002 (multi-game shell) and ADR 0004 (same Pages deploy).

import './styles.css';
import { LARI_MARKUP } from './markup.js';
import { createLariGame } from './game.js';

let game = null;

function onBackToMenu() {
  window.dispatchEvent(new CustomEvent('tepuq:lari-back-to-menu'));
}

export function initLari() {
  const stage = document.getElementById('lariStage');
  if (!stage) return;
  if (game) destroyLari();

  stage.classList.remove('hidden');
  stage.innerHTML = LARI_MARKUP;

  // Every "‹ Pilih Game" control (start / pause / game-over) leaves the game.
  // Quit/home are also wired inside game.js to reset state before leaving.
  stage.querySelectorAll('[data-lari-menu]').forEach((btn) => {
    btn.addEventListener('click', onBackToMenu);
  });

  game = createLariGame();
}

export function destroyLari() {
  if (game) {
    try { game.destroy(); } catch (err) { console.error(err); }
    game = null;
  }
  const stage = document.getElementById('lariStage');
  if (stage) {
    stage.classList.add('hidden');
    stage.innerHTML = '';
  }
}

export function isLariRunning() {
  return game != null;
}
