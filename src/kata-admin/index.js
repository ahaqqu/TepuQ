// Kata admin shell: wires word list, editor, and settings form into the Kata
// tab of the shared admin page. Mirrors src/admin/index.js's renderAdmin().

import { renderWordList } from './word-list.js';
import { selectWord, addNewWord, initKataEditor } from './editor.js';
import { bindKataSettingsForm, refreshKataSettingsForm } from './settings-form.js';
import { exportKataZip, importKataZip } from './import-export.js';
import { showToast } from '../utils.js';

export async function renderKataAdmin(words, settings) {
  renderWordList(words, (id) => selectWord(id, words));
  initKataEditor(words, () => renderWordList(words, (id) => selectWord(id, words)));
  bindKataSettingsForm(settings, (newSettings) => { settings = newSettings; });
  refreshKataSettingsForm(settings);
  bindKataImportExport();
}

function bindKataImportExport() {
  const btnExport = document.getElementById('btnKataExport');
  const btnImport = document.getElementById('btnKataImport');
  const importFile = document.getElementById('kataImportFile');
  if (btnExport) btnExport.onclick = () => exportKataZip();
  if (btnImport) btnImport.onclick = () => importFile?.click();
  if (importFile) importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importKataZip(file);
      showToast('Import Kata berhasil. Memuat ulang...');
      location.reload();
    } catch (err) {
      console.error(err);
      showToast('Import Kata gagal: ' + err.message, true);
    }
    e.target.value = '';
  });
}