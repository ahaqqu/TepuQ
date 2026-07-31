import './styles/main.css';
import { initDB, loadData } from './db.js';
import { initSpeech } from './speech.js';
import { initGame, bindGameInput } from './game/input.js';
import { renderAdmin } from './admin/index.js';

async function bootstrap() {
  await initDB();
  const { objects, settings } = await loadData();
  initSpeech();

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
