import { initDB, loadData, getAllObjects, getSettings, putObject, putSettings, putMeta, getMeta } from '../db.js';
import { buildSyncPayload, parseSyncPayload } from './sync-serializer.js';
import { importZip } from './import-export.js';
import { showToast } from '../utils.js';

const API_BASE = '/api';

export function initSyncUI() {
  const section = document.getElementById('syncSection');
  if (!section) return;
  refreshSyncUI();

  section.querySelector('#syncLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleLogin();
  });

  section.querySelector('#syncLogout')?.addEventListener('click', async () => {
    await handleLogout();
  });

  section.querySelector('#syncPush')?.addEventListener('click', async () => {
    await handlePush();
  });

  section.querySelector('#syncPull')?.addEventListener('click', async () => {
    await handlePull();
  });
}

async function handleLogin() {
  const user = document.getElementById('syncUser').value.trim();
  const pass = document.getElementById('syncPass').value;
  if (!user || !pass) {
    showSyncStatus('Masukkan username dan password', true);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      showSyncStatus(data.error || 'Login gagal', true);
      return;
    }
    showSyncStatus('Login berhasil');
    refreshSyncUI();
  } catch (err) {
    console.error(err);
    showSyncStatus('Login gagal: ' + err.message, true);
  }
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'same-origin' });
  } catch (err) {
    console.error(err);
  }
  showSyncStatus('Logout berhasil');
  refreshSyncUI();
}

async function handlePush() {
  showSyncStatus('Mempersiapkan data...');
  try {
    const { objects, settings } = await loadData();
    const payload = await buildSyncPayload(objects, settings);
    const res = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      showSyncStatus(data.error || 'Push gagal', true);
      return;
    }
    showSyncStatus(`Push berhasil (${data.size} bytes)`);
    await updateLastSyncTime();
  } catch (err) {
    console.error(err);
    showSyncStatus('Push gagal: ' + err.message, true);
  }
}

async function handlePull() {
  showSyncStatus('Mengambil data...');
  try {
    const res = await fetch(`${API_BASE}/sync`, {
      method: 'GET',
      credentials: 'same-origin',
    });
    if (res.status === 204) {
      showSyncStatus('Belum ada data di cloud');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      showSyncStatus(data.error || 'Pull gagal', true);
      return;
    }
    if (!data.payload) {
      showSyncStatus('Payload kosong', true);
      return;
    }

    const { settings, objects } = await parseSyncPayload(data.payload);
    await applyPulledData(objects, settings);
    showSyncStatus('Pull berhasil. Muat ulang halaman.');
    await updateLastSyncTime();
  } catch (err) {
    console.error(err);
    showSyncStatus('Pull gagal: ' + err.message, true);
  }
}

async function applyPulledData(importedObjects, settings) {
  // Reuse the same overwrite/merge strategy as ZIP import:
  // preserve starter objects, replace/merge custom ones by id/name.
  const existing = await getAllObjects();
  const existingById = Object.fromEntries(existing.map((o) => [o.id, o]));
  const existingByName = Object.fromEntries(existing.map((o) => [normalizeImportKey(o.name), o]));
  const importedById = Object.fromEntries(importedObjects.map((o) => [o.id, o]));
  const importedByName = Object.fromEntries(importedObjects.map((o) => [normalizeImportKey(o.name), o]));

  const merged = [];
  for (const o of existing) {
    const custom = importedById[o.id] || importedByName[normalizeImportKey(o.name)];
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

  for (const i of importedObjects) {
    if (!existingById[i.id] && !existingByName[normalizeImportKey(i.name)]) {
      merged.push({ ...i, source: 'custom' });
    }
  }

  const db = await initDB();
  const tx = db.transaction(['objects', 'settings', 'meta'], 'readwrite');
  tx.objectStore('objects').clear();
  merged.forEach((o) => tx.objectStore('objects').put(o));
  tx.objectStore('settings').put({ key: 'settings', ...(settings || {}) });
  tx.objectStore('meta').put({ key: 'meta', version: '3.0', lastModified: Date.now() });
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function normalizeImportKey(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function updateLastSyncTime() {
  const meta = await getMeta();
  await putMeta({ ...meta, lastSync: Date.now() });
}

export async function refreshSyncUI() {
  const section = document.getElementById('syncSection');
  if (!section) return;

  const loggedIn = await checkLoginStatus();
  section.querySelector('#syncLoginForm').classList.toggle('hidden', loggedIn);
  section.querySelector('#syncActions').classList.toggle('hidden', !loggedIn);

  if (loggedIn) {
    const meta = await getMeta();
    const lastSync = meta.lastSync;
    const info = section.querySelector('#syncInfo');
    if (info) {
      info.textContent = lastSync
        ? `Login aktif. Sinkron terakhir: ${new Date(lastSync).toLocaleString('id-ID')}`
        : 'Login aktif. Belum pernah sinkron.';
    }
  }
}

async function checkLoginStatus() {
  try {
    const res = await fetch(`${API_BASE}/sync`, { method: 'GET', credentials: 'same-origin' });
    return res.ok;
  } catch {
    return false;
  }
}

function showSyncStatus(text, isError = false) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.textContent = text;
  el.className = 'sync-status' + (isError ? ' error' : '');
}
