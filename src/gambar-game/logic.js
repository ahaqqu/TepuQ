import { speakOrPlay, speak, playVictoryChime } from '../speech.js';
import { fireConfetti } from '../confetti.js';
import { createParticles, thumpCard } from './effects.js';
import { createCard, clearPopCards, revokeCardURL } from './card.js';
import { normalizeKey } from '../utils.js';
import { fetchCurrentUser } from '../sync-client.js';
import { getState, setState, resetGameState } from './game-state.js';

export { getState, setState, resetGameState } from './game-state.js';

// Every this many successful target taps, TepuQ Target adds a Kata-style
// victory audio celebration ("Selamat, kamu hebat!" + victory fanfare) to the
// confetti that bursts on every successful tap. Kata keeps its 3-word session
// (letters take a toddler time), but a target tap is one gesture — 5 keeps
// the celebration special.
const TARGET_CELEBRATION_EVERY = 5;
const TARGET_CELEBRATION_PAUSE_MS = 5000;

// Non-blocking Kata-style milestone: confetti bursts over the stage, then the
// congratulations TTS and the fanfare once the TTS finishes. When a username is
// known, the message is personalized.
function celebrateTargetMilestone(settings, point, user) {
  [400, 800].forEach((ms) => {
    setTimeout(() => { try { fireConfetti(point?.x, point?.y); } catch {} }, ms);
  });
  setTimeout(() => {
    const text = user ? `Selamat ${user}, kamu hebat!` : 'Selamat, kamu hebat!';
    speak(text, settings, () => { try { playVictoryChime(); } catch {} });
  }, 1600);
}

// On every 5th successful target tap, freeze the game for ~5 seconds and show
// a big, playful username celebration before advancing to the next card.
function showTargetCelebrationPause(objects, settings, elParticles, point) {
  const state = getState();
  state.targetCelebration = true;
  stopAutoSmash();
  if (state.targetTransitionTimer) {
    clearTimeout(state.targetTransitionTimer);
    state.targetTransitionTimer = null;
  }

  // Initial burst from the tap point plus two full-screen follow-ups.
  try { fireConfetti(point?.x, point?.y); } catch {}
  [700, 1400].forEach((ms) => {
    setTimeout(() => { try { fireConfetti(); } catch {} }, ms);
  });

  const game = document.getElementById('game');
  const overlay = document.createElement('div');
  overlay.className = 'target-celebration';
  overlay.innerHTML = `
    <div class="target-celebration__emoji">🎉</div>
    <div class="target-celebration__text"><span class="target-celebration__line">Hebat!</span></div>
  `;
  game.appendChild(overlay);

  fetchCurrentUser()
    .then((user) => {
      if (!user) return;
      const line = overlay.querySelector('.target-celebration__line');
      if (line) line.textContent = `Hebat, ${user}!`;
    })
    .catch(() => {});

  // Keep the Kata-style audio celebration running during the pause.
  fetchCurrentUser()
    .then((user) => {
      celebrateTargetMilestone(settings, point, user);
    })
    .catch(() => {
      celebrateTargetMilestone(settings, point, null);
    });

  state.targetTransitionTimer = setTimeout(() => {
    overlay.remove();
    state.targetCelebration = false;
    advanceTargetCard(objects, settings, elParticles, null);
  }, TARGET_CELEBRATION_PAUSE_MS);
}

export function chooseNext(active, current, playMode, shufflePool) {
  if (playMode === 'sequential') {
    const idx = active.findIndex((o) => o.id === current?.id);
    return { next: active[(idx + 1) % active.length], pool: [] };
  }
  if (playMode === 'round-robin') {
    let pool = shufflePool || [];
    if (pool.length === 0) {
      pool = active.filter((o) => o.id !== current?.id).sort(() => Math.random() - 0.5);
      if (pool.length === 0) return { next: current || active[0], pool: [] };
    }
    return { next: pool.shift(), pool };
  }
  if (active.length === 1) return { next: active[0], pool: [] };
  let next;
  do {
    next = active[Math.floor(Math.random() * active.length)];
  } while (next.id === current?.id);
  return { next, pool: [] };
}

export function findBoundObject(active, key) {
  const normalized = normalizeKey(key);
  if (!normalized) return null;
  return active.find((o) => (o.keyBindings || []).includes(normalized)) || null;
}

function advanceTargetCard(objects, settings, elParticles, point) {
  const state = getState();
  stopAutoSmash();
  if (state.targetTransitionTimer) {
    clearTimeout(state.targetTransitionTimer);
    state.targetTransitionTimer = null;
  }

  const active = objects.filter((o) => o.active);
  if (active.length === 0) return;

  const current = active.find((o) => o.id === state.currentObjectId) || null;
  const { next, pool } = chooseNext(active, current, settings.playMode, state.shufflePool);
  state.shufflePool = pool;

  state.currentObjectId = next.id;
  speakOrPlay(next, settings);
  showSingleCard(next, settings, elParticles, point);
  resetAutoSmash(objects, settings);
}

export function handleTargetSuccess(objects, settings, elParticles, point, source = 'touch') {
  const state = getState();

  const isChildTap = source && source !== 'mode-start';
  if (isChildTap) {
    state.targetStreak = (state.targetStreak || 0) + 1;
    // Burst from the tap/click point; keyboard actions have no point and
    // burst from the center.
    try { fireConfetti(point?.x, point?.y); } catch {}
    if (state.targetStreak % TARGET_CELEBRATION_EVERY === 0) {
      showTargetCelebrationPause(objects, settings, elParticles, point);
      return;
    }
  }
  advanceTargetCard(objects, settings, elParticles, point);
}

export async function handleSuccess(source, objects, settings, elParticles, key, point) {
  const state = getState();
  const debounceMs = Number(settings.debounceMs) > 0 ? Number(settings.debounceMs) : 0;
  const now = Date.now();
  if (now - state.lastInteractionTime < debounceMs || state.targetCelebration) return;
  state.lastInteractionTime = now;

  const active = objects.filter((o) => o.active);
  if (active.length === 0) return;

  if (state.currentMode === 'target') {
    handleTargetSuccess(objects, settings, elParticles, point, source);
    return;
  }

  const boundObj = key ? findBoundObject(active, key) : null;

  let current;
  if (boundObj) {
    current = boundObj;
    state.currentObjectId = current.id;
    state.burstActive = false;
    state.burstObjectId = null;
    if (state.burstTimer) clearTimeout(state.burstTimer);
    speakOrPlay(current, settings);
  } else if (state.burstActive && state.burstObjectId) {
    current = active.find((o) => o.id === state.burstObjectId) || active[0];
  } else {
    const prev = active.find((o) => o.id === state.currentObjectId) || null;
    const { next, pool } = chooseNext(active, prev, settings.playMode, state.shufflePool);
    state.shufflePool = pool;
    current = next;
    state.currentObjectId = current.id;
    state.burstActive = true;
    state.burstObjectId = current.id;
    startBurstTimer(settings);
    speakOrPlay(current, settings);
  }

  const game = document.getElementById('game');
  const popCards = [...game.querySelectorAll('.card-pop:not(.target-card)')];
  const MAX_POP_CARDS = 6;
  if (popCards.length >= MAX_POP_CARDS) {
    popCards.slice(0, popCards.length - MAX_POP_CARDS + 1).forEach((c) => {
      revokeCardURL(c);
      c.remove();
    });
  }

  const card = createCard(current, settings);
  card.dataset.autoRemove = 'true';
  game.appendChild(card);
  createParticles(elParticles, card, current.color, point?.x, point?.y);
  thumpCard(card);

  if (source !== 'auto-smash') resetAutoSmash(objects, settings);
}

export function showSingleCard(obj, settings, elParticles, point) {
  clearPopCards();
  const card = createCard(obj, settings);
  card.classList.add('target-card');
  document.getElementById('game').appendChild(card);
  createParticles(elParticles, card, obj.color, point?.x, point?.y);
  thumpCard(card);
}

function startBurstTimer(settings) {
  const state = getState();
  const ms = (Number(settings.burstWindow) > 0 ? Number(settings.burstWindow) : 0) * 1000;
  if (ms <= 0) {
    state.burstActive = false;
    state.burstObjectId = null;
    return;
  }
  if (state.burstTimer) clearTimeout(state.burstTimer);
  state.burstTimer = setTimeout(() => {
    state.burstActive = false;
    state.burstObjectId = null;
  }, ms);
}

function autoSmashLoop(objects, settings, elParticles) {
  const state = getState();
  if (state.currentMode !== 'bebas') return;
  handleSuccess('auto-smash', objects, settings, elParticles);
  const delay = Number(settings.autoSmashDelay) || 0;
  if (delay > 0) {
    state.autoSmashTimer = setTimeout(() => autoSmashLoop(objects, settings, elParticles), delay * 1000);
  }
}

export function resetAutoSmash(objects, settings) {
  const state = getState();
  stopAutoSmash();
  const delay = Number(settings.autoSmashDelay) || 0;
  if (delay <= 0 || state.currentMode === 'target') return;
  state.autoSmashTimer = setTimeout(() => autoSmashLoop(objects, settings, document.getElementById('particles')), delay * 1000);
}

export function stopAutoSmash() {
  const state = getState();
  if (state.autoSmashTimer) clearTimeout(state.autoSmashTimer);
  state.autoSmashTimer = null;
}
