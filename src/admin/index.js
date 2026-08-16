import { renderObjectList } from './object-list.js';
import { selectObject, addNewObject, initEditor } from './editor.js';
import { exportZip, importZip } from './import-export.js';
import { initSyncUI, refreshSyncUI } from './sync.js';
import { showToast } from '../utils.js';
import { getMeta, putMeta } from '../db.js';
import { renderGambarAdminTab } from '../gambar-admin/index.js';
import { renderKataAdminTab } from '../kata-admin/index.js';

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

// Shared admin shell: the main admin page lives here. It manages the one
// shared word/photo library (object list + editor + sync + ZIP) and wires the
// per-game tabs — "Pengaturan Game" (src/gambar-admin/) and "Pengaturan Kata"
// (src/kata-admin/) — into the editor panel.
export async function renderAdmin(objects, settings) {
  renderObjectList(objects, (id) => selectObject(id, objects));
  bindAdminTabs();
  bindEditorTabs();
  initEditor(objects, () => settings, () => renderObjectList(objects, (id) => selectObject(id, objects)));
  bindImportExport(objects, () => settings);
  renderGambarAdminTab(settings, (newSettings) => {
    settings = newSettings;
  });
  initSyncUI();
  await refreshSyncUI();
  await renderBackupReminder();
  renderAdminBuildInfo();
  // Kata admin tab: settings only (words are the shared object library).
  await renderKataAdminTab();
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

// Editor panel tabs: shared object editor, Gambar game settings, Kata settings.
function bindEditorTabs() {
  document.querySelectorAll('#editorTabs .tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('#editorTabs .tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('editorTabEditor').classList.toggle('hidden', t.dataset.editortab !== 'editor');
      document.getElementById('editorTabSettings').classList.toggle('hidden', t.dataset.editortab !== 'settings');
      document.getElementById('editorTabKataSettings').classList.toggle('hidden', t.dataset.editortab !== 'kata-settings');
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
