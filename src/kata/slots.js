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
export function scatterLetters(word, area, tileSize, rng = Math.random) {
  const letters = (word || '').toLowerCase().split('');
  const positions = [];
  const pad = tileSize * 0.5;
  const minX = pad;
  const maxX = Math.max(minX, area.width - tileSize - pad);
  const minY = pad;
  const maxY = Math.max(minY, area.height - tileSize - pad);

  const order = shuffledIndices(letters.length, rng);
  for (let i = 0; i < letters.length; i++) {
    let pos;
    let attempts = 0;
    do {
      pos = {
        x: minX + rng() * (maxX - minX),
        y: minY + rng() * (maxY - minY),
      };
      attempts++;
    } while (attempts < 60 && overlapsAny(pos, positions, tileSize * 1.15));
    positions.push(pos);
  }

  // Reorder positions back to tile order so positions[i] is tile i's start.
  const ordered = new Array(positions.length);
  order.forEach((tileIndex, scatterIndex) => {
    ordered[tileIndex] = positions[scatterIndex];
  });
  return ordered;
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