// Kata admin word editor: add/edit a word, set category, record or upload
// custom audio, toggle enabled. Mirrors src/admin/editor.js's audio recording
// pattern (MediaRecorder + object URL preview).

import { putKataWord, deleteKataWord } from '../db.js';
import { showToast } from '../utils.js';
import { speakWord } from '../kata/audio.js';
import { unlockAudioContext } from '../speech.js';

const session = {
  selectedId: null,
  recorder: null,
  recordedChunks: [],
  audioPreviewURL: null,
  pendingAudioBlob: null,
};

let wordsRef = [];
let refreshList = null;

export function initKataEditor(words, refresh) {
  wordsRef = words;
  refreshList = refresh;
  bindForm();
}

export function selectWord(id) {
  const word = wordsRef.find((w) => w.id === id);
  if (!word) return;
  session.selectedId = id;
  document.getElementById('kataNoSelection').classList.add('hidden');
  document.getElementById('kataWordForm').classList.remove('hidden');
  document.getElementById('kataEditorTitle').textContent = 'Edit Kata';
  document.getElementById('inpKataWord').value = word.word;
  document.getElementById('inpKataCategory').value = word.category || 'default';
  document.getElementById('inpKataActive').checked = !!word.enabled;
  session.pendingAudioBlob = null;
  renderKataAudioSection(word);
}

export function addNewWord() {
  session.selectedId = null;
  const form = document.getElementById('kataWordForm');
  if (form) form.reset();
  document.getElementById('inpKataCategory').value = 'default';
  document.getElementById('inpKataActive').checked = true;
  document.getElementById('kataEditorTitle').textContent = 'Kata Baru';
  document.getElementById('kataNoSelection').classList.add('hidden');
  document.getElementById('kataWordForm').classList.remove('hidden');
  session.pendingAudioBlob = null;
  renderKataAudioSection({ audioBlob: null, useRecording: false });
}

function bindForm() {
  document.getElementById('btnAddKataWord').onclick = addNewWord;

  document.getElementById('kataWordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isNew = !session.selectedId;
    const id = session.selectedId || ('kata_' + Date.now());
    const existing = wordsRef.find((w) => w.id === id);
    const wordText = document.getElementById('inpKataWord').value.trim().toLowerCase();
    if (!wordText) {
      showToast('Kata tidak boleh kosong', true);
      return;
    }
    const useRecording = document.getElementById('inpKataUseRecording')?.checked || false;
    const finalAudioBlob = session.pendingAudioBlob !== null ? session.pendingAudioBlob : (existing?.audioBlob || null);

    const newWord = {
      id,
      word: wordText,
      display: wordText,
      category: document.getElementById('inpKataCategory').value.trim() || 'default',
      order: existing ? existing.order : wordsRef.length,
      enabled: document.getElementById('inpKataActive').checked,
      audioBlob: finalAudioBlob,
      useRecording: finalAudioBlob ? useRecording : false,
      audioType: finalAudioBlob && useRecording ? 'recording' : 'tts',
      source: 'custom',
    };
    await putKataWord(newWord);
    const idx = wordsRef.findIndex((w) => w.id === id);
    if (idx >= 0) wordsRef[idx] = newWord;
    else wordsRef.push(newWord);
    session.selectedId = id;
    document.getElementById('kataEditorTitle').textContent = 'Edit Kata';
    session.pendingAudioBlob = null;
    refreshList();
    renderKataAudioSection(newWord);
    showToast('Kata disimpan');
  });

  document.getElementById('btnKataTestTts').onclick = async () => {
    await unlockAudioContext();
    speakWord({
      word: document.getElementById('inpKataWord').value.trim() || 'Halo',
      audioBlob: null,
      useRecording: false,
    }, {});
  };

  document.getElementById('btnKataDeleteWord').onclick = async () => {
    if (!session.selectedId) return;
    if (!confirm('Yakin hapus kata ini?')) return;
    await deleteKataWord(session.selectedId);
    const idx = wordsRef.findIndex((w) => w.id === session.selectedId);
    if (idx >= 0) wordsRef.splice(idx, 1);
    session.selectedId = null;
    document.getElementById('kataWordForm').classList.add('hidden');
    document.getElementById('kataNoSelection').classList.remove('hidden');
    refreshList();
    showToast('Kata dihapus');
  };

  document.getElementById('btnKataCancel').onclick = () => {
    session.selectedId = null;
    document.getElementById('kataWordForm').classList.add('hidden');
    document.getElementById('kataNoSelection').classList.remove('hidden');
  };

  document.getElementById('inpKataAudioFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    session.pendingAudioBlob = file;
    renderKataAudioSection({ audioBlob: file, useRecording: true });
    showToast('Audio siap (klik Simpan)');
    e.target.value = '';
  });
}

function renderKataAudioSection(word) {
  const container = document.getElementById('kataAudioSection');
  if (!container) return;
  const hasAudio = !!word.audioBlob;
  container.innerHTML = '';

  const toggleRow = document.createElement('div');
  toggleRow.className = 'toggle-row';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = 'inpKataUseRecording';
  cb.checked = !!word.useRecording;
  const lbl = document.createElement('label');
  lbl.htmlFor = 'inpKataUseRecording';
  lbl.style.margin = '0';
  lbl.textContent = 'Gunakan rekaman/file audio (jika ada)';
  toggleRow.append(cb, lbl);
  container.appendChild(toggleRow);

  const btnRow = document.createElement('div');
  btnRow.style.marginTop = '8px';
  btnRow.style.display = 'flex';
  btnRow.style.gap = '8px';
  btnRow.style.flexWrap = 'wrap';

  const btnRecord = document.createElement('button');
  btnRecord.type = 'button';
  btnRecord.className = 'btn ' + (session.recorder ? 'danger' : 'success');
  btnRecord.textContent = session.recorder ? 'Berhenti' : 'Rekam Suara';
  btnRecord.onclick = () => toggleRecording(word);
  btnRow.appendChild(btnRecord);

  if (hasAudio) {
    const btnPlay = document.createElement('button');
    btnPlay.type = 'button';
    btnPlay.className = 'btn';
    btnPlay.textContent = 'Putar';
    btnPlay.onclick = () => playCurrent(word);
    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'btn danger small';
    btnDelete.textContent = 'Hapus';
    btnDelete.onclick = () => deleteAudio(word);
    btnRow.append(btnPlay, btnDelete);
  }
  container.appendChild(btnRow);

  const status = document.createElement('div');
  status.style.marginTop = '6px';
  status.style.fontSize = '12px';
  status.style.color = hasAudio ? '#27ae60' : '#888';
  status.textContent = hasAudio ? '✓ Sudah ada audio' : 'Belum ada audio';
  container.appendChild(status);
}

async function toggleRecording(word) {
  if (session.recorder) {
    session.recorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    session.recorder = new MediaRecorder(stream);
    session.recordedChunks = [];
    session.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) session.recordedChunks.push(e.data);
    };
    session.recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(session.recordedChunks, { type: 'audio/webm' });
      session.pendingAudioBlob = blob;
      session.recorder = null;
      renderKataAudioSection({ audioBlob: blob, useRecording: true });
    };
    session.recorder.start();
    renderKataAudioSection(word);
  } catch (err) {
    showToast('Tidak bisa mengakses mikrofon: ' + err.message, true);
  }
}

async function playCurrent(word) {
  if (!word.audioBlob) return;
  if (session.audioPreviewURL) URL.revokeObjectURL(session.audioPreviewURL);
  session.audioPreviewURL = URL.createObjectURL(word.audioBlob);
  const audio = new Audio(session.audioPreviewURL);
  await audio.play();
}

function deleteAudio(word) {
  if (!confirm('Hapus audio kata ini?')) return;
  session.pendingAudioBlob = null;
  if (word) {
    word.audioBlob = null;
    word.useRecording = false;
    word.audioType = 'tts';
  }
  renderKataAudioSection({ audioBlob: null, useRecording: false });
}