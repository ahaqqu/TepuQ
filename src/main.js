import './styles/main.css';
import { initDB, loadData } from './db.js';
import { initSpeech } from './speech.js';
import { initGame, bindGameInput } from './game/input.js';
import { renderAdmin } from './admin/index.js';

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

async function bootstrap() {
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
    await initGame({ objects, settings });
  }
}

window.addEventListener('tepuq:refresh-admin', async () => {
  const { loadData } = await import('./db.js');
  const { objects, settings } = await loadData();
  const { renderAdmin } = await import('./admin/index.js');
  await renderAdmin(objects, settings);
});

document.addEventListener('DOMContentLoaded', bootstrap);
