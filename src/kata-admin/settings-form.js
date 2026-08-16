// Kata admin settings form: letter/slot size, snap distance, session length,
// distractor toggle, letter-speech toggle, language. TTS rate/pitch/volume
// are NOT here — they're shared via Gambar's speech settings. See ADR 0003.
// Since v7 the word list is the shared object library (managed in the shared
// admin editor), so this form only manages Kata settings.

import { KATA_DEFAULT_SETTINGS } from '../config.js';
import { putKataSettings } from '../db.js';
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