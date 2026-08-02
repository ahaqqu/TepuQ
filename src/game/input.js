import { applyBackground, applyCardSize } from './background.js';
import { buildDemoCard } from './card.js';
import { handleSuccess, handleTargetSuccess, resetGameState, getState, setState, resetAutoSmash, stopAutoSmash } from './logic.js';
import { speak } from '../speech.js';
import { hintCard } from './effects.js';
import { enterFullscreen, exitFullscreen, unlockPointer, onFullscreenChange, warnIfKioskBlocked } from './fullscreen.js';

let appState = null;
let demoTimer = null;
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
  // Don't force-exit fullscreen on the picker so parents can navigate,
  // but expose an obvious Exit Fullscreen button if active.
  updateExitHint();

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
  btnBebas.onpointerenter = () => speak('Main TepuQ Bebas yuk', appState.settings);
  btnTarget.onpointerenter = () => speak('Ayo main TepuQ Target bersamaku', appState.settings);
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

function showModePickerSafe() {
  unlockPointer();
  exitFullscreen().finally(showModePicker);
}

export async function startMode(mode) {
  if (!appState) return;
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

  // Try kiosk immersion when enabled (default on). Parents can disable fullscreen in admin.
  // Do not await fullscreen so the game is responsive immediately; the mode picker is already
  // hidden and input handlers are bound. Fullscreen is best-effort.
  if (appState.settings.fullscreen !== false) {
    enterKiosk().catch(() => {});
  }
  fsUnsubscribe = onFullscreenChange(async (active) => {
    if (!active && getCurrentMode() !== null) {
      // Child exited fullscreen via OS gesture; pull them back to the safe picker instead of staying in game.
      showModePicker();
    }
  });

  if (mode === 'target') {
    handleTargetSuccess(appState.objects, appState.settings, document.getElementById('particles'));
  }
  resetAutoSmash(appState.objects, appState.settings);
}

async function enterKiosk() {
  await enterFullscreen();
  // No pointer lock: it hides the cursor. Instead the cursor is shown and
  // auto-hides after inactivity (see initCursorAutoHide), so toddlers on a
  // mouse can still see where they are tapping.
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

export function isKioskActive() {
  return getCurrentMode() !== null && isFullscreen();
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
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: false });
  document.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('contextmenu', (e) => {
    // Keep paste/long-press menu working inside text fields (sync login).
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => e.preventDefault());
  window.addEventListener('beforeunload', onBeforeUnload);
  bindBackTrigger();
  bindExitButton();
  initCursorAutoHide();
}

const CURSOR_IDLE_MS = 3000;
let cursorHideTimer = null;

function initCursorAutoHide() {
  const wake = () => {
    document.body.classList.remove('cursor-idle');
    if (cursorHideTimer) clearTimeout(cursorHideTimer);
    if (getCurrentMode() === null) return;
    cursorHideTimer = setTimeout(() => document.body.classList.add('cursor-idle'), CURSOR_IDLE_MS);
  };
  document.addEventListener('pointermove', wake, { passive: true });
  document.addEventListener('pointerdown', wake, { passive: true });
  document.addEventListener('keydown', wake, { passive: true });
}

function onKeyDown(e) {
  if (document.body.classList.contains('admin')) return;

  // Let parents type in text fields (e.g. sync login) without triggering cards.
  const target = e.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return;
  }

  // In game, allow only the "M" hint shortcut and the safe exit gesture.
  // Every other key becomes an input so the child does not exit by accident.
  if (e.key === 'Escape') {
    e.preventDefault();
    if (getCurrentMode() !== null) showModePicker();
    return;
  }

  // Block common browser / OS accelerator keys that toddlers can hit.
  if (isBlockedKey(e)) {
    e.preventDefault();
    e.stopPropagation();
    showBlockedToast('tombol');
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

function isBlockedKey(e) {
  // Browser tab/window/address controls.
  if (e.ctrlKey || e.metaKey) return true;
  if (e.altKey) return true;

  const key = e.key;
  if (key === 'F1' || key === 'F2' || key === 'F3' || key === 'F4' || key === 'F5' ||
      key === 'F6' || key === 'F7' || key === 'F8' || key === 'F9' || key === 'F10' ||
      key === 'F11' || key === 'F12') return true;
  if (key === 'Tab') return true;
  // OS/system navigation; most cannot be trapped, but prevent default where allowed.
  return false;
}

function onTouchStart(e) {
  if (document.body.classList.contains('admin')) return;
  e.preventDefault();
  if (!appState) return;
  const modePicker = document.getElementById('modePicker');
  if (!modePicker.classList.contains('hidden')) return;

  const touch = e.touches[0] || e.changedTouches[0];
  const point = touch ? { x: touch.clientX, y: touch.clientY } : null;
  const targetCard = document.querySelector('.card-pop.target-card');
  const card = targetCard || document.getElementById('card');
  const isCard = e.target === card || card?.contains(e.target);

  if (getCurrentMode() === 'target') {
    if (!isCard) {
      hintCard(card);
      return;
    }
    handleTargetSuccess(appState.objects, appState.settings, document.getElementById('particles'), point);
    return;
  }

  handleSuccess('touch', appState.objects, appState.settings, document.getElementById('particles'), null, point);
}

function onTouchMove(e) {
  if (document.body.classList.contains('admin')) return;
  // Disable two-finger scroll / swipe gestures that can switch apps.
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}

function onTouchEnd(e) {
  if (document.body.classList.contains('admin')) return;
}

function onWheel(e) {
  if (document.body.classList.contains('admin')) return;
  if (getCurrentMode() === null) return;
  // Block touchpad two-finger scroll and magic-mouse swipes during game.
  e.preventDefault();
}

function onBeforeUnload(e) {
  if (document.body.classList.contains('admin')) return;
  if (getCurrentMode() !== null) {
    // Warn if the parent tries to close while the child is mid-game in fullscreen.
    e.preventDefault();
    e.returnValue = '';
  }
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

  // Clicking the Exit Fullscreen button on the picker is handled separately.
  if (e.target.closest('#exitFullscreenBtn')) return;

  const modePicker = document.getElementById('modePicker');
  if (!modePicker.classList.contains('hidden')) return;

  e.preventDefault();
  if (!appState) return;

  const point = { x: e.clientX, y: e.clientY };
  const clickedCard = document.querySelector('.card-pop.target-card') || document.getElementById('card');
  const isCard = e.target === clickedCard || clickedCard?.contains(e.target);

  if (getCurrentMode() === 'target') {
    if (!isCard) {
      hintCard(clickedCard);
      return;
    }
    handleTargetSuccess(appState.objects, appState.settings, document.getElementById('particles'), point);
    return;
  }

  handleSuccess('pointer', appState.objects, appState.settings, document.getElementById('particles'), null, point);
}

function bindBackTrigger() {
  const trigger = document.getElementById('backTrigger');
  const hint = document.getElementById('backHint');
  let timer = null;
  let hintTimer = null;
  let activeTouchId = null;
  let startTime = 0;
  let feedbackTimer = null;
  let visualTimer = null;
  const PRESS_MS = 1500;
  const VISUAL_DELAY_MS = 250;

  const showHint = () => {
    hint.classList.add('show');
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('show'), 2000);
  };

  const finish = () => {
    timer = null;
    startTime = 0;
    trigger.classList.remove('back-active');
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = null;
    if (visualTimer) clearTimeout(visualTimer);
    visualTimer = null;
    unlockPointer();
    exitFullscreen().finally(showModePicker);
  };

  const start = (e) => {
    e.preventDefault();
    if (timer) return;

    if (e.type === 'touchstart') {
      const touch = e.changedTouches[0];
      activeTouchId = touch.identifier;
    } else {
      activeTouchId = null;
    }

    startTime = performance.now();
    timer = setTimeout(() => {
      timer = null;
      if (navigator.vibrate) navigator.vibrate(80);
      finish();
    }, PRESS_MS);

    // Only show visual feedback once the press is sustained, so a quick tap
    // in the top-left corner does not flash the white rectangle.
    visualTimer = setTimeout(() => {
      visualTimer = null;
      trigger.classList.add('back-active');
    }, VISUAL_DELAY_MS);

    feedbackTimer = setTimeout(() => {
      feedbackTimer = null;
      if (navigator.vibrate) navigator.vibrate(40);
    }, PRESS_MS - 120);
  };

  const cancel = (e) => {
    if (e?.type === 'touchend' || e?.type === 'touchcancel') {
      const touch = e.changedTouches[0];
      if (activeTouchId !== null && touch && touch.identifier !== activeTouchId) {
        return;
      }
      activeTouchId = null;
    }

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
    if (visualTimer) {
      clearTimeout(visualTimer);
      visualTimer = null;
    }
    startTime = 0;
    trigger.classList.remove('back-active');
  };

  trigger.addEventListener('pointerdown', start, { passive: false });
  trigger.addEventListener('pointerup', cancel);
  trigger.addEventListener('pointerleave', cancel);
  trigger.addEventListener('pointercancel', cancel);
  trigger.addEventListener('touchstart', start, { passive: false });
  trigger.addEventListener('touchend', cancel);
  trigger.addEventListener('touchcancel', cancel);
  trigger.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      showHint();
    }
  });
}

function bindExitButton() {
  const btn = document.getElementById('exitFullscreenBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    exitFullscreen().finally(showModePicker);
  });
}

let blockedToastTimer = null;
function showBlockedToast(kind) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = kind === 'tombol'
    ? 'Tombol ini dilindungi supaya tidak keluar dari permainan'
    : 'Gerakan ini dilindungi supaya tidak keluar dari permainan';
  toast.classList.add('show', 'error');
  if (blockedToastTimer) clearTimeout(blockedToastTimer);
  blockedToastTimer = setTimeout(() => {
    toast.classList.remove('show', 'error');
  }, 1600);
}

function updateExitHint() {
  const hint = document.getElementById('fsExitHint');
  if (!hint) return;
  hint.classList.toggle('show', isFullscreen());
}

function getCurrentMode() {
  return getState().currentMode;
}
