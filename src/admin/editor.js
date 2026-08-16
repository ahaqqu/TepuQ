import { putObject, putMeta, getMeta } from '../db.js';
import { showToast, getPlaceholder, keyStringToBindings, normalizeKey, resizeImage } from '../utils.js';
import { speakOrPlay, unlockAudioContext } from '../speech.js';

const editorSession = {
  selectedObjectId: null,
  recorder: null,
  recordedChunks: [],
  audioPreviewURL: null,
  pendingImageBlob: null,
  pendingAudioBlob: null,
  previewImageURL: null,
};

export function initEditor(objects, settingsOrGetter, refreshList, refreshMeta) {
  const getSettings = () => typeof settingsOrGetter === 'function' ? settingsOrGetter() : settingsOrGetter;
  bindObjectForm(objects, getSettings, refreshList, refreshMeta);
}

export function selectObject(id, objects) {
  editorSession.selectedObjectId = id;
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
  const kataCheck = document.getElementById('inpKataEnabled');
  if (kataCheck) {
    const multiWord = isMultiWord(obj.name);
    kataCheck.disabled = multiWord;
    kataCheck.checked = !!obj.kataEnabled && !multiWord;
  }
  document.getElementById('inpKeys').value = (obj.keyBindings || []).join(', ');
  if (document.getElementById('inpUseRecording')) {
    document.getElementById('inpUseRecording').checked = !!obj.useRecording;
  }
  document.getElementById('inpPhoto').value = '';
  document.getElementById('inpPhotoUrl').value = '';
  editorSession.pendingImageBlob = null;
  editorSession.pendingAudioBlob = null;
  renderPreview(obj);
  renderAudioSection(obj);
  switchEditorTab('editor');
}

export function addNewObject() {
  editorSession.selectedObjectId = null;
  const form = document.getElementById('objectForm');
  if (form) form.reset();
  const colorInput = document.getElementById('inpColor');
  if (colorInput) colorInput.value = '#4A90D9';
  const animInput = document.getElementById('inpAnimation');
  if (animInput) animInput.value = 'random';
  const activeInput = document.getElementById('inpActive');
  if (activeInput) activeInput.checked = true;
  const kataCheck = document.getElementById('inpKataEnabled');
  if (kataCheck) {
    kataCheck.disabled = false;
    kataCheck.checked = true;
  }
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
  editorSession.pendingImageBlob = null;
  editorSession.pendingAudioBlob = null;
  const preview = document.getElementById('photoPreview');
  if (preview) preview.innerHTML = '<span style="color:#888;font-size:14px">Belum ada foto</span>';
  renderAudioSection({ audioBlob: null, useRecording: false });
  switchEditorTab('editor');
}

function renderPreview(obj) {
  const box = document.getElementById('photoPreview');
  box.style.setProperty('--preview-color', obj.color || '#4A90D9');
  if (editorSession.previewImageURL) URL.revokeObjectURL(editorSession.previewImageURL);
  editorSession.previewImageURL = null;
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

  const hasImage = !!(obj.imageUrl || obj.imageBlob);
  card.style.border = hasImage ? 'none' : '3px solid ' + (obj.color || '#4A90D9');

  if (obj.imageUrl) {
    card.style.background = obj.color || '#4A90D9';
    const img = document.createElement('img');
    img.src = obj.imageUrl;
    img.alt = obj.name || '';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    img.onerror = () => { img.style.display = 'none'; };
    card.appendChild(img);
  } else if (obj.imageBlob) {
    const safeBlob = normalizeImageBlob(obj.imageBlob);
    editorSession.previewImageURL = URL.createObjectURL(safeBlob);
    card.style.background = obj.color || '#4A90D9';
    const img = document.createElement('img');
    img.src = editorSession.previewImageURL;
    img.alt = obj.name || '';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    img.onerror = () => { img.style.display = 'none'; };
    card.appendChild(img);
  } else {
    card.style.background = obj.color || '#4A90D9';
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.gap = '6px';
    wrap.style.width = '100%';
    wrap.style.height = '100%';
    wrap.style.padding = '16px';
    wrap.style.textAlign = 'center';

    const big = document.createElement('span');
    big.style.fontSize = '72px';
    big.style.fontWeight = '800';
    big.style.color = 'rgba(255,255,255,0.95)';
    big.style.textShadow = '0 2px 6px rgba(0,0,0,0.2)';
    big.textContent = (obj.name || '?').charAt(0).toUpperCase();

    const small = document.createElement('span');
    small.style.fontSize = '18px';
    small.style.fontWeight = '700';
    small.style.color = 'rgba(255,255,255,0.95)';
    small.style.textShadow = '0 1px 4px rgba(0,0,0,0.2)';
    small.textContent = obj.name || '';

    wrap.append(big, small);
    card.appendChild(wrap);
  }
  box.appendChild(card);
}

function renderAudioSection(obj) {
  const container = document.getElementById('audioSection');
  if (!container) return;
  const hasAudio = !!obj.audioBlob;
  container.innerHTML = '';

  const group = document.createElement('div');
  group.className = 'form-group';

  const label = document.createElement('label');
  label.textContent = 'Suara';
  group.appendChild(label);

  const toggleRow = document.createElement('div');
  toggleRow.className = 'toggle-row';
  const useRecCheckbox = document.createElement('input');
  useRecCheckbox.type = 'checkbox';
  useRecCheckbox.id = 'inpUseRecording';
  useRecCheckbox.checked = !!obj.useRecording;
  const useRecLabel = document.createElement('label');
  useRecLabel.htmlFor = 'inpUseRecording';
  useRecLabel.style.margin = '0';
  useRecLabel.textContent = 'Gunakan rekaman suara (jika ada)';
  toggleRow.append(useRecCheckbox, useRecLabel);
  group.appendChild(toggleRow);

  const btnRow = document.createElement('div');
  btnRow.style.marginTop = '8px';
  btnRow.style.display = 'flex';
  btnRow.style.gap = '8px';
  btnRow.style.flexWrap = 'wrap';

  const btnRecord = document.createElement('button');
  btnRecord.type = 'button';
  btnRecord.className = 'btn ' + (editorSession.recorder ? 'danger' : 'success');
  btnRecord.id = 'btnRecord';
  btnRecord.textContent = editorSession.recorder ? 'Berhenti' : 'Rekam Suara';
  btnRow.appendChild(btnRecord);

  let btnPlay = null;
  let btnDelete = null;
  if (hasAudio) {
    btnPlay = document.createElement('button');
    btnPlay.type = 'button';
    btnPlay.className = 'btn';
    btnPlay.id = 'btnPlayRecording';
    btnPlay.textContent = 'Putar';

    btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'btn danger small';
    btnDelete.id = 'btnDeleteRecording';
    btnDelete.textContent = 'Hapus';

    btnRow.append(btnPlay, btnDelete);
  }
  group.appendChild(btnRow);

  if (editorSession.recorder) {
    const recordingMsg = document.createElement('div');
    recordingMsg.style.marginTop = '6px';
    recordingMsg.style.color = '#e74c3c';
    recordingMsg.style.fontWeight = '600';
    recordingMsg.textContent = '● Sedang merekam...';
    group.appendChild(recordingMsg);
  }

  const statusMsg = document.createElement('div');
  statusMsg.style.marginTop = '6px';
  statusMsg.style.fontSize = '12px';
  if (hasAudio) {
    statusMsg.style.color = '#27ae60';
    statusMsg.textContent = '✓ Sudah ada rekaman';
  } else {
    statusMsg.style.color = '#888';
    statusMsg.textContent = 'Belum ada rekaman';
  }
  group.appendChild(statusMsg);

  container.appendChild(group);
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
  if (editorSession.recorder) {
    editorSession.recorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    editorSession.recorder = new MediaRecorder(stream);
    editorSession.recordedChunks = [];
    editorSession.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) editorSession.recordedChunks.push(e.data);
    };
    editorSession.recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(editorSession.recordedChunks, { type: 'audio/webm' });
      editorSession.pendingAudioBlob = blob;
      if (obj) {
        obj.audioBlob = blob;
        obj.audioType = 'recording';
        obj.useRecording = true;
      }
      editorSession.recorder = null;
      renderAudioSection({ audioBlob: editorSession.pendingAudioBlob, useRecording: true });
    };
    editorSession.recorder.start();
    renderAudioSection(obj);
  } catch (err) {
    showToast('Tidak bisa mengakses mikrofon: ' + err.message, true);
  }
}

async function playCurrentAudio(obj) {
  if (!obj.audioBlob) return;
  if (editorSession.audioPreviewURL) URL.revokeObjectURL(editorSession.audioPreviewURL);
  editorSession.audioPreviewURL = URL.createObjectURL(obj.audioBlob);
  const audio = new Audio(editorSession.audioPreviewURL);
  await audio.play();
}

function deleteRecording(obj) {
  if (!confirm('Hapus rekaman suara?')) return;
  editorSession.pendingAudioBlob = null;
  if (obj) {
    obj.audioBlob = null;
    obj.useRecording = false;
    obj.audioType = 'tts';
  }
  renderAudioSection({ audioBlob: null, useRecording: false });
}

function bindObjectForm(objects, getSettings, refreshList, refreshMeta) {
  document.getElementById('btnAddObject').onclick = addNewObject;

  const btnPlay = document.getElementById('btnPlay');
  if (btnPlay) {
    btnPlay.onclick = () => {
      window.open('index.html', '_blank');
    };
  }

  document.getElementById('inpPhoto').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      editorSession.pendingImageBlob = await resizeImage(file);
      if (editorSession.previewImageURL) URL.revokeObjectURL(editorSession.previewImageURL);
      editorSession.previewImageURL = URL.createObjectURL(editorSession.pendingImageBlob);
      document.getElementById('photoPreview').innerHTML = `<img src="${editorSession.previewImageURL}" alt="preview" style="max-width:100%;max-height:100%;object-fit:contain;">`;
    } catch (err) {
      showToast('Gagal memproses foto: ' + err.message, true);
      editorSession.pendingImageBlob = null;
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
      editorSession.pendingImageBlob = await resizeImage(blob);
      if (editorSession.previewImageURL) URL.revokeObjectURL(editorSession.previewImageURL);
      editorSession.previewImageURL = URL.createObjectURL(editorSession.pendingImageBlob);
      document.getElementById('photoPreview').innerHTML = `<img src="${editorSession.previewImageURL}" alt="preview" style="max-width:100%;max-height:100%;object-fit:contain;">`;
      showToast('Foto dari URL siap');
    } catch (err) {
      showToast('Gagal memuat foto dari URL: ' + err.message, true);
      editorSession.pendingImageBlob = null;
    }
  });

  document.getElementById('inpColor').addEventListener('input', (e) => {
    const color = e.target.value;
    document.getElementById('photoPreview').style.setProperty('--preview-color', color);
    const name = document.getElementById('inpName').value.trim();
    renderPreview({ id: 'preview', name, color, imageBlob: null });
  });

  // Live Kata toggle guard: multi-word names are not spellable, so the
  // "Aktif di TepuQ Kata" checkbox is disabled and unchecked for them.
  document.getElementById('inpName').addEventListener('input', (e) => {
    const check = document.getElementById('inpKataEnabled');
    if (!check) return;
    const multi = isMultiWord(e.target.value);
    check.disabled = multi;
    if (multi) check.checked = false;
  });

  document.getElementById('objectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isNew = !editorSession.selectedObjectId;
    const id = editorSession.selectedObjectId || ('obj_' + Date.now());
    const existing = objects.find((o) => o.id === id);
    const file = document.getElementById('inpPhoto').files[0];
    const keyInput = document.getElementById('inpKeys').value;
    const useRecording = document.getElementById('inpUseRecording')?.checked || false;
    const finalAudioBlob = editorSession.pendingAudioBlob !== null ? editorSession.pendingAudioBlob : (existing?.audioBlob || null);

    const newObj = {
      id,
      name: document.getElementById('inpName').value.trim(),
      ttsText: document.getElementById('inpTts').value.trim() || document.getElementById('inpName').value.trim(),
      color: document.getElementById('inpColor').value,
      animation: document.getElementById('inpAnimation').value,
      imageUrl: editorSession.pendingImageBlob ? null : (existing?.imageUrl || null),
      imageBlob: editorSession.pendingImageBlob || (existing?.imageBlob || null),
      imageSource: editorSession.pendingImageBlob ? 'custom' : (existing?.imageSource || 'custom'),
      audioBlob: finalAudioBlob,
      useRecording: finalAudioBlob ? useRecording : false,
      audioType: finalAudioBlob && useRecording ? 'recording' : 'tts',
      active: document.getElementById('inpActive').checked,
      kataEnabled: readKataEnabled(),
      order: existing ? existing.order : objects.length,
      keyBindings: keyStringToBindings(keyInput),
      source: 'custom',
    };
    await putObject(newObj);
    const idx = objects.findIndex((o) => o.id === id);
    if (idx >= 0) objects[idx] = newObj;
    else objects.push(newObj);
    editorSession.selectedObjectId = id;
    document.getElementById('editorTitle').textContent = 'Edit Objek';
    editorSession.pendingImageBlob = null;
    editorSession.pendingAudioBlob = null;
    refreshList();
    renderPreview(newObj);
    renderAudioSection(newObj);
    showToast('Objek disimpan');
  });

  document.getElementById('btnTestTts').onclick = async () => {
    await unlockAudioContext();
    speakOrPlay({
      ttsText: document.getElementById('inpTts').value.trim() || document.getElementById('inpName').value.trim() || 'Halo',
      audioBlob: null,
      useRecording: false,
    }, getSettings());
  };

  document.getElementById('btnDeleteObject').onclick = async () => {
    if (!editorSession.selectedObjectId) return;
    if (!confirm('Yakin hapus objek ini?')) return;
    const idx = objects.findIndex((o) => o.id === editorSession.selectedObjectId);
    if (idx >= 0) objects.splice(idx, 1);
    await deleteObject(editorSession.selectedObjectId);
    editorSession.selectedObjectId = null;
    document.getElementById('objectForm').classList.add('hidden');
    document.getElementById('noSelection').classList.remove('hidden');
    refreshList();
    showToast('Objek dihapus');
  };

  document.getElementById('btnCancel').onclick = () => {
    editorSession.selectedObjectId = null;
    document.getElementById('objectForm').classList.add('hidden');
    document.getElementById('noSelection').classList.remove('hidden');
  };
}

function switchEditorTab(name) {
  document.querySelectorAll('#editorTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.editortab === name));
  document.getElementById('editorTabEditor').classList.toggle('hidden', name !== 'editor');
  document.getElementById('editorTabSettings').classList.toggle('hidden', name !== 'settings');
  document.getElementById('editorTabKataSettings').classList.toggle('hidden', name !== 'kata-settings');
}

// Multi-word names ("Sikat Gigi") cannot be spelled as one word in TepuQ Kata.
function isMultiWord(name) {
  return String(name || '').trim().includes(' ');
}

// The Kata toggle is only meaningful for single-word names.
function readKataEnabled() {
  const name = document.getElementById('inpName').value.trim();
  const check = document.getElementById('inpKataEnabled');
  if (!check || isMultiWord(name)) return false;
  return check.checked;
}

function normalizeImageBlob(blob) {
  if (!blob) return blob;
  const type = blob.type || '';
  if (type === 'image/jpg' || type === '') {
    return new Blob([blob], { type: 'image/jpeg' });
  }
  return blob;
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(str) {
  return (str || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
