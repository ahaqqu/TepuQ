let idVoice = null;
let voiceRetryTimer = null;
let speechUnlocked = false;
let gestureCleanup = null;
let audioCtx = null;

export async function unlockAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch { /* ignore */ }
  }
}

function loadVoices() {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const voices = synth.getVoices();
  idVoice = voices.find((v) => v.lang.toLowerCase().startsWith('id')) || null;
  // iOS Safari loads voices lazily and can return an empty list for a long
  // time after page load. Keep retrying so the Indonesian voice is found
  // as soon as it becomes available.
  if (!idVoice && voices.length === 0 && !voiceRetryTimer) {
    voiceRetryTimer = setTimeout(() => {
      voiceRetryTimer = null;
      loadVoices();
    }, 300);
  }
}

// iOS Safari silently drops every utterance until the first speak() happens
// inside a real user gesture; until then speech is suppressed with no events
// and no errors. A muted, nearly-empty utterance on the first pointerdown /
// touch / keydown creates the trusted session without making a sound, so all
// later speaks (including auto-smash timers) are allowed to play.
//
// We only mark speech as unlocked once WebKit fires the 'start' event.
function unlockSpeech() {
  const synth = window.speechSynthesis;
  if (!synth || speechUnlocked) return;
  try {
    const warmup = new SpeechSynthesisUtterance(' ');
    warmup.volume = 0;
    warmup.rate = 10;
    warmup.onstart = () => {
      speechUnlocked = true;
    };
    synth.speak(warmup);
  } catch {
    // ignore
  }
}

export function initSpeech() {
  const synth = window.speechSynthesis;
  if (!synth) return;
  loadVoices();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
  }
}

// Unlock iOS speech from a real gameplay gesture. Called once when the user
// starts a game mode (taps a mode button), so TTS works during gameplay without
// us trying to speak on the mode picker screen.
export function unlockSpeechForGameplay() {
  unlockSpeech();
  loadVoices();
}

function startUtterance(u) {
  const synth = window.speechSynthesis;
  // Chrome can get stuck in a paused state after cancel(); resume unsticks
  // it. Only resume when actually paused — iOS Safari can break speech if
  // resume() is called while the engine is already running.
  if (synth.paused) synth.resume();
  synth.speak(u);
}

export function speak(text, settings = {}, onEnd) {
  if (!window.speechSynthesis) {
    // No TTS available: let the caller know immediately so nothing that
    // depends on the utterance (e.g. a delayed sound) is skipped.
    if (typeof onEnd === 'function') onEnd();
    return;
  }
  const synth = window.speechSynthesis;
  if (!text) {
    synth.cancel();
    return;
  }
  loadVoices();
  const u = new SpeechSynthesisUtterance(text);
  if (typeof onEnd === 'function') {
    u.onend = onEnd;
  }
  // Always tell the browser the text is Indonesian. On iOS Safari this is
  // required for it to pick an appropriate voice; on other platforms the
  // browser falls back to its default voice when no Indonesian voice is
  // installed.
  u.lang = 'id-ID';
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('id')) || null;
  if (voice) {
    u.voice = voice;
  }
  u.rate = settings.speechRate ?? 0.95;
  u.pitch = settings.speechPitch ?? 1.25;
  u.volume = settings.volume ?? 0.8;

  if (synth.speaking || synth.pending) {
    // iOS Safari swallows a speak() called synchronously right after
    // cancel(), so let the cancel finish before starting the new utterance.
    synth.cancel();
    setTimeout(() => startUtterance(u), 60);
  } else {
    // Nothing is actually playing: speak synchronously so the call stays
    // inside the user gesture, which iOS requires for the first utterance.
    startUtterance(u);
  }
}

export function stopSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

let tryAgainAudio = null;
let lastTryAgainAt = 0;

// Playful "boing" (Mixkit, see docs/assets-sources.md) shared by both games:
// TepuQ Kata plays it when a letter is dropped outside a target; TepuQ Target
// plays it when the child taps outside the target card. The debounce keeps
// pointer + touch handlers from double-firing on the same tap on mobile.
export function playTryAgainSfx() {
  try {
    const now = Date.now();
    if (now - lastTryAgainAt < 250) return;
    lastTryAgainAt = now;
    if (!tryAgainAudio) {
      tryAgainAudio = new Audio('assets/sfx/try-again.mp3');
      tryAgainAudio.volume = 0.55;
    }
    tryAgainAudio.currentTime = 0;
    tryAgainAudio.play().catch(() => {});
  } catch {
    // Audio is decorative; never let it break input handling.
  }
}

const sfxCache = new Map();
let lastSfxAt = 0;

// Shared decorative SFX player for menu navigation and gameplay sounds
// (selecting a game, going back to the menu, win-screen buttons). Audio is
// cached per URL so rapid taps reuse the same element; the debounce stops
// pointer + touch handlers from double-firing on mobile. Failures are
// swallowed: sound is decorative.
export function playSfx(url, volume = 1) {
  try {
    const now = Date.now();
    if (now - lastSfxAt < 150) return;
    lastSfxAt = now;
    let audio = sfxCache.get(url);
    if (!audio) {
      audio = new Audio(url);
      sfxCache.set(url, audio);
    }
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Audio is decorative; never let it break input handling.
  }
}

export async function playRecording(audioBlob) {
  if (!audioBlob) return;
  const url = URL.createObjectURL(audioBlob);
  try {
    const audio = new Audio(url);
    await audio.play();
    await new Promise((resolve) => {
      audio.onended = resolve;
      audio.onerror = resolve;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function speakOrPlay(obj, settings = {}) {
  if (obj?.useRecording && obj?.audioBlob) {
    playRecording(obj.audioBlob);
  } else {
    speak(obj?.ttsText || obj?.name || '', settings);
  }
}
