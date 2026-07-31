import { initDB, loadData, getAllObjects, getSettings, putObject, putSettings, putMeta, deleteObject, getMeta } from '../db.js';
import { extFromBlob, placeholderToBlob, showToast, keyStringToBindings } from '../utils.js';
import { DEFAULT_SETTINGS } from '../config.js';

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
    const imgExt = o.image ? o.image.split('.').pop() : 'png';
    const audioExt = o.audio ? o.audio.split('.').pop() : 'webm';
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
      order: typeof o.order === 'number' ? o.order : imported.length,
      keyBindings: (o.keyBindings || []).map((k) => k.toString().toLowerCase()),
      source: o.source || 'custom',
    });
  }

  // Merge imported custom objects with the current default starter objects.
  // Matching by id first, then by normalized name, keeps defaults intact and
  // only replaces/updates objects the user actually customized.
  const existing = await getAllObjects();
  const existingById = Object.fromEntries(existing.map((o) => [o.id, o]));
  const existingByName = Object.fromEntries(existing.map((o) => [normalizeImportKey(o.name), o]));

  const merged = [];
  for (const o of existing) {
    const importedById = imported.find((i) => i.id === o.id);
    const importedByName = imported.find((i) => normalizeImportKey(i.name) === normalizeImportKey(o.name));
    const custom = importedById || importedByName;
    if (custom) {
      merged.push({
        ...o,
        name: custom.name,
        ttsText: custom.ttsText,
        color: custom.color,
        animation: custom.animation,
        imageUrl: custom.imageBlob ? null : o.imageUrl,
        imageBlob: custom.imageBlob || o.imageBlob,
        imageSource: custom.imageBlob || o.imageBlob ? 'custom' : 'starter',
        audioBlob: custom.audioBlob || o.audioBlob,
        useRecording: custom.audioBlob ? custom.useRecording : (o.audioBlob ? o.useRecording : false),
        audioType: custom.audioBlob ? (custom.useRecording ? 'recording' : 'tts') : o.audioType,
        active: custom.active,
        order: typeof custom.order === 'number' ? custom.order : o.order,
        keyBindings: custom.keyBindings?.length ? custom.keyBindings : o.keyBindings,
        source: 'custom',
      });
    } else {
      merged.push(o);
    }
  }

  // Add any brand-new custom objects that do not match a default.
  for (const i of imported) {
    if (!existingById[i.id] && !existingByName[normalizeImportKey(i.name)]) {
      merged.push({ ...i, source: 'custom' });
    }
  }

  const db = await initDB();
  const tx = db.transaction(['objects', 'settings', 'meta'], 'readwrite');
  tx.objectStore('objects').clear();
  merged.forEach((o) => tx.objectStore('objects').put(o));
  tx.objectStore('settings').put({ key: 'settings', ...(config.settings || {}) });
  tx.objectStore('meta').put({ key: 'meta', version: config.version || '3.0', lastModified: Date.now() });
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function normalizeImportKey(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}
