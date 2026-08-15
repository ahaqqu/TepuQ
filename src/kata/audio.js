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

// Short pleasant two-note chime via Web Audio API.
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