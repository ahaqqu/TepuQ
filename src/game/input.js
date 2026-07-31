import { applyBackground, applyCardSize } from './background.js';
import { buildDemoCard } from './card.js';
import { handleSuccess, handleTargetSuccess, resetGameState, getState, setState, resetAutoSmash, stopAutoSmash } from './logic.js';
import { initSpeech } from '../speech.js';
import { hintCard } from './effects.js';

let appState = null;
let demoTimer = null;

export function initGame(state) {
  appState = state;
  resetGameState();
  applyBackground(document.getElementById('bgEffects'), state.settings.backgroundStyle);
  applyCardSize(state.settings.cardSize);
  setState({ currentMode: null });
  return setupModeSelection();
}

export function showModePicker() {
  if (!appState) return;
  stopAutoSmash();
  const elModePicker = document.getElementById('modePicker');
  const elCard = document.getElementById('card');
  elCard.className = 'hidden';
  document.querySelectorAll('.card-pop').forEach((c) => c.remove());
  elModePicker.classList.remove('hidden');
  setState({ currentMode: null });
  sessionStorage.removeItem('tepuq-mode');
  const enabled = appState.settings.enabledModes || ['bebas', 'target'];
  const btnBebas = document.getElementById('btnBebas');
  const btnTarget = document.getElementById('btnTarget');
  btnBebas.onclick = () => startMode('bebas');
  btnTarget.onclick = () => startMode('target');
  btnBebas.classList.toggle('hidden', enabled.length === 1 && !enabled.includes('bebas'));
  btnTarget.classList.toggle('hidden', enabled.length === 1 && !enabled.includes('target'));
  startDemoCards();
}

async function setupModeSelection() {
  const enabled = appState.settings.enabledModes || ['bebas', 'target'];
  const saved = sessionStorage.getItem('tepuq-mode');

  if (saved && enabled.includes(saved)) {
    await startMode(saved);
    return;
  }

  showModePicker();
  if (enabled.length === 1) {
    await startMode(enabled[0]);
  }
}

export async function startMode(mode) {
  if (!appState) return;
  setState({ currentMode: mode });
  sessionStorage.setItem('tepuq-mode', mode);
  document.getElementById('modePicker').classList.add('hidden');
  stopDemoCards();

  const active = appState.objects.filter((o) => o.active);
  if (active.length === 0) {
    document.getElementById('emptyState').classList.remove('hidden');
    return;
  }

  const first = active[0];
  setState({ currentObjectId: first.id });
  document.getElementById('emptyState').classList.add('hidden');

  if (mode === 'target') {
    handleTargetSuccess(appState.objects, appState.settings, document.getElementById('particles'));
  }
  resetAutoSmash(appState.objects, appState.settings);
}

function startDemoCards() {
  stopDemoCards();
  const active = appState.objects.filter((o) => o.active);
  if (active.length === 0) return;

  const elModePicker = document.getElementById('modePicker');
  const game = document.getElementById('game');

  const showDemo = () => {
    if (elModePicker.classList.contains('hidden')) return;
    const obj = active[Math.floor(Math.random() * active.length)];
    const card = buildDemoCard(obj, appState.settings);
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

function stopDemoCards() {
  if (demoTimer) clearTimeout(demoTimer);
  demoTimer = null;
  document.querySelectorAll('.demo-card').forEach((c) => c.remove());
}

export function bindGameInput() {
  document.addEventListener('keydown', onKeyDown, { passive: false });
  document.addEventListener('pointerdown', onPointerDown, { passive: false });
  document.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  bindBackTrigger();
}

function onKeyDown(e) {
  if (document.body.classList.contains('admin')) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    showModePicker();
    return;
  }
  e.preventDefault();
  if (!appState) return;
  if (getCurrentMode() === 'target') {
    handleTargetSuccess(appState.objects, appState.settings, document.getElementById('particles'));
  } else {
    handleSuccess('keyboard', appState.objects, appState.settings, document.getElementById('particles'), e.key);
  }
}

function onTouchStart(e) {
  if (document.body.classList.contains('admin')) return;
  e.preventDefault();
  if (!appState) return;
  const modePicker = document.getElementById('modePicker');
  if (!modePicker.classList.contains('hidden')) return;

  const targetCard = document.querySelector('.card-pop.target-card');
  const card = targetCard || document.getElementById('card');
  const isCard = e.target === card || card?.contains(e.target);

  if (getCurrentMode() === 'target') {
    if (!isCard) {
      hintCard(card);
      return;
    }
    handleTargetSuccess(appState.objects, appState.settings, document.getElementById('particles'));
    return;
  }

  handleSuccess('touch', appState.objects, appState.settings, document.getElementById('particles'));
}

function onPointerDown(e) {
  if (document.body.classList.contains('admin')) return;
  if (e.target.id === 'backTrigger') return;

  const modeBtn = e.target.closest('.mode-btn');
  if (modeBtn) {
    e.preventDefault();
    if (modeBtn.id === 'btnBebas') startMode('bebas');
    if (modeBtn.id === 'btnTarget') startMode('target');
    return;
  }

  const modePicker = document.getElementById('modePicker');
  if (!modePicker.classList.contains('hidden')) return;

  e.preventDefault();
  if (!appState) return;

  const clickedCard = document.querySelector('.card-pop.target-card') || document.getElementById('card');
  const isCard = e.target === clickedCard || clickedCard?.contains(e.target);

  if (getCurrentMode() === 'target') {
    if (!isCard) {
      hintCard(clickedCard);
      return;
    }
    handleTargetSuccess(appState.objects, appState.settings, document.getElementById('particles'));
    return;
  }

  handleSuccess('pointer', appState.objects, appState.settings, document.getElementById('particles'));
}

function bindBackTrigger() {
  const trigger = document.getElementById('backTrigger');
  const hint = document.getElementById('backHint');
  let timer = null;
  let hintTimer = null;

  const showHint = () => {
    hint.classList.add('show');
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('show'), 2000);
  };

  const start = (e) => {
    e.preventDefault();
    timer = setTimeout(() => {
      timer = null;
      showModePicker();
    }, 1500);
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  trigger.addEventListener('pointerdown', start);
  trigger.addEventListener('pointerup', cancel);
  trigger.addEventListener('pointerleave', cancel);
  trigger.addEventListener('pointercancel', cancel);
  trigger.addEventListener('touchstart', start, { passive: false });
  trigger.addEventListener('touchend', cancel);
  trigger.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') showHint();
  });
}

function getCurrentMode() {
  return getState().currentMode;
}
