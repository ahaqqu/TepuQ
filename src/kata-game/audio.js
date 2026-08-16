// TepuQ Kata audio: speak a letter, speak a word, play a per-word custom
// recording, and play a success chime. TTS rate/pitch/volume come from the
// shared speech settings via src/speech.js so both games share one voice
// (see ADR 0003 / the settings decision). The success chime uses the Web Audio
// API oscillator + gain, consistent with the vibe-prompt spec.

import { speak, playRecording, unlockAudioContext, unlockSpeechForGameplay } from '../speech.js';

let audioCtx = null;

export async function initKataAudio() {
  await unlockAudioContext();
  unlockSpeechForGameplay();
}

// Speak a single letter. Indonesian TTS reads isolated letters acceptably.
export function speakLetter(letter, speechSettings) {
  if (!letter) return;
  speak(letter.toLowerCase(), speechSettings);
}

// Speak the full completed word.
export function speakWord(wordRecord, speechSettings) {
  if (!wordRecord) return;
  if (wordRecord.useRecording && wordRecord.audioBlob) {
    playRecording(wordRecord.audioBlob);
  } else {
    speak(wordRecord.word, speechSettings);
  }
}

// Short pleasant three-note chime via Web Audio API.
export function playSuccessChime() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  const now = audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.26);
  });
}

// Bigger celebratory fanfare when the child finishes the whole session.
export function playVictoryChime() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  const now = audioCtx.currentTime;
  // A cheerful C-major arpeggio plus a final C6 sparkle.
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = i === 3 ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.14;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.46);
  });
}