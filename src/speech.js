let idVoice = null;
let voiceRetryTimer = null;

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

export function initSpeech() {
  const synth = window.speechSynthesis;
  if (!synth) return;
  loadVoices();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
  }
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
  if (idVoice) {
    u.lang = 'id-ID';
    u.voice = idVoice;
  }
  u.rate = settings.speechRate ?? 0.95;
  u.pitch = settings.speechPitch ?? 1.25;
  u.volume = settings.volume ?? 0.8;

  const start = () => {
    // Chrome can get stuck in a paused state after cancel(); resume unsticks it.
    synth.resume();
    synth.speak(u);
  };

  if (synth.speaking || synth.pending) {
    // iOS Safari swallows a speak() called synchronously right after
    // cancel(), so let the cancel finish before starting the new utterance.
    synth.cancel();
    setTimeout(start, 50);
  } else {
    start();
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
