import './styles/main.css';
import { initDB, loadData } from './db.js';
import { initSpeech } from './speech.js';
import { initGame, bindGameInput } from './game/input.js';
import { renderAdmin } from './admin/index.js';
import { loginAndPull } from './admin/sync.js';

function renderBuildInfo() {
  const el = document.getElementById('buildInfo');
  if (el && typeof __TEPUQ_BUILD_TIME__ !== 'undefined') {
    const d = new Date(__TEPUQ_BUILD_TIME__);
    const fmt = d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    el.textContent = `Versi ${fmt}`;
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

    if (!window.JSZip && window.jszip) window.JSZip = window.jszip;

    const isAdmin = new URLSearchParams(location.search).get('mode') === 'admin';
    if (isAdmin) {
      document.body.classList.add('admin');
      await renderAdmin(objects, settings);
    } else {
      document.body.classList.remove('admin');
      bindGameInput();
      bindMainSyncLogin();
      await initGame({ objects, settings });
    }
  } finally {
    document.documentElement.classList.remove('bootstrapping');
  }
}

window.addEventListener('tepuq:refresh-admin', async () => {
  const { objects, settings } = await loadData();
  await renderAdmin(objects, settings);
});

document.addEventListener('DOMContentLoaded', bootstrap);
