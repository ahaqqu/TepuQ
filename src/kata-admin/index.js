// Kata-specific admin tab: "Pengaturan Kata". Since v7 the Kata word list is
// the shared object library (managed in the shared admin editor with the
// "Aktif di TepuQ Kata" toggle), so the Kata admin only renders its settings
// form. The shared admin shell (src/admin/index.js) wires this tab into the
// editor panel next to "Editor Objek" and "Pengaturan Game".

import { getKataSettings } from '../db.js';
import { bindKataSettingsForm, refreshKataSettingsForm } from './settings-form.js';

export async function renderKataAdminTab() {
  const settings = await getKataSettings();
  bindKataSettingsForm(settings, (newSettings) => {
    refreshKataSettingsForm(newSettings);
  });
  refreshKataSettingsForm(settings);
}
