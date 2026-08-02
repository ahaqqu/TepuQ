let idVoice = null;
let voiceRetryTimer = null;
let speechUnlocked = false;

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
function unlockSpeech() {
  const synth = window.speechSynthesis;
  if (!synth || speechUnlocked) return;
  speechUnlocked = true;
  try {
    const warmup = new SpeechSynthesisUtterance(' ');
    warmup.volume = 0;
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
  const onGesture = () => {
    unlockSpeech();
    loadVoices();
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('touchstart', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
  };
  window.addEventListener('pointerdown', onGesture, true);
  window.addEventListener('touchstart', onGesture, true);
  window.addEventListener('keydown', onGesture, true);
}

function startUtterance(u) {
  const synth = window.speechSynthesis;
  // Chrome can get stuck in a paused state after cancel(); resume unsticks
  // it. Only resume when actually paused — iOS Safari can break speech if
  // resume() is called while the engine is already running.
  if (synth.paused) synth.resume();
  synth.speak(u);
}

export function speak(text, settings = {}) {
  if (!window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  if (!text) {
    synth.cancel();
    return;
  }
  loadVoices();
  const u = new SpeechSynthesisUtterance(text);
  // Only force Indonesian when an Indonesian voice is installed; otherwise
  // some browsers (e.g. Chrome Android) stay silent when lang has no match.
  // The voice itself is not assigned explicitly: iOS Safari can silently
  // drop utterances carrying a voice reference, so let the browser
  // auto-select from lang instead.
  if (idVoice) {
    u.lang = 'id-ID';
  }
  u.rate = settings.speechRate ?? 0.95;
  u.pitch = settings.speechPitch ?? 1.25;
  u.volume = settings.volume ?? 0.8;

  if (synth.speaking) {
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
