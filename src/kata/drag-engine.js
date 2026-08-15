// Touch + mouse drag-and-drop for TepuQ Kata letter tiles, with magnetic snap
// to the correct slot and bounce-back on a wrong/free drop.
//
// Design notes (see ADR 0003):
// - Only the primary touch is tracked; multi-touch is ignored (toddler-safe).
// - A tile snaps into the nearest unfilled slot whose letter matches and whose
//   center is within settings.snapDistance. Wrong slots reject with a shake.
// - preventDefault() is called on touch events to stop scroll/zoom/context
//   menus, but only for tile touches — never for admin/form elements.
// - All coordinate math is in container-relative pixels so layout is stable
//   across viewport sizes.

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
  let startX = 0;
  let startY = 0;
  let dragging = false;

  const onPointerDown = (e) => {
    if (active) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (pointerId !== null && pointerId !== e.pointerId) return; // primary touch only
    active = true;
    pointerId = e.pointerId;
    dragging = false;
    startX = e.clientX;
    startY = e.clientY;
    tileEl.setPointerCapture?.(e.pointerId);
    tileEl.classList.add('dragging');
    tileEl.style.zIndex = '50';
    if (e.cancelable) e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!active || e.pointerId !== pointerId) return;
    if (e.cancelable) e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging && Math.hypot(dx, dy) > 4) {
      dragging = true;
    }
    if (dragging) {
      tileEl.style.transform = `translate(${dx}px, ${dy}px) scale(${DRAG_SCALE})`;
    }
  };

  const onPointerUp = (e) => {
    if (!active || e.pointerId !== pointerId) return;
    active = false;
    pointerId = null;
    tileEl.classList.remove('dragging');
    if (e.cancelable) e.preventDefault();

    if (!dragging) {
      tileEl.style.transform = '';
      tileEl.style.zIndex = '';
      return;
    }
    dragging = false;

    const tileLetter = tileEl.dataset.letter;
    const tileRect = tileEl.getBoundingClientRect();
    const tileCenter = {
      x: tileRect.left + tileRect.width / 2,
      y: tileRect.top + tileRect.height / 2,
    };
    const slots = getSlots();
    const snapIndex = findSnapSlot(tileLetter, tileCenter, slots, snapDistance());
    if (snapIndex !== null) {
      onSnap(Number(tileEl.dataset.tileIndex), snapIndex);
    } else {
      onReject(Number(tileEl.dataset.tileIndex));
    }
  };

  tileEl.addEventListener('pointerdown', onPointerDown);
  tileEl.addEventListener('pointermove', onPointerMove);
  tileEl.addEventListener('pointerup', onPointerUp);
  tileEl.addEventListener('pointercancel', onPointerUp);

  const onContextMenu = (e) => e.preventDefault();
  tileEl.addEventListener('contextmenu', onContextMenu);

  return () => {
    tileEl.removeEventListener('pointerdown', onPointerDown);
    tileEl.removeEventListener('pointermove', onPointerMove);
    tileEl.removeEventListener('pointerup', onPointerUp);
    tileEl.removeEventListener('pointercancel', onPointerUp);
    tileEl.removeEventListener('contextmenu', onContextMenu);
  };
}

// Animate a tile back to its origin (wrong/free drop) with a shake.
export function bounceBack(tileEl) {
  tileEl.classList.add('shake');
  tileEl.style.transform = '';
  tileEl.style.zIndex = '';
  setTimeout(() => tileEl.classList.remove('shake'), 420);
}

// Animate a tile snapping into a slot center (container-relative coordinates).
export function snapToSlot(tileEl, slotCenter, containerRect) {
  const tileRect = tileEl.getBoundingClientRect();
  const currentLeft = tileRect.left - containerRect.left;
  const currentTop = tileRect.top - containerRect.top;
  const targetLeft = slotCenter.x - tileRect.width / 2;
  const targetTop = slotCenter.y - tileRect.height / 2;
  const dx = targetLeft - currentLeft;
  const dy = targetTop - currentTop;
  tileEl.classList.add('snapped');
  tileEl.style.transform = `translate(${dx}px, ${dy}px)`;
  tileEl.style.zIndex = '';
}

export { distance };