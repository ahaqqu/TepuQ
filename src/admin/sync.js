import { loadData, getMeta } from '../db.js';
import { fetchWithTimeout, checkLoginStatus, applyPulledData, updateLastSyncTime } from '../sync-client.js';

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
    const res = await fetchWithTimeout(`/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
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
    await fetch(`/api/logout`, { method: 'POST', credentials: 'same-origin' });
  } catch (err) {
    console.error(err);
  }
  showSyncStatus('Logout berhasil');
  refreshSyncUI();
}

async function handlePush() {
  showSyncStatus('Mempersiapkan data...');
  try {
    const { buildSyncPayload, parseSyncPayload, configToLogString } = await import('./sync-serializer.js');
    const { objects, settings } = await loadData();
    const payload = await buildSyncPayload(objects, settings);
    const { config } = await parseSyncPayload(payload);
    const jsonSize = new TextEncoder().encode(JSON.stringify(config)).length;
    const res = await fetch(`/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      await appendSyncLog('PUSH GAGAL', data.error || 'Push gagal');
      showSyncStatus(data.error || 'Push gagal', true);
      return;
    }
    await appendSyncLog(
      'PUSH',
      config,
      `${config.objects?.length || 0} objek, JSON ${jsonSize} byte, terkirim ${data.size} byte`
    );
    showSyncStatus(`Push berhasil (${data.size} bytes)`);
    await updateLastSyncTime();
  } catch (err) {
    console.error(err);
    await appendSyncLog('PUSH GAGAL', err.message);
    showSyncStatus('Push gagal: ' + err.message, true);
  }
}

async function handlePull() {
  showSyncStatus('Mengambil data...');
  try {
    const { parseSyncPayload, configToLogString } = await import('./sync-serializer.js');
    const res = await fetch(`/api/sync`, {
      method: 'GET',
      credentials: 'same-origin',
    });
    if (res.status === 204) {
      await appendSyncLog('PULL', 'Belum ada data di cloud');
      showSyncStatus('Belum ada data di cloud');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      await appendSyncLog('PULL GAGAL', data.error || 'Pull gagal');
      showSyncStatus(data.error || 'Pull gagal', true);
      return;
    }
    if (!data.payload) {
      await appendSyncLog('PULL', 'Payload kosong');
      showSyncStatus('Payload kosong', true);
      return;
    }

    const { settings, objects, config } = await parseSyncPayload(data.payload);
    await appendSyncLog('PULL', config, `${objects.length} objek`);
    await applyPulledData(objects, settings);
    showSyncStatus('Pull berhasil. Memuat ulang halaman...');
    await updateLastSyncTime();
    location.reload();
  } catch (err) {
    console.error(err);
    await appendSyncLog('PULL GAGAL', err.message);
    showSyncStatus('Pull gagal: ' + err.message, true);
  }
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

function showSyncStatus(text, isError = false) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.textContent = text;
  el.className = 'sync-status' + (isError ? ' error' : '');
}

// Append a push/pull entry to the admin sync log. `detail` is either a
// config object (shown as pretty JSON) or a plain message string.
// The log is persisted in localStorage so it survives the reload after pull.
async function appendSyncLog(type, detail, summary = '') {
  const el = document.getElementById('syncLog');
  if (!el) return;
  const ts = new Date().toLocaleTimeString('id-ID');
  let body = detail;
  if (typeof detail !== 'string') {
    const { configToLogString } = await import('./sync-serializer.js');
    body = configToLogString(detail);
  }
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