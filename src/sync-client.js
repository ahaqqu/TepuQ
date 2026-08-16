// Shared cloud-sync API client used by the main page login form, the Kata
// victory greeting, and the admin sync UI. Kept separate from src/admin/sync.js
// (admin-only UI) so the game shell does not pull admin code into its bundle.
import { initDB, getAllObjects, putSettings, putMeta, getMeta } from './db.js';
import { mergeImportedObjects } from './admin/merge-objects.js';

const API_BASE = '/api';
const FETCH_TIMEOUT_MS = 20000;

export function fetchWithTimeout(url, options = {}, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

// Returns true when a sync session exists.
export async function checkLoginStatus() {
  try {
    const res = await fetch(`${API_BASE}/me`, { method: 'GET', credentials: 'same-origin' });
    return res.ok;
  } catch {
    return false;
  }
}

// Returns the logged-in username, or null when not logged in.
export async function fetchCurrentUser() {
  try {
    const res = await fetch(`${API_BASE}/me`, { method: 'GET', credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const user = data && data.ok ? data.user : null;
    return typeof user === 'string' && user ? user : null;
  } catch {
    return null;
  }
}

// Login with family credentials and pull cloud data immediately.
// Used by the main page login form; returns { ok, pulled, error }.
export async function loginAndPull(user, pass) {
  const loginRes = await fetchWithTimeout(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ user, pass }),
  });
  const loginData = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || !loginData.ok) {
    return { ok: false, error: loginData.error || 'Login gagal' };
  }

  const pullRes = await fetchWithTimeout(`${API_BASE}/sync`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  if (pullRes.status === 204) {
    return { ok: true, pulled: false };
  }
  const data = await pullRes.json().catch(() => ({}));
  if (!pullRes.ok || !data.ok) {
    return { ok: true, pulled: false, error: data.error || 'Pull gagal' };
  }
  if (!data.payload) {
    return { ok: true, pulled: false };
  }

  // sync-serializer is a lazy chunk shared with the admin sync UI.
  const { parseSyncPayload } = await import('./admin/sync-serializer.js');
  const { settings, objects } = await parseSyncPayload(data.payload);
  await applyPulledData(objects, settings);
  await updateLastSyncTime();
  return { ok: true, pulled: true };
}

// Overwrite the local stores with merged cloud data (also used by pull).
export async function applyPulledData(importedObjects, settings) {
  const existing = await getAllObjects();
  const merged = mergeImportedObjects(existing, importedObjects);

  const storeNames = ['objects', 'settings', 'meta'];

  const db = await initDB();
  const tx = db.transaction(storeNames, 'readwrite');
  tx.objectStore('objects').clear();
  merged.forEach((o) => tx.objectStore('objects').put(o));

  const hasSettings = settings && Object.keys(settings).length > 0;
  tx.objectStore('settings').put({ key: 'settings', ...(hasSettings ? settings : {}), _source: hasSettings ? 'user' : 'default' });
  tx.objectStore('meta').put({ key: 'meta', version: '3.0', lastModified: Date.now() });

  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function updateLastSyncTime() {
  const meta = await getMeta();
  await putMeta({ ...meta, lastSync: Date.now() });
}