import { putObject, putMeta, getMeta } from '../db.js';
import { showToast, getPlaceholder, keyStringToBindings, normalizeKey, resizeImage } from '../utils.js';
import { speakOrPlay } from '../speech.js';

let selectedObjectId = null;
let recorder = null;
let recordedChunks = [];
let audioPreviewURL = null;
let pendingImageBlob = null;

export function initEditor(objects, settings, refreshList, refreshMeta) {
  bindObjectForm(objects, settings, refreshList, refreshMeta);
}

export function selectObject(id, objects) {
  selectedObjectId = id;
  const obj = objects.find((o) => o.id === id);
  if (!obj) return;
  document.getElementById('editorTitle').textContent = 'Edit Objek';
  document.getElementById('noSelection').classList.add('hidden');
  document.getElementById('objectForm').classList.remove('hidden');
  document.getElementById('inpName').value = obj.name;
  document.getElementById('inpTts').value = obj.ttsText || '';
  document.getElementById('inpColor').value = obj.color || '#4A90D9';
  document.getElementById('inpAnimation').value = obj.animation || 'random';
  document.getElementById('inpActive').checked = !!obj.active;
  document.getElementById('inpKeys').value = (obj.keyBindings || []).join(', ');
  if (document.getElementById('inpUseRecording')) {
    document.getElementById('inpUseRecording').checked = !!obj.useRecording;
  }
  document.getElementById('inpPhoto').value = '';
  document.getElementById('inpPhotoUrl').value = '';
  pendingImageBlob = null;
  renderPreview(obj);
  renderAudioSection(obj);
  switchEditorTab('editor');
}

export function addNewObject() {
  selectedObjectId = null;
  const form = document.getElementById('objectForm');
  if (form) form.reset();
  const colorInput = document.getElementById('inpColor');
  if (colorInput) colorInput.value = '#4A90D9';
  const animInput = document.getElementById('inpAnimation');
  if (animInput) animInput.value = 'random';
  const activeInput = document.getElementById('inpActive');
  if (activeInput) activeInput.checked = true;
  const keysInput = document.getElementById('inpKeys');
  if (keysInput) keysInput.value = '';
  const useRecInput = document.getElementById('inpUseRecording');
  if (useRecInput) useRecInput.checked = false;
  const title = document.getElementById('editorTitle');
  if (title) title.textContent = 'Objek Baru';
  const noSel = document.getElementById('noSelection');
  if (noSel) noSel.classList.add('hidden');
  const objForm = document.getElementById('objectForm');
  if (objForm) objForm.classList.remove('hidden');
  const urlInput = document.getElementById('inpPhotoUrl');
  if (urlInput) urlInput.value = '';
  pendingImageBlob = null;
  const preview = document.getElementById('photoPreview');
  if (preview) preview.innerHTML = '<span style="color:#888;font-size:14px">Belum ada foto</span>';
  renderAudioSection({ audioBlob: null, useRecording: false });
  switchEditorTab('editor');
}

function renderPreview(obj) {
  const box = document.getElementById('photoPreview');
  box.style.setProperty('--preview-color', obj.color || '#4A90D9');
  box.innerHTML = '';
  const card = document.createElement('div');
  card.style.width = '100%';
  card.style.height = '100%';
  card.style.borderRadius = '12px';
  card.style.display = 'flex';
  card.style.alignItems = 'center';
  card.style.justifyContent = 'center';
  card.style.overflow = 'hidden';
  card.style.pointerEvents = 'none';

  const hasImage = !!obj.imageBlob;
  card.style.border = hasImage ? 'none' : '3px solid ' + (obj.color || '#4A90D9');

  if (hasImage) {
    const imgSrc = URL.createObjectURL(obj.imageBlob);
    card.style.background = obj.color || '#4A90D9';
    card.innerHTML = `<img src="${imgSrc}" alt="${escapeAttr(obj.name)}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
  } else {
    card.style.background = obj.color || '#4A90D9';
    card.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:100%;height:100%;padding:16px;text-align:center;">
        <span style="font-size:72px;font-weight:800;color:rgba(255,255,255,0.95);text-shadow:0 2px 6px rgba(0,0,0,0.2);">${(obj.name || '?').charAt(0).toUpperCase()}</span>
        <span style="font-size:18px;font-weight:700;color:rgba(255,255,255,0.95);text-shadow:0 1px 4px rgba(0,0,0,0.2);">${escapeHtml(obj.name || '')}</span>
      </div>`;
  }
  box.appendChild(card);
}

function renderAudioSection(obj) {
  const container = document.getElementById('audioSection');
  if (!container) return;
  const hasAudio = !!obj.audioBlob;
  container.innerHTML = `
    <div class="form-group">
      <label>Suara</label>
      <div class="toggle-row">
        <input type="checkbox" id="inpUseRecording" ${obj.useRecording ? 'checked' : ''}>
        <label for="inpUseRecording" style="margin:0">Gunakan rekaman suara (jika ada)</label>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn ${recorder ? 'danger' : 'success'}" id="btnRecord">${recorder ? 'Berhenti' : 'Rekam Suara'}</button>
        ${hasAudio ? `<button type="button" class="btn" id="btnPlayRecording">Putar</button>
        <button type="button" class="btn danger small" id="btnDeleteRecording">Hapus</button>` : ''}
      </div>
      ${recorder ? '<div style="margin-top:6px;color:#e74c3c;font-weight:600;">● Sedang merekam...</div>' : ''}
      ${hasAudio ? '<div style="margin-top:6px;color:#27ae60;font-size:12px;">✓ Sudah ada rekaman</div>' : '<div style="margin-top:6px;color:#888;font-size:12px;">Belum ada rekaman</div>'}
    </div>
  `;
  bindAudioButtons(obj);
}

function bindAudioButtons(obj) {
  const btnRecord = document.getElementById('btnRecord');
  const btnPlay = document.getElementById('btnPlayRecording');
  const btnDelete = document.getElementById('btnDeleteRecording');
  if (btnRecord) btnRecord.onclick = () => toggleRecording(obj);
  if (btnPlay) btnPlay.onclick = () => playCurrentAudio(obj);
  if (btnDelete) btnDelete.onclick = () => deleteRecording(obj);
}

async function toggleRecording(obj) {
  if (recorder) {
    recorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    recordedChunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      obj.audioBlob = blob;
      obj.audioType = 'recording';
      obj.useRecording = true;
      recorder = null;
      renderAudioSection(obj);
    };
    recorder.start();
    renderAudioSection(obj);
  } catch (err) {
    showToast('Tidak bisa mengakses mikrofon: ' + err.message, true);
  }
}

async function playCurrentAudio(obj) {
  if (!obj.audioBlob) return;
  if (audioPreviewURL) URL.revokeObjectURL(audioPreviewURL);
  audioPreviewURL = URL.createObjectURL(obj.audioBlob);
  const audio = new Audio(audioPreviewURL);
  await audio.play();
}

function deleteRecording(obj) {
  if (!confirm('Hapus rekaman suara?')) return;
  obj.audioBlob = null;
  obj.useRecording = false;
  obj.audioType = 'tts';
  renderAudioSection(obj);
}

function bindObjectForm(objects, settings, refreshList, refreshMeta) {
  document.getElementById('btnAddObject').onclick = addNewObject;

  document.getElementById('btnPlay').onclick = () => {
    window.open('index.html', '_blank');
  };

  document.getElementById('inpPhoto').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingImageBlob = await resizeImage(file);
      const url = URL.createObjectURL(pendingImageBlob);
      document.getElementById('photoPreview').innerHTML = `<img src="${url}" alt="preview" style="max-width:100%;max-height:100%;object-fit:contain;">`;
    } catch (err) {
      showToast('Gagal memproses foto: ' + err.message, true);
      pendingImageBlob = null;
    }
  });

  document.getElementById('btnLoadPhotoUrl').addEventListener('click', async () => {
    const url = document.getElementById('inpPhotoUrl').value.trim();
    if (!url) return;
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('Gagal mengunduh gambar');
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('URL bukan gambar');
      pendingImageBlob = await resizeImage(blob);
      const objectUrl = URL.createObjectURL(pendingImageBlob);
      document.getElementById('photoPreview').innerHTML = `<img src="${objectUrl}" alt="preview" style="max-width:100%;max-height:100%;object-fit:contain;">`;
      showToast('Foto dari URL siap');
    } catch (err) {
      showToast('Gagal memuat foto dari URL: ' + err.message, true);
      pendingImageBlob = null;
    }
  });

  document.getElementById('inpColor').addEventListener('input', (e) => {
    const color = e.target.value;
    document.getElementById('photoPreview').style.setProperty('--preview-color', color);
    const name = document.getElementById('inpName').value.trim();
    renderPreview({ id: 'preview', name, color, imageBlob: null });
  });

  document.getElementById('objectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isNew = !selectedObjectId;
    const id = selectedObjectId || ('obj_' + Date.now());
    const existing = objects.find((o) => o.id === id);
    const file = document.getElementById('inpPhoto').files[0];
    const keyInput = document.getElementById('inpKeys').value;
    const useRecording = document.getElementById('inpUseRecording')?.checked || false;

    const newObj = {
      id,
      name: document.getElementById('inpName').value.trim(),
      ttsText: document.getElementById('inpTts').value.trim() || document.getElementById('inpName').value.trim(),
      color: document.getElementById('inpColor').value,
      animation: document.getElementById('inpAnimation').value,
      imageBlob: pendingImageBlob || (existing?.imageBlob || null),
      audioBlob: existing?.audioBlob || null,
      useRecording: existing?.audioBlob ? useRecording : false,
      audioType: existing?.audioBlob && useRecording ? 'recording' : 'tts',
      active: document.getElementById('inpActive').checked,
      order: existing ? existing.order : objects.length,
      keyBindings: keyStringToBindings(keyInput),
      source: existing?.source || 'custom',
    };
    await putObject(newObj);
    const idx = objects.findIndex((o) => o.id === id);
    if (idx >= 0) objects[idx] = newObj;
    else objects.push(newObj);
    selectedObjectId = id;
    document.getElementById('editorTitle').textContent = 'Edit Objek';
    pendingImageBlob = null;
    refreshList();
    renderPreview(newObj);
    renderAudioSection(newObj);
    showToast('Objek disimpan');
  });

  document.getElementById('btnTestTts').onclick = () => {
    speakOrPlay({
      ttsText: document.getElementById('inpTts').value.trim() || document.getElementById('inpName').value.trim() || 'Halo',
      audioBlob: null,
      useRecording: false,
    }, settings);
  };

  document.getElementById('btnDeleteObject').onclick = async () => {
    if (!selectedObjectId) return;
    if (!confirm('Yakin hapus objek ini?')) return;
    const idx = objects.findIndex((o) => o.id === selectedObjectId);
    if (idx >= 0) objects.splice(idx, 1);
    await deleteObject(selectedObjectId);
    selectedObjectId = null;
    document.getElementById('objectForm').classList.add('hidden');
    document.getElementById('noSelection').classList.remove('hidden');
    refreshList();
    showToast('Objek dihapus');
  };

  document.getElementById('btnCancel').onclick = () => {
    selectedObjectId = null;
    document.getElementById('objectForm').classList.add('hidden');
    document.getElementById('noSelection').classList.remove('hidden');
  };
}

function switchEditorTab(name) {
  document.querySelectorAll('#editorTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.editortab === name));
  document.getElementById('editorTabEditor').classList.toggle('hidden', name !== 'editor');
  document.getElementById('editorTabSettings').classList.toggle('hidden', name !== 'settings');
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(str) {
  return (str || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
