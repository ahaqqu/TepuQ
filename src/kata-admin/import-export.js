// Kata ZIP export/import: a separate tariq-style archive containing
// kata-words.json, kata-settings.json, and an audio/kata/ folder for custom
// word audio. Mirrors src/admin/import-export.js's pattern but for kata_words.
// Only custom words are exported (starter words are bundled, like Gambar).

import { getAllKataWords, getKataSettings, putKataSettings, putKataWord, clearKataWords, initDB } from '../db.js';
import { extFromBlob, showToast } from '../utils.js';
import { KATA_DEFAULT_SETTINGS } from '../config.js';
import { mergeImportedWords } from './merge-words.js';

export async function exportKataZip() {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error('JSZip not loaded');
  const zip = new JSZip();
  const words = await getAllKataWords();
  const settings = await getKataSettings();
  const customWords = words.filter((w) => w.source === 'custom');

  const config = {
    version: '1.0',
    exportMode: 'custom-only',
    settings: { ...settings },
    words: customWords.map((w) => ({
      id: w.id,
      word: w.word,
      display: w.display,
      category: w.category,
      order: w.order,
      enabled: w.enabled,
      audio: w.audioBlob ? `audio/kata/${w.id}.${extFromBlob(w.audioBlob) || 'webm'}` : '',
      useRecording: !!w.useRecording,
      audioType: w.useRecording && w.audioBlob ? 'recording' : 'tts',
      source: w.source || 'custom',
    })),
  };
  zip.file('kata-words.json', JSON.stringify(config, null, 2));

  const audioFolder = zip.folder('audio')?.folder('kata');
  for (const w of customWords) {
    if (w.audioBlob) {
      const ext = extFromBlob(w.audioBlob) || 'webm';
      audioFolder?.file(`${w.id}.${ext}`, w.audioBlob);
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  window.saveAs(blob, 'tariq-data.zip');
  showToast('ZIP Kata diunduh');
}

export async function importKataZip(file) {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error('JSZip not loaded');
  const zip = await JSZip.loadAsync(file);
  const cfgFile = zip.file('kata-words.json') || zip.file('config.json');
  if (!cfgFile) throw new Error('kata-words.json tidak ditemukan di ZIP');
  const config = JSON.parse(await cfgFile.async('text'));
  if (!config.words || !Array.isArray(config.words)) throw new Error('kata-words.json tidak valid');

  const imported = [];
  for (const w of config.words) {
    if (!w.id || typeof w.id !== 'string' || w.id.includes('/') || w.id.includes('\\')) {
      throw new Error('ID kata tidak valid: ' + (w.id || '?'));
    }
    const audioExt = sanitizeExt(w.audio ? w.audio.split('.').pop() : 'webm');
    const audioFile = zip.file(`audio/kata/${w.id}.${audioExt}`);
    imported.push({
      id: w.id,
      word: (w.word || '').toLowerCase(),
      display: w.display || w.word,
      category: w.category || 'default',
      order: typeof w.order === 'number' ? w.order : imported.length,
      enabled: w.enabled !== false,
      audioBlob: audioFile ? await audioFile.async('blob') : null,
      useRecording: !!w.useRecording,
      audioType: w.audioType || 'tts',
      source: w.source || 'custom',
    });
  }

  const existing = await getAllKataWords();
  const merged = mergeImportedWords(existing, imported);

  const db = await initDB();
  const tx = db.transaction(['kata_words', 'kata_settings'], 'readwrite');
  tx.objectStore('kata_words').clear();
  merged.forEach((w) => tx.objectStore('kata_words').put(w));
  const settings = config.settings || {};
  const hasSettings = Object.keys(settings).length > 0;
  tx.objectStore('kata_settings').put({
    key: 'kata_settings',
    ...(hasSettings ? settings : KATA_DEFAULT_SETTINGS),
    _source: hasSettings ? 'user' : 'default',
  });
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function sanitizeExt(ext) {
  if (!ext) return '';
  const clean = ext.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean || '';
}