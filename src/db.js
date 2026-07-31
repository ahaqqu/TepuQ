import { DB_NAME, DB_VERSION, DEFAULT_SETTINGS, STARTER_OBJECTS } from './config.js';

let db = null;

export async function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('objects')) {
        d.createObjectStore('objects', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!d.objectStoreNames.contains('meta')) {
        d.createObjectStore('meta', { keyPath: 'key' });
      }
    };
  });
}

export async function seedDefaults() {
  const tx = db.transaction(['objects', 'settings', 'meta'], 'readwrite');
  const objStore = tx.objectStore('objects');
  STARTER_OBJECTS.forEach((s, i) => {
    const id = 'obj_' + String(i + 1).padStart(3, '0');
    objStore.put({
      id,
      name: s.name,
      ttsText: s.name,
      color: s.color,
      animation: 'random',
      imageBlob: null,
      audioBlob: null,
      useRecording: false,
      audioType: 'tts',
      active: true,
      order: i,
      keyBindings: [],
    });
  });
  tx.objectStore('settings').put({ key: 'settings', ...DEFAULT_SETTINGS });
  tx.objectStore('meta').put({ key: 'meta', version: '3.0', lastModified: Date.now() });
  return txComplete(tx);
}

export async function loadData() {
  const [objs, sets] = await Promise.all([getAllObjects(), getSettings()]);
  if (objs.length === 0) {
    await seedDefaults();
    return loadData();
  }
  const settings = { ...DEFAULT_SETTINGS, ...sets };
  return { objects: objs, settings };
}

function txComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getAllObjects() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['objects'], 'readonly');
    const store = tx.objectStore('objects');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export function getSettings() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['settings'], 'readonly');
    const req = tx.objectStore('settings').get('settings');
    req.onsuccess = () => {
      const s = req.result || {};
      delete s.key;
      resolve(s);
    };
    req.onerror = () => reject(req.error);
  });
}

export function putObject(obj) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['objects'], 'readwrite');
    const req = tx.objectStore('objects').put(obj);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function putSettings(s) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['settings'], 'readwrite');
    const payload = { key: 'settings', ...s };
    const req = tx.objectStore('settings').put(payload);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function deleteObject(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['objects'], 'readwrite');
    const req = tx.objectStore('objects').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function putMeta(meta) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['meta'], 'readwrite');
    const req = tx.objectStore('meta').put({ key: 'meta', ...meta });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function getMeta() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['meta'], 'readonly');
    const req = tx.objectStore('meta').get('meta');
    req.onsuccess = () => resolve(req.result || {});
    req.onerror = () => reject(req.error);
  });
}
