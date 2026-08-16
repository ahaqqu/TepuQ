// TepuQ Kata audio: speak a letter, speak a word, play a per-word custom
// recording, and play a success chime / victory fanfare. TTS rate/pitch/volume
// come from the shared speech settings via src/speech.js so both games share
// one voice (see ADR 0003 / the settings decision). The chime and the fanfare
// are bundled Mixkit sound effects (see docs/assets-sources.md) played through
// plain <audio> elements, so no Web Audio API is needed in Kata.

import { speak, playRecording, unlockSpeechForGameplay } from '../speech.js';

export async function initKataAudio() {
  unlockSpeechForGameplay();
}

// Playful "boing" (Mixkit, see docs/assets-sources.md) played when a letter is
// dropped outside a target: a friendly nudge that says "bounce back and try
// again" without sounding like an error buzzer. Shared with TepuQ Target.
export { playTryAgainSfx as playEncourageSfx } from '../speech.js';

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

let successAudio = null;
let victoryAudio = null;

// Short pleasant bell when a word is completed.
export function playSuccessChime() {
  try {
    if (!successAudio) {
      successAudio = new Audio('assets/sfx/success-chime.mp3');
      successAudio.volume = 0.8;
    }
    successAudio.currentTime = 0;
    successAudio.play().catch(() => {});
  } catch {
    // Audio is decorative; never let it break the celebration flow.
  }
}

// Bigger celebratory fanfare when the child finishes the whole session.
export function playVictoryChime() {
  try {
    if (!victoryAudio) {
      victoryAudio = new Audio('assets/sfx/victory-fanfare.mp3');
      victoryAudio.volume = 0.9;
    }
    victoryAudio.currentTime = 0;
    victoryAudio.play().catch(() => {});
  } catch {
    // Audio is decorative; never let it break the win screen.
  }
}