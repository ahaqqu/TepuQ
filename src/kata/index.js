// TepuQ Kata game loop: wires game-state, renderer, and audio into the state
// machine (LOADING -> PLAYING -> CELEBRATING -> NEXT_WORD -> ... -> VICTORY).
// Exposes initKata()/destroyKata() to the app router (src/game-picker.js).

import {
  resetKataState, getKataState, prepareSession, loadCurrentWord,
  placeTile, isWordComplete, advanceWord, currentWord,
} from './game-state.js';
import {
  initRenderer, renderWord, fireConfetti, showWinScreen, showEmptyState,
  clearStage, setKataStateRef,
} from './renderer.js';
import {
  initKataAudio, speakLetter, speakWord, playSuccessChime,
} from './audio.js';
import { putKataProgress, getKataProgress } from '../db.js';

let stage = null;
let kataSettings = null;
let speechSettings = null;
let progress = null;
let destroyed = false;

export async function initKata(words, settings, gambarSpeechSettings) {
  stage = document.getElementById('kataStage');
  kataSettings = settings;
  speechSettings = gambarSpeechSettings;
  destroyed = false;
  progress = await getKataProgress();

  resetKataState();
  setKataStateRef(getKataState());
  initRenderer(stage, {
    onSnap: handleSnap,
    onReject: () => { /* visual only; state unchanged */ },
  });

  const enabled = words.filter((w) => w.enabled);
  if (enabled.length === 0) {
    showEmptyState();
    return;
  }

  prepareSession(words, settings);
  await initKataAudio();
  startCurrentWord();
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
  if (word) speakWord(word, speechSettings);
  fireConfetti();
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
  getKataState().phase = 'VICTORY';
  progress.totalSessions = (progress.totalSessions || 0) + 1;
  progress.currentStreak = 0;
  progress.completedWords = [];
  await putKataProgress(progress);
  fireConfetti();
  showWinScreen(() => {
    // Main Lagi: restart the session with the same words reshuffled.
    resetKataState();
    setKataStateRef(getKataState());
    prepareSession(getKataState().words.length ? getKataState().words : [], kataSettings);
    startCurrentWord();
  });
}

export function destroyKata() {
  destroyed = true;
  clearStage();
}