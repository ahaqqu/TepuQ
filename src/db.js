import { DB_NAME, DB_VERSION, DEFAULT_SETTINGS, STARTER_OBJECTS } from './config.js';

let db = null;

export async function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = async (e) => {
      const d = e.target.result;
      const tx = e.target.transaction;
      if (!d.objectStoreNames.contains('objects')) {
        d.createObjectStore('objects', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!d.objectStoreNames.contains('meta')) {
        d.createObjectStore('meta', { keyPath: 'key' });
      }
      // Refresh starter image URLs once per version bump. This keeps bundled
      // asset paths in sync without racing against runtime user edits.
      await refreshStarterImageUrlsInTransaction(tx);
    };

  });
}

async function fetchAssetBlob(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    // iOS Safari is strict about Blob MIME type for object URLs.
    // Make sure starter JPGs are stored with the correct image/jpeg type.
    if (path.endsWith('.jpg') && (!blob.type || blob.type === 'image/jpg' || blob.type === '')) {
      return new Blob([blob], { type: 'image/jpeg' });
    }
    return blob;
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
      imageUrl: s.image || null,
      imageBlob: null,
      imageSource: 'starter',
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
  // Default image blobs are loaded in the background so first paint stays fast.
  // imageBlob is left null here and fetched asynchronously by loadStarterAssets.
  await txComplete(tx);

  // Starter images are served as normal HTTP URLs from /assets/starter/.
  // We only store the URL, not a Blob, so the browser can cache them and
  // so iOS Safari does not struggle with Blob MIME types.
  return;
}

function refreshStarterImageUrlsInTransaction(tx) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('objects');
    const getAllReq = store.getAll();
    getAllReq.onsuccess = () => {
      const objects = getAllReq.result || [];
      STARTER_OBJECTS.forEach((s, i) => {
        const id = 'obj_' + String(i + 1).padStart(3, '0');
        const existing = objects.find((o) => o.id === id);
        if (!existing) return;
        // Only refresh the URL if the user has not replaced it with a custom photo.
        if (existing.imageSource === 'custom') return;
        if (existing.imageUrl !== s.image) {
          store.put({
            ...existing,
            imageUrl: s.image || null,
            imageSource: 'starter',
          });
        }
      });
      resolve();
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

export async function loadData() {
  let [objs, sets] = await Promise.all([getAllObjects(), getSettings()]);
  if (objs.length === 0) {
    await seedDefaults();
    return loadData();
  }
  await reconcileObjectSources(objs);
  const settings = await reconcileSettings(sets);
  return { objects: objs, settings };
}

// A starter object that is still byte-for-byte identical to its bundled
// definition counts as untouched. Any deviation (name, photo, audio, keys,
// color, ...) means the parent customized it, so it must sync and export.
export function isStarterObjectUntouched(o, s) {
  return (
    o.name === s.name &&
    o.ttsText === s.name &&
    o.color === s.color &&
    o.imageUrl === (s.image || null) &&
    o.imageBlob == null &&
    o.imageSource === 'starter' &&
    o.audioBlob == null &&
    o.useRecording === false &&
    (o.keyBindings || []).length === 0 &&
    o.active === true
  );
}

// Mark previously edited starter objects as custom so they are included in
// cloud push and ZIP export. Runs on every load; already-custom objects are
// skipped, so it only writes once per customized object.
export async function reconcileObjectSources(objs) {
  const starterById = Object.fromEntries(
    STARTER_OBJECTS.map((s, i) => ['obj_' + String(i + 1).padStart(3, '0'), s])
  );
  for (const o of objs) {
    const s = starterById[o.id];
    if (!s || o.source === 'custom') continue;
    if (!isStarterObjectUntouched(o, s)) {
      await putObject({ ...o, source: 'custom' });
      o.source = 'custom';
    }
  }
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
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('objects').put(obj);
  });
}

export function putSettings(s) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['settings'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('settings').put({ key: 'settings', ...s });
  });
}

export function deleteObject(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['objects'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('objects').delete(id);
  });
}

export function putMeta(meta) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['meta'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('meta').put({ key: 'meta', ...meta });
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
