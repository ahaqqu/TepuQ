import { applyBackground, applyCardSize } from './background.js';
import { startDemoCards, stopDemoCards } from './demo.js';
import { handleSuccess, resetAutoSmash, stopAutoSmash } from './logic.js';
import { resetGameState, getState, setState } from './game-state.js';
import { speak, unlockSpeechForGameplay } from '../speech.js';
import { enterFullscreen, exitFullscreen, unlockPointer, onFullscreenChange, warnIfKioskBlocked } from './fullscreen.js';
import { revokeCardURL } from './card.js';

let appState = null;
let fsUnsubscribe = null;

export function initGame(state) {
  appState = state;
  resetGameState();
  applyBackground(document.getElementById('bgEffects'), state.settings.backgroundStyle);
  applyCardSize(state.settings.cardSize);
  setState({ currentMode: null });
  showKioskWarningOnce();
  return setupModeSelection();
}

export function showModePicker() {
  if (!appState) return;
  stopAutoSmash();
  if (fsUnsubscribe) {
    fsUnsubscribe();
    fsUnsubscribe = null;
  }
  unlockPointer();
  document.body.classList.remove('cursor-idle');
  updateExitHint();

  const elModePicker = document.getElementById('modePicker');
  const elCard = document.getElementById('card');
  elCard.className = 'hidden';
  document.querySelectorAll('.card-pop').forEach((c) => {
    revokeCardURL(c);
    c.remove();
  });
  elModePicker.classList.remove('hidden');
  setState({ currentMode: null });
  sessionStorage.removeItem('tepuq-mode');
  const enabled = appState.settings.enabledModes || ['bebas', 'target'];
  const btnBebas = document.getElementById('btnBebas');
  const btnTarget = document.getElementById('btnTarget');
  btnBebas.onclick = () => startMode('bebas');
  btnTarget.onclick = () => startMode('target');
  // Speak the mode intro only on hover-capable devices. On touch screens
  // pointerenter fires BEFORE the user gesture, so iOS Safari silently drops
  // the utterance (and it would double-speak when a mode is started).
  if (window.matchMedia('(hover: hover)').matches) {
    btnBebas.onpointerenter = () => speak('Main TepuQ Bebas yuk', appState.settings);
    btnTarget.onpointerenter = () => speak('Ayo main TepuQ Target bersamaku', appState.settings);
  }
  btnBebas.classList.toggle('hidden', enabled.length === 1 && !enabled.includes('bebas'));
  btnTarget.classList.toggle('hidden', enabled.length === 1 && !enabled.includes('target'));
  startDemoCards(appState.objects, appState.settings);
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

function showModePickerSafe() {
  unlockPointer();
  exitFullscreen().finally(showModePicker);
}

export async function startMode(mode) {
  if (!appState) return;
  unlockSpeechForGameplay();
  resetGameState();
  setState({ currentMode: mode });
  sessionStorage.setItem('tepuq-mode', mode);
  document.getElementById('modePicker').classList.add('hidden');
  stopDemoCards();

  const active = appState.objects.filter((o) => o.active);
  if (active.length === 0) {
    document.getElementById('emptyState').classList.remove('hidden');
    return;
  }

  document.getElementById('emptyState').classList.add('hidden');

  if (appState.settings.fullscreen !== false) {
    enterKiosk().catch(() => {});
  }
  fsUnsubscribe = onFullscreenChange(async (active) => {
    if (!active && getCurrentMode() !== null) {
      showModePicker();
    }
  });

  if (mode === 'target') {
    handleSuccess('mode-start', appState.objects, appState.settings, document.getElementById('particles'));
  }
  resetAutoSmash(appState.objects, appState.settings);
}

async function enterKiosk() {
  await enterFullscreen();
}

function showKioskWarningOnce() {
  const warning = warnIfKioskBlocked();
  if (warning && !sessionStorage.getItem('tepuq-fs-warned')) {
    sessionStorage.setItem('tepuq-fs-warned', '1');
    // eslint-disable-next-line no-console
    console.warn('TepuQ:', warning);
  }
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function updateExitHint() {
  const hint = document.getElementById('fsExitHint');
  if (!hint) return;
  hint.classList.toggle('show', isFullscreen());
}

export function getCurrentMode() {
  return getState().currentMode;
}

export function getAppState() {
  return appState;
}
