const FS_ENABLED = document.fullscreenEnabled || document.webkitFullscreenEnabled;

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export async function enterFullscreen(element = document.documentElement) {
  if (!FS_ENABLED || isFullscreen()) return true;
  const target = element || document.documentElement;
  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: 'hide' });
    } else if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('TepuQ: fullscreen failed', err && err.message);
    return false;
  }
}

export async function exitFullscreen() {
  if (!isFullscreen()) return true;
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      await document.webkitExitFullscreen();
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('TepuQ: exit fullscreen failed', err && err.message);
    return false;
  }
}

export async function lockPointer(element = document.body) {
  const el = element || document.body;
  if (document.pointerLockElement === el) return true;
  if (!('requestPointerLock' in el)) return false;
  try {
    await el.requestPointerLock();
    return true;
  } catch (err) {
    return false;
  }
}

export async function unlockPointer() {
  if (!('pointerLockElement' in document)) return true;
  if (!document.pointerLockElement) return true;
  try {
    document.exitPointerLock();
    return true;
  } catch (err) {
    return false;
  }
}

export function onFullscreenChange(callback) {
  const handler = () => callback(isFullscreen());
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}

export function warnIfKioskBlocked() {
  // Browser shortcuts we cannot trap (Alt+Tab, Ctrl+W, OS gestures, touchpad 3/4 fingers).
  // On Android/iOS PWA / added-to-homescreen, fullscreen is most reliable.
  if (FS_ENABLED) return null;
  return 'Layar penuh tidak didukung browser ini. Tambahkan ke layar utama untuk mode anti-senggol terbaik.';
}
