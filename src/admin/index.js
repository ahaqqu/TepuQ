import { renderObjectList } from './object-list.js';
import { selectObject, addNewObject, initEditor } from './editor.js';
import { bindSettingsForm, refreshSettingsForm } from './settings-form.js';
import { exportZip, importZip } from './import-export.js';
import { initSyncUI, refreshSyncUI } from './sync.js';
import { showToast } from '../utils.js';
import { getMeta, putMeta, loadKataData } from '../db.js';
import { renderKataAdmin } from '../kata-admin/index.js';

function renderAdminBuildInfo() {
  const footer = document.getElementById('adminFooter');
  if (!footer || typeof __TEPUQ_BUILD_TIME__ === 'undefined') return;
  const d = new Date(__TEPUQ_BUILD_TIME__);
  const fmt = d.toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  footer.textContent += ` · Versi ${fmt}`;
}

export async function renderAdmin(objects, settings) {
  renderObjectList(objects, (id) => selectObject(id, objects));
  bindAdminTabs();
  bindEditorTabs();
  bindGameTabs();
  bindKataEditorTabs();
  initEditor(objects, () => settings, () => renderObjectList(objects, (id) => selectObject(id, objects)));
  bindImportExport(objects, () => settings);
  bindSettingsForm(settings, (newSettings) => {
    settings = newSettings;
  });
  refreshSettingsForm(settings);
  initSyncUI();
  await refreshSyncUI();
  await renderBackupReminder();
  renderAdminBuildInfo();
  // Render the Kata admin (second game) into the Kata tab.
  const { words: kataWords, settings: kataSettings } = await loadKataData();
  await renderKataAdmin(kataWords, kataSettings);
}

export function reRenderAdmin() {
  const event = new CustomEvent('tepuq:refresh-admin');
  window.dispatchEvent(event);
}

function bindAdminTabs() {
  document.querySelectorAll('.panel-left .tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.panel-left .tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('tabObjects').classList.toggle('hidden', t.dataset.tab !== 'objects');
      document.getElementById('tabSync').classList.toggle('hidden', t.dataset.tab !== 'sync');
      if (t.dataset.tab === 'sync') {
        refreshSyncUI();
      }
    });
  });
}

function bindEditorTabs() {
  document.querySelectorAll('#editorTabs .tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('#editorTabs .tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('editorTabEditor').classList.toggle('hidden', t.dataset.editortab !== 'editor');
      document.getElementById('editorTabSettings').classList.toggle('hidden', t.dataset.editortab !== 'settings');
    });
  });
}

// Top-level admin game switcher: Gambar vs Kata. Toggles both the left-panel
// content (adminGambar/adminKata) and the right-panel editor (editorGambar/
// editorKata). See ADR 0002.
function bindGameTabs() {
  document.querySelectorAll('#adminGameTabs .game-tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('#adminGameTabs .game-tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const isKata = t.dataset.game === 'kata';
      document.getElementById('adminGambar').classList.toggle('hidden', isKata);
      document.getElementById('adminKata').classList.toggle('hidden', !isKata);
      document.getElementById('editorGambar').classList.toggle('hidden', isKata);
      document.getElementById('editorKata').classList.toggle('hidden', !isKata);
    });
  });
}

function bindKataEditorTabs() {
  document.querySelectorAll('#kataEditorTabs .tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('#kataEditorTabs .tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('kataEditorTabEditor').classList.toggle('hidden', t.dataset.kataeditortab !== 'editor');
      document.getElementById('kataEditorTabSettings').classList.toggle('hidden', t.dataset.kataeditortab !== 'settings');
    });
  });
}

function bindImportExport(objects, settingsOrGetter) {
  const getSettings = () => typeof settingsOrGetter === 'function' ? settingsOrGetter() : settingsOrGetter;
  document.getElementById('btnExport').onclick = () => exportZip(objects, getSettings());
  document.getElementById('btnImport').onclick = () => document.getElementById('importFile').click();
  document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importZip(file);
      showToast('Import berhasil. Muat ulang halaman.');
      await updateLastExportReminder();
    } catch (err) {
      console.error(err);
      showToast('Import gagal: ' + err.message, true);
    }
    e.target.value = '';
  });

  document.getElementById('btnExport').addEventListener('click', async () => {
    await updateLastExportReminder();
  });
}

async function renderBackupReminder() {
  const meta = await getMeta();
  const lastExport = meta.lastExport || 0;
  const daysSince = lastExport ? (Date.now() - lastExport) / (1000 * 60 * 60 * 24) : Infinity;
  const banner = document.getElementById('backupReminder');
  if (!banner) return;
  banner.className = 'backup-reminder' + (daysSince > 7 ? ' urgent' : '');
  banner.innerHTML = `
    <span>📦 Data tersimpan hanya di browser ini.</span>
    <span>Klik <strong>Export ZIP</strong> untuk backup agar tidak hilang.</span>
  `;
}

async function updateLastExportReminder() {
  const meta = await getMeta();
  await putMeta({ ...meta, lastExport: Date.now() });
  await renderBackupReminder();
}
