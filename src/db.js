import { DB_NAME, DB_VERSION, DEFAULT_SETTINGS, STARTER_OBJECTS } from './config.js';
import {
  KATA_DB_STORES,
  KATA_DEFAULT_SETTINGS,
  KATA_DEFAULT_PROGRESS,
  KATA_STARTER_WORDS,
} from './config.js';

let db = null;

// Versioned URL for a bundled starter image. The query string busts the
// browser HTTP cache when the bundled assets change (see config.js DB_VERSION).
export function starterImageUrl(s) {
  return s.image ? `${s.image}?v=${DB_VERSION}` : null;
}

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
      // TepuQ Kata stores (added in DB_VERSION 5). See ADR 0003.
      if (!d.objectStoreNames.contains(KATA_DB_STORES.words)) {
        d.createObjectStore(KATA_DB_STORES.words, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(KATA_DB_STORES.settings)) {
        d.createObjectStore(KATA_DB_STORES.settings, { keyPath: 'key' });
      }
      if (!d.objectStoreNames.contains(KATA_DB_STORES.progress)) {
        d.createObjectStore(KATA_DB_STORES.progress, { keyPath: 'key' });
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
      imageUrl: starterImageUrl(s),
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
        if (existing.imageUrl !== starterImageUrl(s)) {
          store.put({
            ...existing,
            imageUrl: starterImageUrl(s),
            imageSource: 'starter',
          });
        }
      });
      resolve();
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

// Starter image URLs must always carry the current DB_VERSION query string:
// when bundled assets change, the new version forces the browser to fetch the
// updated file instead of serving a stale cached image (Brave/Android cache
// aggressively). Normalizing on every load — not only on DB upgrade — keeps
// stored and in-memory URLs in sync the moment the new build runs.
async function normalizeStarterImageUrls(objs) {
  const starterById = Object.fromEntries(
    STARTER_OBJECTS.map((s, i) => ['obj_' + String(i + 1).padStart(3, '0'), s])
  );
  const changed = [];
  for (const o of objs) {
    const s = starterById[o.id];
    if (!s || !o.imageUrl) continue;
    if (o.imageUrl.split('?')[0] !== (s.image || '')) continue;
    const expected = starterImageUrl(s);
    if (o.imageUrl !== expected) {
      o.imageUrl = expected;
      changed.push(o);
    }
  }
  for (const o of changed) await putObject(o);
  return objs;
}

export async function loadData() {
  let [objs, sets] = await Promise.all([getAllObjects(), getSettings()]);
  if (objs.length === 0) {
    await seedDefaults();
    return loadData();
  }
  objs = await normalizeStarterImageUrls(objs);
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
    o.imageUrl === starterImageUrl(s) &&
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

// ---- TepuQ Kata data access -----------------------------------------------
// Kata owns three stores (kata_words, kata_settings, kata_progress) inside the
// shared tepuq_db. These helpers are the only code that reads/writes those
// stores, so Gambar's object/settings/meta helpers stay untouched. See ADR 0003.

export function getAllKataWords() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([KATA_DB_STORES.words], 'readonly');
    const req = tx.objectStore(KATA_DB_STORES.words).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export function putKataWord(word) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([KATA_DB_STORES.words], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(KATA_DB_STORES.words).put(word);
  });
}

export function deleteKataWord(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([KATA_DB_STORES.words], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(KATA_DB_STORES.words).delete(id);
  });
}

export function clearKataWords() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([KATA_DB_STORES.words], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(KATA_DB_STORES.words).clear();
  });
}

export function getKataSettings() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([KATA_DB_STORES.settings], 'readonly');
    const req = tx.objectStore(KATA_DB_STORES.settings).get('kata_settings');
    req.onsuccess = () => {
      const s = req.result || {};
      delete s.key;
      resolve(s);
    };
    req.onerror = () => reject(req.error);
  });
}

export function putKataSettings(s) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([KATA_DB_STORES.settings], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(KATA_DB_STORES.settings).put({ key: 'kata_settings', ...s });
  });
}

export function getKataProgress() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([KATA_DB_STORES.progress], 'readonly');
    const req = tx.objectStore(KATA_DB_STORES.progress).get('kata_progress');
    req.onsuccess = () => resolve(req.result || { ...KATA_DEFAULT_PROGRESS });
    req.onerror = () => reject(req.error);
  });
}

export function putKataProgress(p) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([KATA_DB_STORES.progress], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(KATA_DB_STORES.progress).put({ key: 'kata_progress', ...p });
  });
}

// Seed the starter words and default Kata settings/progress on first run.
// Mirrors seedDefaults(): seed immediately so the UI can bootstrap, and only
// run when the words store is empty.
export async function seedKataDefaults() {
  const tx = db.transaction(
    [KATA_DB_STORES.words, KATA_DB_STORES.settings, KATA_DB_STORES.progress],
    'readwrite',
  );
  const wordStore = tx.objectStore(KATA_DB_STORES.words);
  KATA_STARTER_WORDS.forEach((s, i) => {
    const id = 'kata_' + String(i + 1).padStart(3, '0');
    wordStore.put({
      id,
      word: s.word,
      display: s.word,
      category: s.category || 'default',
      order: i,
      enabled: true,
      audioBlob: null,
      audioType: 'tts',
      useRecording: false,
      source: 'starter',
      image: s.image || null,
    });
  });
  tx.objectStore(KATA_DB_STORES.settings).put({ key: 'kata_settings', ...KATA_DEFAULT_SETTINGS, _source: 'default' });
  tx.objectStore(KATA_DB_STORES.progress).put({ key: 'kata_progress', ...KATA_DEFAULT_PROGRESS });
  await txComplete(tx);
}

// Load all Kata data for the game/admin. Seeds on first run like loadData().
export async function loadKataData() {
  let [words, settings, progress] = await Promise.all([
    getAllKataWords(),
    getKataSettings(),
    getKataProgress(),
  ]);
  if (words.length === 0) {
    await seedKataDefaults();
    [words, settings, progress] = await Promise.all([
      getAllKataWords(),
      getKataSettings(),
      getKataProgress(),
    ]);
  }
  const reconciled = await reconcileKataSettings(settings);
  return { words, settings: reconciled, progress };
}

// Same default-vs-user reconciliation pattern as Gambar's reconcileSettings:
// until the parent saves Kata settings explicitly, keep them on the defaults.
async function reconcileKataSettings(stored) {
  if (stored._source !== 'user') {
    const fresh = { ...KATA_DEFAULT_SETTINGS, _source: 'default' };
    await putKataSettings(fresh);
    return fresh;
  }
  return { ...KATA_DEFAULT_SETTINGS, ...stored };
}

// A starter word untouched by the parent counts as starter (not synced/exported).
export function isStarterWordUntouched(w, s) {
  return (
    w.word === s.word &&
    w.display === s.word &&
    w.audioBlob == null &&
    w.useRecording === false &&
    w.source === 'starter' &&
    w.enabled === true &&
    (w.image || null) === (s.image || null)
  );
}
