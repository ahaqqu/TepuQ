import { initDB, loadData, getAllObjects, getSettings, putObject, putSettings, putMeta, deleteObject, getMeta } from '../db.js';
import { extFromBlob, placeholderToBlob, showToast, keyStringToBindings } from '../utils.js';
import { DEFAULT_SETTINGS } from '../config.js';

export async function exportZip(objects, settings) {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error('JSZip not loaded');
  const zip = new JSZip();
  const config = {
    version: '3.0',
    settings: { ...settings },
    objects: objects.map((o) => ({
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
  for (const o of objects) {
    if (o.imageBlob) {
      const ext = extFromBlob(o.imageBlob) || 'png';
      imgFolder.file(`${o.id}.${ext}`, o.imageBlob);
    } else {
      const png = await placeholderToBlob(o);
      imgFolder.file(`${o.id}.png`, png);
    }
    if (o.audioBlob) {
      const ext = extFromBlob(o.audioBlob) || 'webm';
      audioFolder.file(`${o.id}.${ext}`, o.audioBlob);
    }
  }
  const content = await zip.generateAsync({ type: 'blob' });
  window.saveAs(content, 'tepuq-data.zip');
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
      imageBlob: imgFile ? await imgFile.async('blob') : null,
      audioBlob: audioFile ? await audioFile.async('blob') : null,
      useRecording: !!o.useRecording,
      audioType: o.audioType || 'tts',
      active: o.active !== false,
      order: typeof o.order === 'number' ? o.order : imported.length,
      keyBindings: (o.keyBindings || []).map((k) => k.toString().toLowerCase()),
    });
  }

  const db = await initDB();
  const tx = db.transaction(['objects', 'settings', 'meta'], 'readwrite');
  tx.objectStore('objects').clear();
  imported.forEach((o) => tx.objectStore('objects').put(o));
  tx.objectStore('settings').put({ key: 'settings', ...(config.settings || {}) });
  tx.objectStore('meta').put({ key: 'meta', version: config.version || '3.0', lastModified: Date.now() });
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
