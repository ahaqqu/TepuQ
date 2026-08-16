import './styles/main.css';
import { initDB, loadData } from './db.js';
import { initSpeech } from './speech.js';
import { initGamePicker, showGamePicker, backToGamePicker } from './game-picker.js';
import { loginAndPull, fetchCurrentUser } from './sync-client.js';

function renderBuildInfo() {
  const el = document.getElementById('buildInfo');
  if (el && typeof __TEPUQ_BUILD_TIME__ !== 'undefined') {
    const d = new Date(__TEPUQ_BUILD_TIME__);
    const fmt = d.toLocaleString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    el.textContent = `Versi ${fmt}`;
  }
}

// Show the "logged in as …" info and hide the login form when a session
// exists. Otherwise leave the login form visible.
async function applyMainSyncState() {
  const user = await fetchCurrentUser();
  const form = document.getElementById('mainSyncForm');
  const infoEl = document.getElementById('mainSyncInfo');
  const statusEl = document.getElementById('mainSyncStatus');
  if (user) {
    if (form) form.remove();
    if (statusEl) statusEl.textContent = '';
    if (infoEl) {
      infoEl.textContent = `☁️ Login aktif sebagai ${user}`;
      infoEl.classList.remove('hidden');
    }
  }
}

function bindMainSyncLogin() {
  const form = document.getElementById('mainSyncForm');
  if (!form) return;
  const userEl = document.getElementById('mainSyncUser');
  const passEl = document.getElementById('mainSyncPass');
  const statusEl = document.getElementById('mainSyncStatus');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = userEl.value.trim();
    const pass = passEl.value;
    if (!user || !pass) {
      statusEl.textContent = 'Isi username dan password';
      return;
    }
    statusEl.textContent = 'Login & mengambil data...';
    try {
      const result = await loginAndPull(user, pass);
      if (!result.ok) {
        statusEl.textContent = result.error || 'Login gagal';
        return;
      }
      await applyMainSyncState();
      if (!result.pulled) {
        statusEl.textContent = 'Login berhasil. Belum ada data di cloud.';
        return;
      }
      statusEl.textContent = 'Data diambil, memuat ulang...';
      location.reload();
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Sinkron gagal: ' + err.message;
    }
  });
}

async function bootstrap() {
  try {
    await initDB();
    const { objects, settings } = await loadData();
    initSpeech();
    renderBuildInfo();

    const isAdmin = new URLSearchParams(location.search).get('mode') === 'admin';
    if (isAdmin) {
      document.body.classList.add('admin');
      const { renderAdmin } = await import('./admin/index.js');
      await renderAdmin(objects, settings);
    } else {
      document.body.classList.remove('admin');
      bindMainSyncLogin();
      await applyMainSyncState();
      initGamePicker({ objects, settings });
      // The Game Picker is the new top-level menu; start on it.
      showGamePicker();
      // "Pilih Game" back button inside the Gambar sub-picker returns here.
      const backBtn = document.getElementById('btnBackToGames');
      if (backBtn) backBtn.addEventListener('click', backToGamePicker);
    }
  } finally {
    document.documentElement.classList.remove('bootstrapping');
  }
}

window.addEventListener('tepuq:refresh-admin', async () => {
  const { renderAdmin } = await import('./admin/index.js');
  const { objects, settings } = await loadData();
  await renderAdmin(objects, settings);
});

document.addEventListener('DOMContentLoaded', bootstrap);
