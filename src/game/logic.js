import { speakOrPlay } from '../speech.js';
import { createParticles, thumpCard } from './effects.js';
import { createCard, clearPopCards } from './card.js';
import { normalizeKey } from '../utils.js';

const DEBOUNCE_MS = 80;

let state = {
  currentMode: null,
  currentObjectId: null,
  lastInteractionTime: 0,
  burstActive: false,
  burstObjectId: null,
  burstTimer: null,
  autoSmashTimer: null,
  targetTransitionTimer: null,
  shufflePool: [],
};

export function getState() {
  return state;
}

export function setState(patch) {
  state = { ...state, ...patch };
}

export function resetGameState() {
  state = {
    currentMode: null,
    currentObjectId: null,
    lastInteractionTime: 0,
    burstActive: false,
    burstObjectId: null,
    burstTimer: null,
    autoSmashTimer: null,
    targetTransitionTimer: null,
    shufflePool: [],
  };
}

export function chooseNext(active, current, playMode, shufflePool) {
  if (playMode === 'sequential') {
    const idx = active.findIndex((o) => o.id === current?.id);
    return active[(idx + 1) % active.length];
  }
  if (playMode === 'round-robin') {
    let pool = shufflePool || [];
    if (pool.length === 0) {
      pool = active.filter((o) => o.id !== current?.id).sort(() => Math.random() - 0.5);
      if (pool.length === 0) return current || active[0];
    }
    return { next: pool.shift(), pool };
  }
  if (active.length === 1) return active[0];
  let next;
  do {
    next = active[Math.floor(Math.random() * active.length)];
  } while (next.id === current?.id);
  return next;
}

export function findBoundObject(active, key) {
  const normalized = normalizeKey(key);
  if (!normalized) return null;
  return active.find((o) => (o.keyBindings || []).includes(normalized)) || null;
}

export function handleTargetSuccess(objects, settings, elParticles, point) {
  const now = Date.now();
  if (now - state.lastInteractionTime < settings.debounceMs) return;
  state.lastInteractionTime = now;

  stopAutoSmash();
  if (state.targetTransitionTimer) {
    clearTimeout(state.targetTransitionTimer);
    state.targetTransitionTimer = null;
  }

  const active = objects.filter((o) => o.active);
  if (active.length === 0) return;

  const current = active.find((o) => o.id === state.currentObjectId) || active[0];
  const raw = chooseNext(active, current, settings.playMode, state.shufflePool);
  const next = raw?.pool !== undefined ? raw.next : raw;
  if (raw?.pool !== undefined) state.shufflePool = raw.pool;

  state.currentObjectId = next.id;
  speakOrPlay(next, settings);
  showSingleCard(next, settings, elParticles, point);
  resetAutoSmash(objects, settings);
}

export async function handleSuccess(source, objects, settings, elParticles, key, point) {
  const now = Date.now();
  if (now - state.lastInteractionTime < DEBOUNCE_MS) return;
  state.lastInteractionTime = now;

  stopAutoSmash();

  const active = objects.filter((o) => o.active);
  if (active.length === 0) return;

  if (state.currentMode === 'target') {
    handleTargetSuccess(objects, settings, elParticles, point);
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
    const prev = active.find((o) => o.id === state.currentObjectId) || active[0];
    const raw = chooseNext(active, prev, settings.playMode, state.shufflePool);
    current = raw?.pool !== undefined ? raw.next : raw;
    if (raw?.pool !== undefined) state.shufflePool = raw.pool;
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
    popCards.slice(0, popCards.length - MAX_POP_CARDS + 1).forEach((c) => c.remove());
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
  if (state.currentMode !== 'bebas') return;
  handleSuccess('auto-smash', objects, settings, elParticles);
  const delay = Number(settings.autoSmashDelay) || 0;
  if (delay > 0) {
    state.autoSmashTimer = setTimeout(() => autoSmashLoop(objects, settings, elParticles), delay * 1000);
  }
}

export function resetAutoSmash(objects, settings) {
  stopAutoSmash();
  const delay = Number(settings.autoSmashDelay) || 0;
  if (delay <= 0 || state.currentMode === 'target') return;
  state.autoSmashTimer = setTimeout(() => autoSmashLoop(objects, settings, document.getElementById('particles')), delay * 1000);
}

export function stopAutoSmash() {
  if (state.autoSmashTimer) clearTimeout(state.autoSmashTimer);
  state.autoSmashTimer = null;
}
