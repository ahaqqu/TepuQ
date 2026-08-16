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
  playTrumpetFanfare(now);
  playFireworkCrackles(now + 1.1);
}

// Brass/trumpet-style triumphant fanfare.
function playTrumpetFanfare(startTime) {
  const base = 261.63; // C4
  const notes = [
    { n: base, d: 0.35 },
    { n: base * 1.5, d: 0.35 }, // G4
    { n: base * 2, d: 0.55 },   // C5
    { n: base * 2 * 1.25, d: 0.8 }, // E5
  ];
  let t = startTime;
  notes.forEach(({ n, d }) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = n;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + d + 0.05);
    t += d;
  });
}

// Crackling firework sparkle sounds layered after the fanfare.
function playFireworkCrackles(startTime) {
  const crackleCount = 8;
  for (let i = 0; i < crackleCount; i++) {
    const t = startTime + i * 0.13;
    // White-noise burst via band-limited noise approximation.
    const bufferSize = audioCtx.sampleRate * 0.18;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) {
      data[j] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    noise.connect(gain).connect(audioCtx.destination);
    noise.start(t);
    noise.stop(t + 0.18);

    // A tiny sparkle ping on top of each crackle.
    const ping = audioCtx.createOscillator();
    const pingGain = audioCtx.createGain();
    ping.type = 'sine';
    ping.frequency.value = 1046.5 + (Math.random() * 800);
    pingGain.gain.setValueAtTime(0.0001, t + 0.02);
    pingGain.gain.exponentialRampToValueAtTime(0.1, t + 0.03);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    ping.connect(pingGain).connect(audioCtx.destination);
    ping.start(t + 0.02);
    ping.stop(t + 0.13);
  }
}