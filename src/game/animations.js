import { ENTRY_ANIMATIONS, EXIT_ANIMATIONS, SLIDE_DIRECTIONS } from '../config.js';

export function resolveEntryAnimation(obj, settings = {}) {
  const pref = obj?.animation;
  if (pref && pref !== 'random') return pref;
  const global = settings.globalEntryAnimation;
  if (global && global !== 'random') return global;
  return ENTRY_ANIMATIONS[Math.floor(Math.random() * ENTRY_ANIMATIONS.length)];
}

export function resolveExitAnimation(settings = {}) {
  const global = settings.globalExitAnimation;
  if (global && global !== 'random') return global;
  return EXIT_ANIMATIONS[Math.floor(Math.random() * EXIT_ANIMATIONS.length)];
}

export function addEntryAnimationClasses(card, anim) {
  card.classList.add('anim-' + anim);
  if (anim === 'slide') {
    const dir = SLIDE_DIRECTIONS[Math.floor(Math.random() * SLIDE_DIRECTIONS.length)];
    card.classList.add('anim-slide-' + dir);
  }
}

export function addExitAnimationClasses(card, anim) {
  card.classList.add('exit-' + anim);
  if (anim === 'slide') {
    const dir = SLIDE_DIRECTIONS[Math.floor(Math.random() * SLIDE_DIRECTIONS.length)];
    card.classList.add('exit-slide-' + dir);
  }
}
