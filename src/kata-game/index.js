// TepuQ Kata game loop: wires game-state, renderer, and audio into the state
// machine (LOADING -> PLAYING -> CELEBRATING -> NEXT_WORD -> ... -> VICTORY).
// Exposes initKata()/destroyKata() to the app router (src/game-picker.js).

import {
  resetKataState, getKataState, prepareSession, loadCurrentWord,
  placeTile, isWordComplete, advanceWord, currentWord,
} from './game-state.js';
import {
  initRenderer, renderWord, fireConfetti, showWinScreen, showEmptyState,
  clearStage, setKataStateRef, handleTypedLetter,
} from './renderer.js';
import {
  initKataAudio, speakLetter, speakWord, playSuccessChime, playVictoryChime,
} from './audio.js';
import { putKataProgress, getKataProgress } from '../db.js';
import { fetchCurrentUser } from '../admin/sync.js';

let stage = null;
let kataSettings = null;
let speechSettings = null;
let progress = null;
let destroyed = false;
let keyboardCleanup = null;

export async function initKata(words, settings, gambarSpeechSettings) {
  stage = document.getElementById('kataStage');
  kataSettings = settings;
  speechSettings = gambarSpeechSettings || {};
  destroyed = false;
  progress = await getKataProgress();

  resetKataState();
  setKataStateRef(getKataState());
  initRenderer(stage, {
    onSnap: handleSnap,
    onReject: () => { /* visual only; state unchanged */ },
    onBackToMenu: () => backToMenu(),
  });

  const enabled = words.filter((w) => w.enabled);
  if (enabled.length === 0) {
    showEmptyState();
    return;
  }

  prepareSession(words, settings);
  await initKataAudio();
  keyboardCleanup = bindKeyboard();
  startCurrentWord();
}

function bindKeyboard() {
  const handler = (e) => {
    if (destroyed) return;
    if (document.body.classList.contains('admin')) return;
    if (!stage || stage.classList.contains('hidden')) return;

    // Don't steal keys from forms/inputs (login form, admin, etc).
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
    ) {
      return;
    }

    // Only single character keys (letters, numbers) count as a toddler typing.
    if (e.key.length !== 1) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const moved = handleTypedLetter(e.key);
    if (moved && e.cancelable) e.preventDefault();
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

function startCurrentWord() {
  if (destroyed) return;
  const word = loadCurrentWord();
  if (!word) {
    handleVictory();
    return;
  }
  renderWord(word, kataSettings, getKataState());
}

// Returns true when the word is now complete (used by the renderer to know
// whether to trigger the celebration).
function handleSnap(tileIndex, slotIndex) {
  const done = placeTile(tileIndex, slotIndex);
  const st = getKataState();
  const word = currentWord();
  if (kataSettings.enableLetterSpeech && word) {
    speakLetter(st.tiles[tileIndex].letter, speechSettings);
  }
  if (done) {
    handleWordComplete();
    return true;
  }
  return false;
}

async function handleWordComplete() {
  getKataState().phase = 'CELEBRATING';
  const word = currentWord();
  playSuccessChime();
  fireConfetti();
  // Speak the completed word *after* the letter TTS finishes so the toddler
  // hears the last character first, then the whole word.
  if (word) {
    setTimeout(() => speakWord(word, speechSettings), 700);
  }
  // Persist progress (completed word id + streak).
  progress.completedWords = [...(progress.completedWords || []), word.id];
  progress.currentStreak = (progress.currentStreak || 0) + 1;
  await putKataProgress(progress);

  // Auto-advance after 2s.
  setTimeout(() => {
    if (destroyed) return;
    const next = advanceWord();
    if (!next && getKataState().phase === 'VICTORY') {
      handleVictory();
    } else {
      startCurrentWord();
    }
  }, 2000);
}

async function handleVictory() {
  const sessionWords = getKataState().words;
  getKataState().phase = 'VICTORY';
  // Celebration effects must not block or crash the win screen.
  try { fireConfetti(); } catch {}
  try { playVictoryChime(); } catch {}
  try {
    const user = await fetchCurrentUser();
    const text = user ? `Selamat ${user}, kamu berhasil!` : 'Selamat, kamu berhasil!';
    speak(text, speechSettings);
  } catch {}
  showWinScreen(() => {
    // Main Lagi: restart the session with the same words reshuffled.
    resetKataState();
    setKataStateRef(getKataState());
    prepareSession(sessionWords, kataSettings);
    startCurrentWord();
  });
  // Save progress in the background so the win screen appears immediately.
  progress.totalSessions = (progress.totalSessions || 0) + 1;
  progress.currentStreak = 0;
  progress.completedWords = [];
  putKataProgress(progress).catch(() => {});
}

export function destroyKata() {
  destroyed = true;
  if (keyboardCleanup) {
    keyboardCleanup();
    keyboardCleanup = null;
  }
  clearStage();
}

// Return to the Game Picker (called by the in-game back button). We dispatch a
// custom event instead of importing showGamePicker directly, to avoid a circular
// import (game-picker.js imports initKata from this module).
function backToMenu() {
  destroyKata();
  window.dispatchEvent(new CustomEvent('tepuq:kata-back-to-menu'));
}