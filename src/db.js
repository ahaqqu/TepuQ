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

async function fetchAssetBlob(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

export async function seedDefaults() {
  // Seed objects immediately so the UI can bootstrap without waiting for assets.
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
      source: s.source || 'starter',
    });
  });
  tx.objectStore('settings').put({ key: 'settings', ...DEFAULT_SETTINGS, _source: 'default' });
  tx.objectStore('meta').put({ key: 'meta', version: '3.0', lastModified: Date.now() });
  await txComplete(tx);

  // Fetch bundled assets in the background and update each object.
  // This keeps first paint fast while still giving real photos/sounds OOTB.
  loadStarterAssets();
  return;
}

async function loadStarterAssets() {
  const objects = await getAllObjects();
  await Promise.all(
    STARTER_OBJECTS.map(async (s, i) => {
      const id = 'obj_' + String(i + 1).padStart(3, '0');
      const existing = objects.find((o) => o.id === id);
      if (!existing) return;
      const imageBlob = s.image ? await fetchAssetBlob(s.image) : null;
      if (imageBlob) {
        await putObject({
          ...existing,
          imageBlob,
        });
      }
    })
  );
}

export async function loadData() {
  const [objs, sets] = await Promise.all([getAllObjects(), getSettings()]);
  if (objs.length === 0) {
    await seedDefaults();
    return loadData();
  }
  const settings = await reconcileSettings(sets);
  return { objects: objs, settings };
}

async function reconcileSettings(stored) {
  // If the user has never customized settings, keep them on the latest defaults.
  // Once the user saves settings explicitly, we respect their choices and stop overwriting.
  if (stored._source !== 'user') {
    const fresh = { ...DEFAULT_SETTINGS, _source: 'default' };
    await putSettings(fresh);
    return fresh;
  }
  return { ...DEFAULT_SETTINGS, ...stored };
}

function txComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function resetDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close();
      db = null;
    }
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database reset blocked by another tab'));
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
