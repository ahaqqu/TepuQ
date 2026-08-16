// Pure helpers for turning a word into ordered letter slots and for matching
// a dragged letter tile to a slot. Kept side-effect-free so they can be unit
// tested directly. See ADR 0003 for the slot-derivation decision.

// Build the ordered list of slots for a word. Each slot knows its index and
// the letter it expects. "mama" -> [{index:0,letter:'m'}, {index:1,letter:'a'},
// {index:2,letter:'m'}, {index:3,letter:'a'}]. Duplicate letters are distinct
// slots distinguished by position.
export function buildSlots(word) {
  const letters = (word || '').toLowerCase().split('');
  return letters.map((letter, index) => ({ index, letter }));
}

// Scatter the word's letters into the bounded play area without overlap.
// Returns absolute {x, y} positions (relative to the scatter container) for
// each tile, in tile order. The tiles are shuffled so the child must drag them
// to their correct slots rather than reading them left-to-right.
//
// opts.gridFirst: for tight areas (the renderer's fit logic shrank the tiles),
// place the shuffled letters on a deterministic grid that fits by construction,
// instead of random attempts. This guarantees long words on short screens
// never spill onto the photo below.
//
// opts.cellSize: optional spacing between tile centers. Defaults to tileSize
// for backward compatibility; the renderer passes a slightly larger cell so
// neon outlines have room on small screens.
export function scatterLetters(word, area, tileSize, rng = Math.random, opts = {}) {
  const letters = (word || '').toLowerCase().split('');
  const cellSize = opts.cellSize || tileSize;
  const minGap = opts.cellSize ? opts.cellSize : tileSize * 1.15;
  const positions = [];
  const pad = tileSize * 0.5;
  const minX = pad;
  const maxX = Math.max(minX, area.width - tileSize - pad);
  const minY = pad;
  const maxY = Math.max(minY, area.height - tileSize - pad);

  const order = shuffledIndices(letters.length, rng);

  if (opts.gridFirst) {
    const cols = Math.max(1, Math.floor((maxX - minX) / cellSize) + 1);
    const cells = [];
    for (let row = 0; cells.length < letters.length; row++) {
      const y = minY + row * cellSize;
      for (let col = 0; col < cols && cells.length < letters.length; col++) {
        cells.push({ x: minX + col * cellSize, y });
      }
    }
    const ordered = new Array(cells.length);
    order.forEach((tileIndex, i) => {
      ordered[tileIndex] = cells[i];
    });
    return ordered;
  }

  for (let i = 0; i < letters.length; i++) {
    let pos = null;
    // Prefer random spots with a little breathing room between tiles.
    for (let attempts = 0; attempts < 80 && pos === null; attempts++) {
      const candidate = {
        x: minX + rng() * (maxX - minX),
        y: minY + rng() * (maxY - minY),
      };
      if (!overlapsAny(candidate, positions, minGap)) pos = candidate;
    }
    // Random placement can run out of room in a short scatter area (longer
    // words on the photo layout). Fall back to a packed grid so no tile is ever
    // hidden behind another and every letter stays tappable. The grid stays
    // inside the bounded area, so tiles never spill onto the photo.
    if (pos === null) pos = packedPosition(positions, minX, maxX, minY, maxY, tileSize, cellSize);
    positions.push(pos);
  }

  // Reorder positions back to tile order so positions[i] is tile i's start.
  const ordered = new Array(positions.length);
  order.forEach((tileIndex, scatterIndex) => {
    ordered[tileIndex] = positions[scatterIndex];
  });
  return ordered;
}

// Deterministic last resort: scan a left-to-right, top-to-bottom grid at
// `cellSize` spacing for the first free spot within the bounded area. If every
// cell is blocked (a truly degenerate area), pick the cell farthest from the
// nearest tile: tiles stay inside the scatter area and their centers are never
// covered by another tile's box, so every letter stays tappable.
function packedPosition(existing, minX, maxX, minY, maxY, tileSize, cellSize = tileSize) {
  const cols = Math.max(1, Math.floor((maxX - minX) / cellSize) + 1);
  const maxRow = Math.max(0, Math.floor((maxY - minY) / cellSize));
  const cellCount = (maxRow + 1) * cols;
  let best = null;
  let bestDist = -1;
  for (let cell = 0; cell < cellCount; cell++) {
    const pos = {
      x: minX + (cell % cols) * cellSize,
      y: minY + Math.floor(cell / cols) * cellSize,
    };
    if (!overlapsAny(pos, existing, tileSize)) return pos;
    let nearest = Infinity;
    for (const e of existing) nearest = Math.min(nearest, distance(pos, e));
    if (nearest > bestDist) {
      bestDist = nearest;
      best = pos;
    }
  }
  return best;
}

// Find the slot a dragged tile should snap into, given the tile's center and
// the slot centers. Returns the slot index when a matching, unfilled slot is
// within snapDistance; otherwise null. For duplicate letters, the nearest
// unfilled slot with the matching letter wins.
export function findSnapSlot(tileLetter, tileCenter, slots, snapDistance) {
  let best = null;
  let bestDist = Infinity;
  for (const slot of slots) {
    if (slot.filled) continue;
    if (slot.letter !== tileLetter) continue;
    const d = distance(tileCenter, slot.center);
    if (d <= snapDistance && d < bestDist) {
      best = slot.index;
      bestDist = d;
    }
  }
  return best;
}

export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function overlapsAny(pos, existing, minGap) {
  for (const e of existing) {
    if (distance(pos, e) < minGap) return true;
  }
  return false;
}

function shuffledIndices(n, rng) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}