// Gambar-specific admin tab: "Pengaturan Game". The shared admin shell
// (src/admin/index.js) wires this tab into the editor panel next to
// "Editor Objek" (shared object library) and "Pengaturan Kata" (Kata settings).

import { bindSettingsForm, refreshSettingsForm } from './settings-form.js';

export function renderGambarAdminTab(settings, onChange) {
  bindSettingsForm(settings, onChange);
  refreshSettingsForm(settings);
}
