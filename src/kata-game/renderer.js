// DOM rendering for TepuQ Kata: slot row, scattered letter tiles, confetti,
// and the win screen. Reads state from src/kata-game/game-state.js and writes
// DOM into the #kataStage container. Slot/tile centers are measured after
// layout so the drag engine works in real pixels.

import { scatterLetters } from './slots.js';
import { bindDrag, snapToSlot } from './drag-engine.js';

// A fun, bright palette so each letter gets its own color — more engaging for a
// toddler than a single color. The color is assigned by letter so a tile and
// its matching slot share the same hue.
const LETTER_COLORS = {
  a: '#ef4444', b: '#f97316', c: '#f59e0b', d: '#eab308', e: '#84cc16',
  f: '#22c55e', g: '#10b981', h: '#14b8a6', i: '#06b6d4', j: '#0ea5e9',
  k: '#3b82f6', l: '#6366f1', m: '#8b5cf6', n: '#a855f7', o: '#d946ef',
  p: '#ec4899', q: '#f43f5e', r: '#fb7185', s: '#fda4af', t: '#fbbf24',
  u: '#a3e635', v: '#34d399', w: '#22d3ee', x: '#60a5fa', y: '#818cf8',
  z: '#c084fc',
};
function colorForLetter(letter) {
  return LETTER_COLORS[letter] || '#3b82f6';
}

let stage = null;
let cleanups = [];
let onSnapCb = null;
let onRejectCb = null;
let destroyKataCallback = null;

export function initRenderer(container, { onSnap, onReject, onBackToMenu } = {}) {
  stage = container;
  onSnapCb = onSnap;
  onRejectCb = onReject;
  destroyKataCallback = onBackToMenu;
}

export function clearStage() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  if (stage) stage.innerHTML = '';
}

// Render one word: scatter tiles on top, photo + slot row at the bottom.
// The photo is the SAME photo as TepuQ Gambar (shared word/photo library), so
// the toddler learns the word and its meaning at the same time.
export function renderWord(wordRecord, settings, state) {
  clearStage();
  if (!stage || !wordRecord) return;

  // Back-to-menu button (top-left, toddler-safe minimum size).
  const backBtn = document.createElement('button');
  backBtn.className = 'kata-back-btn';
  backBtn.textContent = '‹ Menu';
  backBtn.addEventListener('click', () => {
    destroyKataCallback?.();
  });
  stage.appendChild(backBtn);

  const word = wordRecord.word.toLowerCase();
  const letters = word.split('');

  // Scatter area (top, flexible — tiles are dragged here).
  const scatter = document.createElement('div');
  scatter.className = 'kata-scatter';
  stage.appendChild(scatter);

  // Bottom area: photo of the word + slot row (targets at the bottom).
  const bottomArea = document.createElement('div');
  bottomArea.className = 'kata-bottom';

  // Photo: the object's shared photo (starter HTTP URL or a custom image
  // Blob), so the child sees what the word means. Custom blobs get a temporary
  // object URL that is revoked when the stage is cleared.
  if (wordRecord.imageBlob) {
    const photoUrl = URL.createObjectURL(wordRecord.imageBlob);
    const photo = document.createElement('img');
    photo.className = 'kata-photo';
    photo.src = photoUrl;
    photo.alt = wordRecord.word;
    photo.onerror = () => { photo.style.display = 'none'; };
    bottomArea.appendChild(photo);
    cleanups.push(() => URL.revokeObjectURL(photoUrl));
  } else if (wordRecord.imageUrl) {
    const photo = document.createElement('img');
    photo.className = 'kata-photo';
    photo.src = wordRecord.imageUrl;
    photo.alt = wordRecord.word;
    photo.onerror = () => { photo.style.display = 'none'; };
    bottomArea.appendChild(photo);
  }

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
    slot.style.setProperty('--kata-letter-color', colorForLetter(letter));
    const slotLetter = document.createElement('span');
    slotLetter.className = 'kata-slot-letter';
    slotLetter.textContent = letter.toUpperCase();
    slot.appendChild(slotLetter);
    slotRow.appendChild(slot);
  });
  bottomArea.appendChild(slotRow);
  stage.appendChild(bottomArea);

  // Defer measuring until the scatter area is laid out.
  requestAnimationFrame(() => {
    const area = { width: scatter.clientWidth, height: scatter.clientHeight };
    const origins = scatterLetters(word, area, settings.letterSize);

    letters.forEach((letter, tileIndex) => {
      const tile = document.createElement('div');
      tile.className = 'kata-tile';
      tile.dataset.letter = letter;
      tile.dataset.tileIndex = tileIndex;
      tile.style.setProperty('--kata-letter-color', colorForLetter(letter));
      const tileLetter = document.createElement('span');
      tileLetter.className = 'kata-tile-letter';
      tileLetter.textContent = letter.toUpperCase();
      tile.appendChild(tileLetter);
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
        onSnap: (ti, si) => handleSnap(ti, si, state, settings, slotRow, scatter),
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

function handleSnap(tileIndex, slotIndex, state, settings, slotRow, scatter) {
  const slotEl = slotRow.querySelector(`.kata-slot[data-index="${slotIndex}"]`);
  const tileEl = scatter.querySelector(`.kata-tile[data-tile-index="${tileIndex}"]`);
  if (!slotEl || !tileEl) return;
  // Update state via the game loop callback rather than touching state here.
  onSnapCb?.(tileIndex, slotIndex);
  slotEl.classList.add('filled');
  // Move the tile to the slot's center, relative to the scatter container.
  const scatterRect = scatter.getBoundingClientRect();
  const slotRect = slotEl.getBoundingClientRect();
  const slotCenter = {
    x: slotRect.left + slotRect.width / 2 - scatterRect.left,
    y: slotRect.top + slotRect.height / 2 - scatterRect.top,
  };
  snapToSlot(tileEl, slotCenter, scatterRect);
  tileEl.classList.add('placed');
}

// On a free drop (no slot nearby), the tile stays exactly where the child
// released it — no bounce-back. The child can re-grab and try again.
function handleReject(tileIndex, scatter) {
  const tileEl = scatter.querySelector(`.kata-tile[data-tile-index="${tileIndex}"]`);
  if (!tileEl) return;
  const scatterRect = scatter.getBoundingClientRect();
  const tileRect = tileEl.getBoundingClientRect();
  // Commit the current dragged position as the new left/top, clear transform.
  const newLeft = tileRect.left - scatterRect.left;
  const newTop = tileRect.top - scatterRect.top;
  tileEl.style.left = `${newLeft}px`;
  tileEl.style.top = `${newTop}px`;
  tileEl.style.transform = '';
  tileEl.style.zIndex = '';
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