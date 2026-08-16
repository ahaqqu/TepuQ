// Top-level Game Picker: shows the installed games (TepuQ Gambar, TepuQ Kata)
// and routes the player into the chosen game. This is the first menu level;
// TepuQ Gambar then shows its existing Bebas/Target sub-picker (mode-manager.js).
// See ADR 0002.

import { initGame, destroyGame } from './gambar-game/mode-manager.js';
import { bindGameInput, unbindGameInput } from './gambar-game/input.js';
import { initKata, destroyKata } from './kata-game/index.js';
import { loadKataData } from './db.js';
import { playSfx } from './speech.js';

let currentGame = null; // 'gambar' | 'kata' | null
let gambarInputCleanup = null;

export function initGamePicker(appState) {
  const picker = document.getElementById('gamePicker');
  const btnGambar = document.getElementById('btnGameGambar');
  const btnKata = document.getElementById('btnGameKata');
  if (!picker || !btnGambar || !btnKata) return;

  btnGambar.onclick = () => startGambar(appState);
  btnKata.onclick = () => startKata(appState);

  // Kata's in-game back button dispatches this event to avoid a circular import.
  window.addEventListener('tepuq:kata-back-to-menu', () => {
    playSfx('assets/sfx/back-menu.mp3', 0.7);
    showGamePicker();
  });
}

export function showGamePicker() {
  destroyCurrentGame();
  const picker = document.getElementById('gamePicker');
  const modePicker = document.getElementById('modePicker');
  const kataStage = document.getElementById('kataStage');
  if (picker) picker.classList.remove('hidden');
  if (modePicker) modePicker.classList.add('hidden');
  if (kataStage) kataStage.classList.add('hidden');
  currentGame = null;
}

async function startGambar(appState) {
  playSfx('assets/sfx/select-game.mp3');
  const picker = document.getElementById('gamePicker');
  if (picker) picker.classList.add('hidden');
  currentGame = 'gambar';
  // Gambar owns its own input binding and mode picker.
  gambarInputCleanup = bindGameInput();
  await initGame(appState);
}

async function startKata(appState) {
  playSfx('assets/sfx/select-game.mp3');
  const picker = document.getElementById('gamePicker');
  if (picker) picker.classList.add('hidden');
  const kataStage = document.getElementById('kataStage');
  if (kataStage) kataStage.classList.remove('hidden');
  currentGame = 'kata';
  const { words, settings } = await loadKataData();
  // Kata reuses Gambar's shared speech settings for TTS rate/pitch/volume.
  await initKata(words, settings, appState.settings);
}

function destroyCurrentGame() {
  if (currentGame === 'kata') {
    destroyKata();
  }
  if (currentGame === 'gambar') {
    unbindGameInput();
    destroyGame();
    gambarInputCleanup = null;
  }
}

// Exposed so a "back to games" gesture can return here from inside a game.
export function backToGamePicker() {
  playSfx('assets/sfx/back-menu.mp3', 0.7);
  showGamePicker();
}

export function getCurrentGame() {
  return currentGame;
}