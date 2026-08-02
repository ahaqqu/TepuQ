import { initDB, loadData, getAllObjects, putSettings, putMeta, getMeta } from '../db.js';
import { buildSyncPayload, parseSyncPayload, configToLogString } from './sync-serializer.js';
import { mergeImportedObjects } from './merge-objects.js';
import { showToast } from '../utils.js';

const API_BASE = '/api';
const LOG_STORAGE_KEY = 'tepuq_sync_log';

export function initSyncUI() {
  const section = document.getElementById('syncSection');
  if (!section) return;
  restoreSyncLog();
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

  section.querySelector('#syncLogClear')?.addEventListener('click', () => {
    localStorage.removeItem(LOG_STORAGE_KEY);
    const el = document.getElementById('syncLog');
    if (el) el.textContent = '';
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

// Login with family credentials and pull cloud data immediately.
// Used by the main page login form; returns { ok, pulled, error }.
export async function loginAndPull(user, pass) {
  const loginRes = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, pass }),
  });
  const loginData = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || !loginData.ok) {
    return { ok: false, error: loginData.error || 'Login gagal' };
  }

  const pullRes = await fetch(`${API_BASE}/sync`, {
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

  const { settings, objects } = await parseSyncPayload(data.payload);
  await applyPulledData(objects, settings);
  await updateLastSyncTime();
  return { ok: true, pulled: true };
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
    const { config } = await parseSyncPayload(payload);
    const jsonSize = new TextEncoder().encode(JSON.stringify(config)).length;
    const res = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      appendSyncLog('PUSH GAGAL', data.error || 'Push gagal');
      showSyncStatus(data.error || 'Push gagal', true);
      return;
    }
    appendSyncLog(
      'PUSH',
      config,
      `${config.objects?.length || 0} objek, JSON ${jsonSize} byte, terkirim ${data.size} byte`
    );
    showSyncStatus(`Push berhasil (${data.size} bytes)`);
    await updateLastSyncTime();
  } catch (err) {
    console.error(err);
    appendSyncLog('PUSH GAGAL', err.message);
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
      appendSyncLog('PULL', 'Belum ada data di cloud');
      showSyncStatus('Belum ada data di cloud');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      appendSyncLog('PULL GAGAL', data.error || 'Pull gagal');
      showSyncStatus(data.error || 'Pull gagal', true);
      return;
    }
    if (!data.payload) {
      appendSyncLog('PULL', 'Payload kosong');
      showSyncStatus('Payload kosong', true);
      return;
    }

    const { settings, objects, config } = await parseSyncPayload(data.payload);
    appendSyncLog('PULL', config, `${objects.length} objek`);
    await applyPulledData(objects, settings);
    showSyncStatus('Pull berhasil. Memuat ulang halaman...');
    await updateLastSyncTime();
    location.reload();
  } catch (err) {
    console.error(err);
    appendSyncLog('PULL GAGAL', err.message);
    showSyncStatus('Pull gagal: ' + err.message, true);
  }
}

async function applyPulledData(importedObjects, settings) {
  const existing = await getAllObjects();
  const merged = mergeImportedObjects(existing, importedObjects);

  const db = await initDB();
  const tx = db.transaction(['objects', 'settings', 'meta'], 'readwrite');
  tx.objectStore('objects').clear();
  merged.forEach((o) => tx.objectStore('objects').put(o));

  const hasSettings = settings && Object.keys(settings).length > 0;
  tx.objectStore('settings').put({ key: 'settings', ...(hasSettings ? settings : {}), _source: hasSettings ? 'user' : 'default' });
  tx.objectStore('meta').put({ key: 'meta', version: '3.0', lastModified: Date.now() });
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
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
    const res = await fetch(`${API_BASE}/me`, { method: 'GET', credentials: 'same-origin' });
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

// Append a push/pull entry to the admin sync log. `detail` is either a
// config object (shown as pretty JSON) or a plain message string.
// The log is persisted in localStorage so it survives the reload after pull.
function appendSyncLog(type, detail, summary = '') {
  const el = document.getElementById('syncLog');
  if (!el) return;
  const ts = new Date().toLocaleTimeString('id-ID');
  const body = typeof detail === 'string' ? detail : configToLogString(detail);
  const entry = `[${ts}] ${type}${summary ? ' — ' + summary : ''}\n${body}\n\n`;
  const text = (localStorage.getItem(LOG_STORAGE_KEY) || '') + entry;
  try {
    localStorage.setItem(LOG_STORAGE_KEY, text);
  } catch (err) {
    console.error(err);
  }
  el.textContent = text;
  el.scrollTop = el.scrollHeight;
}

function restoreSyncLog() {
  const el = document.getElementById('syncLog');
  if (!el) return;
  el.textContent = localStorage.getItem(LOG_STORAGE_KEY) || '';
  el.scrollTop = el.scrollHeight;
}
