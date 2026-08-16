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

  const word = wordRecord.word.toLowerCase();
  const letters = word.split('');

  // Letters scale with the screen: the stored settings are the mobile base.
  // Phones get slightly bigger letters; desktops get much bigger ones
  // (capped at 2x). Slots are then adapted so long words never tower into the
  // scatter area, and tiles are adapted so they never spill onto the photo.
  const sizes = scaledSizes(settings);
  const slotSize = fitSlotSize(letters.length, sizes.slotSize);
  stage.style.setProperty('--kata-slot-size', `${slotSize}px`);

  // Back-to-menu button (top-left, toddler-safe minimum size).
  const backBtn = document.createElement('button');
  backBtn.className = 'kata-back-btn';
  backBtn.textContent = '‹ Menu';
  backBtn.addEventListener('click', () => {
    destroyKataCallback?.();
  });
  stage.appendChild(backBtn);

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
    slot.style.width = `${slotSize}px`;
    slot.style.height = `${slotSize}px`;
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
    const fit = fitTileSize(letters.length, area, sizes.letterSize);
    const tileSize = fit.size;
    stage.style.setProperty('--kata-tile-size', `${tileSize}px`);
    // When the tiles had to shrink to fit, scatter them on a deterministic
    // grid (shuffled into cells) so they can never spill onto the photo.
    const origins = scatterLetters(word, area, tileSize, Math.random, {
      gridFirst: fit.shrunk,
    });

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
      tile.style.width = `${tileSize}px`;
      tile.style.height = `${tileSize}px`;
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

// Letter/slot scale per screen. The stored settings are the phone base:
// mobile gets a small bump (1.15x), and the scale grows with the screen up to
// 2x on big desktops. The fitted sizes below can only shrink from here when a
// long word would otherwise overflow the layout.
function scaledSizes(settings) {
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const factor = Math.min(2, Math.max(1.15, vmin / 540));
  return {
    letterSize: Math.round((settings.letterSize || 90) * factor),
    slotSize: Math.round((settings.slotSize || 100) * factor),
  };
}

// Width available to the slot row: the stage content width, minus the photo
// when the wide-screen layout puts the photo beside the slots. Keep the
// breakpoint in sync with the @media rule in src/styles/kata.css.
function slotRowWidth() {
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const padPx = (4 * vmin) / 100; // #kataStage padding 4vmin per side
  const wide = window.innerWidth >= 1400;
  const photoPx = Math.min(360, Math.max(110, (30 * vmin) / 100));
  const gapPx = (2 * vmin) / 100; // .kata-bottom gap 2vmin
  return window.innerWidth - 2 * padPx - (wide ? photoPx + gapPx : 0);
}

// Slot size adapted to the row width: prefer one row (shrinking a bit if
// needed, down to 96px) so the slots never tower into the scatter area; fall
// back to two rows only when one row would be too small.
function fitSlotSize(n, preferred) {
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const gap = (2.5 * vmin) / 100; // .kata-slot-row gap 2.5vmin
  const rowWidth = slotRowWidth();
  const perRow = (rows) =>
    Math.floor((rowWidth - (Math.ceil(n / rows) - 1) * gap) / Math.ceil(n / rows));
  const one = perRow(1);
  if (one >= preferred) return preferred;
  if (one >= 96) return one;
  return Math.max(Math.min(perRow(2), preferred), 96);
}

// Tile size that packs n tiles into the scatter area without spilling onto the
// photo below. Mirrors the packed-grid math in slots.js: n tiles need
// ceil(n/cols) grid rows and the last row must still end inside the area.
// Returns { size, shrunk } — shrunk tells the caller to use the grid-first
// scatter: either the tiles had to shrink, or the area's grid cannot hold n
// distinct cells for the random path (in which case the grid fits by
// construction at the returned size).
function fitTileSize(n, area, preferred) {
  let t = preferred;
  while (t > 90) {
    const pad = t / 2;
    const minX = pad;
    const maxX = Math.max(minX, area.width - t - pad);
    const cols = Math.max(1, Math.floor((maxX - minX) / t) + 1);
    const rows = Math.ceil(n / cols);
    if (rows * t + pad <= area.height) {
      const maxRow = Math.max(0, Math.floor((area.height - 2 * t) / t));
      const capacity = (maxRow + 1) * cols;
      return { size: Math.round(t), shrunk: t < preferred || capacity < n };
    }
    t -= 4;
  }
  return { size: Math.round(t), shrunk: true };
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