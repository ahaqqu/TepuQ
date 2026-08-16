import { initDB, getAllObjects, putSettings, putMeta } from '../db.js';
import { extFromBlob, showToast, keyStringToBindings } from '../utils.js';
import { mergeImportedObjects } from './merge-objects.js';

export async function exportZip(objects, settings) {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error('JSZip not loaded');
  const zip = new JSZip();

  // Only export custom objects (created by the parent). Starter objects
  // are always available OOTB, so there is no need to bundle them and the
  // ZIP stays small.
  const customObjects = objects.filter((o) => o.source === 'custom');

  const config = {
    version: '3.0',
    partial: true,
    exportMode: 'custom-only',
    settings: { ...settings },
    objects: customObjects.map((o) => ({
      id: o.id,
      name: o.name,
      ttsText: o.ttsText,
      color: o.color,
      animation: o.animation,
      image: o.imageBlob ? `images/${o.id}.${extFromBlob(o.imageBlob) || 'png'}` : '',
      audio: o.audioBlob ? `audio/${o.id}.${extFromBlob(o.audioBlob) || 'webm'}` : '',
      useRecording: !!o.useRecording,
      audioType: o.useRecording && o.audioBlob ? 'recording' : 'tts',
      active: o.active,
      kataEnabled: o.kataEnabled,
      order: o.order,
      keyBindings: o.keyBindings || [],
    })),
  };
  zip.file('config.json', JSON.stringify(config, null, 2));

  const imgFolder = zip.folder('images');
  const audioFolder = zip.folder('audio');
  for (const o of customObjects) {
    if (o.imageBlob) {
      const ext = extFromBlob(o.imageBlob) || 'png';
      imgFolder.file(`${o.id}.${ext}`, o.imageBlob);
    }
    if (o.audioBlob) {
      const ext = extFromBlob(o.audioBlob) || 'webm';
      audioFolder.file(`${o.id}.${ext}`, o.audioBlob);
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  window.saveAs(blob, 'tepuq-data.zip');
  showToast('ZIP diunduh');
}

export async function importZip(file) {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error('JSZip not loaded');
  const zip = await JSZip.loadAsync(file);
  const configText = await zip.file('config.json').async('text');
  const config = JSON.parse(configText);
  if (!config.objects || !Array.isArray(config.objects)) throw new Error('config.json tidak valid');

  const imported = [];
  for (const o of config.objects) {
    if (!o.id || typeof o.id !== 'string' || o.id.includes('/') || o.id.includes('\\')) {
      throw new Error('ID objek tidak valid: ' + (o.id || '?'));
    }
    const imgExt = sanitizeExt(o.image ? o.image.split('.').pop() : 'png');
    const audioExt = sanitizeExt(o.audio ? o.audio.split('.').pop() : 'webm');
    const imgFile = zip.file(`images/${o.id}.${imgExt}`);
    const audioFile = zip.file(`audio/${o.id}.${audioExt}`);
    imported.push({
      id: o.id,
      name: o.name,
      ttsText: o.ttsText || o.name,
      color: o.color || '#4A90D9',
      animation: o.animation || 'random',
      imageUrl: null,
      imageBlob: imgFile ? await imgFile.async('blob') : null,
      imageSource: 'custom',
      audioBlob: audioFile ? await audioFile.async('blob') : null,
      useRecording: !!o.useRecording,
      audioType: o.audioType || 'tts',
      active: o.active !== false,
      kataEnabled: o.kataEnabled !== false && !String(o.name || '').trim().includes(' '),
      order: typeof o.order === 'number' ? o.order : imported.length,
      keyBindings: (o.keyBindings || []).map((k) => k.toString().toLowerCase()),
      source: o.source || 'custom',
    });
  }

  const existing = await getAllObjects();
  const merged = mergeImportedObjects(existing, imported);

  const db = await initDB();
  const tx = db.transaction(['objects', 'settings', 'meta'], 'readwrite');
  tx.objectStore('objects').clear();
  merged.forEach((o) => tx.objectStore('objects').put(o));

  const settings = config.settings || {};
  const hasSettings = Object.keys(settings).length > 0;
  tx.objectStore('settings').put({ key: 'settings', ...(hasSettings ? settings : {}), _source: hasSettings ? 'user' : 'default' });
  tx.objectStore('meta').put({ key: 'meta', version: config.version || '3.0', lastModified: Date.now() });
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
