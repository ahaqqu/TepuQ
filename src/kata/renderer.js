// DOM rendering for TepuQ Kata: slot row, scattered letter tiles, confetti,
// and the win screen. Reads state from src/kata/game-state.js and writes DOM
// into the #kataStage container. Slot/tile centers are measured after layout
// so the drag engine works in real pixels.

import { scatterLetters } from './slots.js';
import { bindDrag, bounceBack, snapToSlot } from './drag-engine.js';

let stage = null;
let cleanups = [];
let onSnapCb = null;
let onRejectCb = null;

export function initRenderer(container, { onSnap, onReject } = {}) {
  stage = container;
  onSnapCb = onSnap;
  onRejectCb = onReject;
}

export function clearStage() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  if (stage) stage.innerHTML = '';
}

// Render one word: slot row at top, scattered tiles below.
export function renderWord(wordRecord, settings, state) {
  clearStage();
  if (!stage || !wordRecord) return;

  const word = wordRecord.word.toLowerCase();
  const letters = word.split('');

  // Slot row
  const slotRow = document.createElement('div');
  slotRow.className = 'kata-slot-row';
  slotRow.dataset.word = word;
  letters.forEach((letter, index) => {
    const slot = document.createElement('div');
    slot.className = 'kata-slot';
    slot.dataset.index = index;
    slot.dataset.letter = letter;
    slot.style.width = `${settings.slotSize}px`;
    slot.style.height = `${settings.slotSize}px`;
    slotRow.appendChild(slot);
  });
  stage.appendChild(slotRow);

  // Scatter area
  const scatter = document.createElement('div');
  scatter.className = 'kata-scatter';
  stage.appendChild(scatter);

  // Defer measuring until the scatter area is laid out.
  requestAnimationFrame(() => {
    const area = { width: scatter.clientWidth, height: scatter.clientHeight };
    const origins = scatterLetters(word, area, settings.letterSize);
    const containerRect = stage.getBoundingClientRect();

    letters.forEach((letter, tileIndex) => {
      const tile = document.createElement('div');
      tile.className = 'kata-tile';
      tile.dataset.letter = letter;
      tile.dataset.tileIndex = tileIndex;
      tile.textContent = letter.toUpperCase();
      tile.style.width = `${settings.letterSize}px`;
      tile.style.height = `${settings.letterSize}px`;
      const origin = origins[tileIndex] || { x: 0, y: 0 };
      tile.style.left = `${origin.x}px`;
      tile.style.top = `${origin.y}px`;
      scatter.appendChild(tile);

      const cleanup = bindDrag(tile, {
        container: scatter,
        getSlots: () => getSlotList(slotRow),
        snapDistance: () => settings.snapDistance,
        onSnap: (ti, si) => handleSnap(ti, si, state, settings, slotRow, scatter, containerRect),
        onReject: (ti) => handleReject(ti, scatter),
      });
      cleanups.push(cleanup);
    });
  });
}

// Build the live slot list with centers (viewport coords) and filled state,
// read from game state so the drag engine sees the current fill.
function getSlotList(slotRow) {
  const slotEls = slotRow.querySelectorAll('.kata-slot');
  const stateSlots = (window.__kataState?.slots) || [];
  return Array.from(slotEls).map((el, index) => {
    const rect = el.getBoundingClientRect();
    return {
      index,
      letter: el.dataset.letter,
      center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      filled: stateSlots[index]?.filled || false,
    };
  });
}

function handleSnap(tileIndex, slotIndex, state, settings, slotRow, scatter, containerRect) {
  const slotEl = slotRow.querySelector(`.kata-slot[data-index="${slotIndex}"]`);
  const tileEl = scatter.querySelector(`.kata-tile[data-tile-index="${tileIndex}"]`);
  if (!slotEl || !tileEl) return;
  // Update state via the game loop callback rather than touching state here.
  const wordDone = onSnapCb?.(tileIndex, slotIndex);
  slotEl.classList.add('filled');
  const slotRect = slotEl.getBoundingClientRect();
  const slotCenter = {
    x: slotRect.left + slotRect.width / 2 - containerRect.left,
    y: slotRect.top + slotRect.height / 2 - containerRect.top,
  };
  // snap relative to the scatter container
  const scatterRect = scatter.getBoundingClientRect();
  snapToSlot(tileEl, { x: slotCenter.x, y: slotCenter.y }, scatterRect);
  tileEl.classList.add('placed');
}

function handleReject(tileIndex, scatter) {
  const tileEl = scatter.querySelector(`.kata-tile[data-tile-index="${tileIndex}"]`);
  if (tileEl) bounceBack(tileEl);
  onRejectCb?.(tileIndex);
}

// Confetti burst (canvas-based, no external library). Attached to #kataConfetti.
export function fireConfetti() {
  const canvas = document.getElementById('kataConfetti');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899'];
  const pieces = Array.from({ length: 80 }, () => ({
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 1) * 10,
    size: 6 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
  }));
  let frame = 0;
  const maxFrames = 90;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.vy += 0.3;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    frame++;
    if (frame < maxFrames) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  draw();
}

// Win screen overlay.
export function showWinScreen(onMainLagi) {
  if (!stage) return;
  const overlay = document.createElement('div');
  overlay.className = 'kata-win';
  overlay.innerHTML = `
    <div class="kata-win__content">
      <div class="kata-win__emoji">🎉</div>
      <h2>Hebat!</h2>
      <button class="kata-win__btn" id="kataMainLagi">Main Lagi</button>
    </div>
  `;
  stage.appendChild(overlay);
  overlay.querySelector('#kataMainLagi').addEventListener('click', () => {
    overlay.remove();
    onMainLagi?.();
  });
}

export function showEmptyState() {
  clearStage();
  if (!stage) return;
  const empty = document.createElement('div');
  empty.className = 'kata-empty';
  empty.innerHTML = `
    <h2>Belum ada kata</h2>
    <p>Buka mode admin untuk menambahkan kata.</p>
    <a href="?mode=admin">Buka Admin</a>
  `;
  stage.appendChild(empty);
}

// Expose state for the renderer's getSlotList without a circular import.
export function setKataStateRef(stateRef) {
  window.__kataState = stateRef;
}