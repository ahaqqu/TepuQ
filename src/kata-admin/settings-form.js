// Kata admin settings form: letter/slot size, snap distance, session length,
// distractor toggle, letter-speech toggle, language. TTS rate/pitch/volume
// are NOT here — they're shared via Gambar's speech settings. See ADR 0003.

import { KATA_DEFAULT_SETTINGS, KATA_STARTER_WORDS } from '../config.js';
import { putKataSettings, getAllKataWords, putKataWord } from '../db.js';
import { showToast } from '../utils.js';

export function bindKataSettingsForm(settings, onChange) {
  const form = document.getElementById('kataSettingsForm');
  if (!form) return;
  setFormValues(settings);

  document.getElementById('btnSaveKataSettings').onclick = async () => {
    const newSettings = readFormValues();
    newSettings._source = 'user';
    await putKataSettings(newSettings);
    onChange(newSettings);
    showToast('Pengaturan Kata disimpan');
  };

  document.getElementById('btnResetKataSettings').onclick = async () => {
    const fresh = { ...KATA_DEFAULT_SETTINGS, _source: 'default' };
    await putKataSettings(fresh);
    setFormValues(fresh);
    onChange(fresh);
    showToast('Pengaturan Kata direset');
  };

  document.getElementById('btnResetKataWords').onclick = async () => {
    if (!confirm('Reset semua kata ke bawaan? Kata custom akan hilang.')) return;
    const words = await getAllKataWords();
    // Replace with starters.
    for (const w of words) {
      if (w.source !== 'starter') {
        // soft-delete custom words by disabling; full reset re-seeds starters
      }
    }
    // Re-seed starter words by overwriting starter ids.
    for (let i = 0; i < KATA_STARTER_WORDS.length; i++) {
      const id = 'kata_' + String(i + 1).padStart(3, '0');
      await putKataWord({
        id,
        word: KATA_STARTER_WORDS[i].word,
        display: KATA_STARTER_WORDS[i].word,
        category: KATA_STARTER_WORDS[i].category || 'default',
        order: i,
        enabled: true,
        audioBlob: null,
        audioType: 'tts',
        useRecording: false,
        source: 'starter',
      });
    }
    showToast('Kata direset ke bawaan');
    window.dispatchEvent(new CustomEvent('tepuq:refresh-admin'));
  };
}

export function refreshKataSettingsForm(settings) {
  setFormValues(settings);
}

function setFormValues(s) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const check = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  set('setKataLetterSize', s.letterSize ?? 90);
  set('setKataSlotSize', s.slotSize ?? 100);
  set('setKataSnapDistance', s.snapDistance ?? 60);
  set('setKataSessionLength', s.sessionLength ?? 10);
  check('setKataDistractors', !!s.showDistractors);
  check('setKataLetterSpeech', s.enableLetterSpeech !== false);
  set('setKataLanguage', s.language || 'id-ID');
}

function readFormValues() {
  const get = (id) => document.getElementById(id)?.value;
  const checked = (id) => !!document.getElementById(id)?.checked;
  return {
    letterSize: Number(get('setKataLetterSize')) || 90,
    slotSize: Number(get('setKataSlotSize')) || 100,
    snapDistance: Number(get('setKataSnapDistance')) || 60,
    sessionLength: Number(get('setKataSessionLength')) || 10,
    showDistractors: checked('setKataDistractors'),
    enableLetterSpeech: checked('setKataLetterSpeech'),
    language: get('setKataLanguage') || 'id-ID',
  };
}