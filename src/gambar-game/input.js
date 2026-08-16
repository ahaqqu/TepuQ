// Touch + keyboard/pointer input for TepuQ Gambar.
// bindGameInput() attaches the handlers and returns a cleanup function that
// must be called when leaving the game so the listeners do not keep firing on
// the Game Picker.

import { handleSuccess } from './logic.js';
import { hintCard } from './effects.js';
import { exitFullscreen, unlockPointer } from './fullscreen.js';
import { showModePicker, getCurrentMode, getAppState } from './mode-manager.js';

// Keep handler references at module scope so unbindGameInput can remove them.
let cleanup = null;

export function bindGameInput() {
  if (cleanup) cleanup();

  document.addEventListener('keydown', onKeyDown, { passive: false });
  document.addEventListener('pointerdown', onPointerDown, { passive: false });
  document.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: false });
  document.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('dragstart', onDragStart);
  window.addEventListener('beforeunload', onBeforeUnload);
  const backCleanup = bindBackTrigger();
  const cursorCleanup = initCursorAutoHide();

  cleanup = () => {
    document.removeEventListener('keydown', onKeyDown, { passive: false });
    document.removeEventListener('pointerdown', onPointerDown, { passive: false });
    document.removeEventListener('touchstart', onTouchStart, { passive: false });
    document.removeEventListener('touchmove', onTouchMove, { passive: false });
    document.removeEventListener('touchend', onTouchEnd, { passive: false });
    document.removeEventListener('wheel', onWheel, { passive: false });
    document.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('dragstart', onDragStart);
    window.removeEventListener('beforeunload', onBeforeUnload);
    backCleanup();
    cursorCleanup();
    cleanup = null;
  };

  return cleanup;
}

export function unbindGameInput() {
  cleanup?.();
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

  return () => {
    document.removeEventListener('pointermove', wake, { passive: true });
    document.removeEventListener('pointerdown', wake, { passive: true });
    document.removeEventListener('keydown', wake, { passive: true });
    if (cursorHideTimer) clearTimeout(cursorHideTimer);
    cursorHideTimer = null;
  };
}

function onKeyDown(e) {
  if (document.body.classList.contains('admin')) return;

  const target = e.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    if (getCurrentMode() !== null) showModePicker();
    return;
  }

  if (isBlockedKey(e)) {
    e.preventDefault();
    e.stopPropagation();
    showBlockedToast('tombol');
    return;
  }

  e.preventDefault();
  const appState = getAppState();
  if (!appState) return;
  handleSuccess('keyboard', appState.objects, appState.settings, document.getElementById('particles'), e.key);
}

function isBlockedKey(e) {
  if (e.ctrlKey || e.metaKey) return true;
  if (e.altKey) return true;

  const key = e.key;
  if (key === 'F1' || key === 'F2' || key === 'F3' || key === 'F4' || key === 'F5' ||
      key === 'F6' || key === 'F7' || key === 'F8' || key === 'F9' || key === 'F10' ||
      key === 'F11' || key === 'F12') return true;
  if (key === 'Tab') return true;
  return false;
}

function onTouchStart(e) {
  if (document.body.classList.contains('admin')) return;

  const target = e.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
    return;
  }

  const modePicker = document.getElementById('modePicker');
  if (modePicker && !modePicker.classList.contains('hidden')) return;

  e.preventDefault();
  const appState = getAppState();
  if (!appState) return;

  const touch = e.touches[0] || e.changedTouches[0];
  const point = touch ? { x: touch.clientX, y: touch.clientY } : null;
  const targetCard = document.querySelector('.card-pop.target-card');
  const card = targetCard || document.getElementById('card');
  const isCard = e.target === card || card?.contains(e.target);

  if (getCurrentMode() === 'target' && !isCard) {
    hintCard(card);
    return;
  }

  handleSuccess('touch', appState.objects, appState.settings, document.getElementById('particles'), null, point);
}

function onTouchMove(e) {
  if (document.body.classList.contains('admin')) return;
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
  e.preventDefault();
}

function onBeforeUnload(e) {
  if (document.body.classList.contains('admin')) return;
  if (getCurrentMode() !== null) {
    e.preventDefault();
    e.returnValue = '';
  }
}

function onContextMenu(e) {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  e.preventDefault();
}

function onDragStart(e) {
  e.preventDefault();
}

function onPointerDown(e) {
  if (document.body.classList.contains('admin')) return;
  if (e.target.id === 'backTrigger') return;

  const modePicker = document.getElementById('modePicker');
  if (!modePicker.classList.contains('hidden')) return;

  e.preventDefault();
  const appState = getAppState();
  if (!appState) return;

  const point = { x: e.clientX, y: e.clientY };
  const clickedCard = document.querySelector('.card-pop.target-card') || document.getElementById('card');
  const isCard = e.target === clickedCard || clickedCard?.contains(e.target);

  if (getCurrentMode() === 'target' && !isCard) {
    hintCard(clickedCard);
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

  const keyHandler = (e) => {
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      showHint();
    }
  };

  trigger.addEventListener('pointerdown', start, { passive: false });
  trigger.addEventListener('pointerup', cancel);
  trigger.addEventListener('pointerleave', cancel);
  trigger.addEventListener('pointercancel', cancel);
  trigger.addEventListener('touchstart', start, { passive: false });
  trigger.addEventListener('touchend', cancel);
  trigger.addEventListener('touchcancel', cancel);
  trigger.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('keydown', keyHandler);

  return () => {
    trigger.removeEventListener('pointerdown', start, { passive: false });
    trigger.removeEventListener('pointerup', cancel);
    trigger.removeEventListener('pointerleave', cancel);
    trigger.removeEventListener('pointercancel', cancel);
    trigger.removeEventListener('touchstart', start, { passive: false });
    trigger.removeEventListener('touchend', cancel);
    trigger.removeEventListener('touchcancel', cancel);
    trigger.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('keydown', keyHandler);
    if (timer) clearTimeout(timer);
    if (hintTimer) clearTimeout(hintTimer);
    if (feedbackTimer) clearTimeout(feedbackTimer);
    if (visualTimer) clearTimeout(visualTimer);
  };
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
