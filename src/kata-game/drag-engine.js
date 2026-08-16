// Touch + mouse drag-and-drop for TepuQ Kata letter tiles, with magnetic snap
// to the correct slot.
//
// The tile is positioned with left/top (container-relative px). During a drag
// we update left/top directly every pointermove, so there is never a transform
// offset to reconcile on release — no glitch, no revert. Only scale() is used
// for the drag-grow visual, which doesn't affect position math.
//
// Design notes (see ADR 0003):
// - Only the primary touch is tracked; multi-touch is ignored (toddler-safe).
// - A tile snaps into the nearest unfilled slot whose letter matches and whose
//   center is within settings.snapDistance.
// - On a free drop (no slot nearby) the tile stays where it was released.
// - preventDefault() stops scroll/zoom/context menus on tile touches.

import { findSnapSlot, distance } from './slots.js';

const DRAG_SCALE = 1.1;

// Bind drag handling onto a tile element.
//   getSlots() -> [{index, letter, center:{x,y}, filled}], the live slot list.
//   snapDistance() -> number, the current snap threshold in px.
//   onSnap(tileIndex, slotIndex) and onReject(tileIndex) -> game callbacks.
// Returns a cleanup function.
export function bindDrag(tileEl, opts) {
  const { container, getSlots, snapDistance, onSnap, onReject } = opts;
  let active = false;
  let pointerId = null;
  // Pointer offset from the tile's top-left at grab time, so the tile follows
  // the finger naturally without jumping to center on the cursor.
  let grabOffsetX = 0;
  let grabOffsetY = 0;
  let dragging = false;

  const onPointerDown = (e) => {
    if (active) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (pointerId !== null && pointerId !== e.pointerId) return;
    active = true;
    pointerId = e.pointerId;
    dragging = false;
    // Where on the tile did the finger/cursor land?
    const tileRect = tileEl.getBoundingClientRect();
    grabOffsetX = e.clientX - tileRect.left;
    grabOffsetY = e.clientY - tileRect.top;
    tileEl.setPointerCapture?.(e.pointerId);
    tileEl.style.zIndex = '50';
    if (e.cancelable) e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!active || e.pointerId !== pointerId) return;
    if (e.cancelable) e.preventDefault();
    const dx = e.clientX - (tileRectSnapshot.left + grabOffsetX);
    const dy = e.clientY - (tileRectSnapshot.top + grabOffsetY);
    if (!dragging && Math.hypot(dx, dy) > 4) {
      dragging = true;
      tileEl.classList.add('dragging');
    }
    if (dragging) {
      // Move the tile by updating left/top directly (container-relative).
      const cRect = container.getBoundingClientRect();
      const newLeft = e.clientX - cRect.left - grabOffsetX;
      const newTop = e.clientY - cRect.top - grabOffsetY;
      tileEl.style.left = `${newLeft}px`;
      tileEl.style.top = `${newTop}px`;
      tileEl.style.transform = `scale(${DRAG_SCALE})`;
    }
  };

  // Snapshot the tile rect at pointer-down so we can compute a movement
  // threshold before committing to a drag.
  let tileRectSnapshot = { left: 0, top: 0 };

  const onPointerDownWithSnapshot = (e) => {
    const r = tileEl.getBoundingClientRect();
    tileRectSnapshot = { left: r.left, top: r.top };
    onPointerDown(e);
  };

  const onPointerUp = (e) => {
    if (!active || e.pointerId !== pointerId) return;
    active = false;
    pointerId = null;
    if (e.cancelable) e.preventDefault();

    if (!dragging) {
      // A tap (no drag): clear any scale, leave the tile where it is.
      tileEl.style.transform = '';
      tileEl.style.zIndex = '';
      tileEl.classList.remove('dragging');
      return;
    }
    dragging = false;
    tileEl.classList.remove('dragging');
    tileEl.style.transform = ''; // clear the drag scale

    // The tile is already at the released position (left/top was updated live).
    // Now decide snap vs free-drop using its current center.
    const tileLetter = tileEl.dataset.letter;
    const tileRect = tileEl.getBoundingClientRect();
    const tileCenter = {
      x: tileRect.left + tileRect.width / 2,
      y: tileRect.top + tileRect.height / 2,
    };
    const snapIndex = findSnapSlot(tileLetter, tileCenter, getSlots(), snapDistance());
    if (snapIndex !== null) {
      onSnap(Number(tileEl.dataset.tileIndex), snapIndex);
    } else {
      onReject(Number(tileEl.dataset.tileIndex));
    }
  };

  tileEl.addEventListener('pointerdown', onPointerDownWithSnapshot);
  tileEl.addEventListener('pointermove', onPointerMove);
  tileEl.addEventListener('pointerup', onPointerUp);
  tileEl.addEventListener('pointercancel', onPointerUp);

  const onContextMenu = (e) => e.preventDefault();
  tileEl.addEventListener('contextmenu', onContextMenu);

  return () => {
    tileEl.removeEventListener('pointerdown', onPointerDownWithSnapshot);
    tileEl.removeEventListener('pointermove', onPointerMove);
    tileEl.removeEventListener('pointerup', onPointerUp);
    tileEl.removeEventListener('pointercancel', onPointerUp);
    tileEl.removeEventListener('contextmenu', onContextMenu);
  };
}

// Move a tile to a slot's center (container-relative coordinates). Updates
// left/top directly and clears transform so there is no position/transform
// mismatch to cause a revert or glitch.
export function snapToSlot(tileEl, slotCenter, containerRect) {
  const tileRect = tileEl.getBoundingClientRect();
  const targetLeft = slotCenter.x - tileRect.width / 2;
  const targetTop = slotCenter.y - tileRect.height / 2;
  tileEl.classList.add('snapped');
  tileEl.style.left = `${targetLeft}px`;
  tileEl.style.top = `${targetTop}px`;
  tileEl.style.transform = '';
  tileEl.style.zIndex = '';
}

export { distance };