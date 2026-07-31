import { putSettings, resetDatabase } from '../db.js';
import { showToast } from '../utils.js';
import { DEFAULT_SETTINGS } from '../config.js';

export function bindSettingsForm(settings) {
  refreshSettingsForm(settings);

  document.getElementById('btnSaveSettings').onclick = async () => {
    const newSettings = readSettingsForm();
    Object.assign(settings, newSettings);
    await putSettings(settings);
    showToast('Pengaturan disimpan');
  };

  document.getElementById('btnResetSettings').onclick = async () => {
    if (!confirm('Kembalikan pengaturan default?')) return;
    Object.assign(settings, DEFAULT_SETTINGS);
    await putSettings(settings);
    refreshSettingsForm(settings);
    showToast('Pengaturan direset');
  };

  document.getElementById('btnResetAll').onclick = async () => {
    if (!confirm('Hapus SEMUA data dan kembali ke pengaturan awal? Tindakan ini tidak bisa dibatalkan.')) return;
    await resetDatabase();
    sessionStorage.removeItem('tepuq-mode');
    window.location.reload();
  };
}

function readSettingsForm() {
  const modes = [];
  if (document.getElementById('setModeBebas').checked) modes.push('bebas');
  if (document.getElementById('setModeTarget').checked) modes.push('target');
  return {
    backgroundStyle: document.getElementById('setBackground').value,
    globalEntryAnimation: document.getElementById('setEntry').value,
    globalExitAnimation: document.getElementById('setExit').value,
    cardSize: document.getElementById('setCardSize').value,
    playMode: document.getElementById('setPlayMode').value,
    burstWindow: Number(document.getElementById('setBurstWindow').value),
    debounceMs: Number(document.getElementById('setDebounce').value),
    speechRate: Number(document.getElementById('setRate').value),
    speechPitch: Number(document.getElementById('setPitch').value),
    volume: Number(document.getElementById('setVolume').value) / 100,
    autoSmashDelay: Number(document.getElementById('setAutoSmash').value),
    enabledModes: modes.length ? modes : ['bebas'],
  };
}

export function refreshSettingsForm(settings) {
  document.getElementById('setBackground').value = settings.backgroundStyle || 'combined';
  document.getElementById('setEntry').value = settings.globalEntryAnimation || 'random';
  document.getElementById('setExit').value = settings.globalExitAnimation || 'random';
  document.getElementById('setCardSize').value = settings.cardSize || 'medium';
  document.getElementById('setPlayMode').value = settings.playMode || 'random';
  document.getElementById('setBurstWindow').value = settings.burstWindow ?? 1.5;
  document.getElementById('setDebounce').value = settings.debounceMs ?? 300;
  document.getElementById('setRate').value = settings.speechRate ?? 0.8;
  document.getElementById('setPitch').value = settings.speechPitch ?? 1.0;
  document.getElementById('setVolume').value = Math.round((settings.volume ?? 0.8) * 100);
  document.getElementById('setAutoSmash').value = settings.autoSmashDelay ?? 6;
  document.getElementById('setModeBebas').checked = (settings.enabledModes || []).includes('bebas');
  document.getElementById('setModeTarget').checked = (settings.enabledModes || []).includes('target');
}
