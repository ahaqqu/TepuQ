// Kata admin word list: table of words with edit/delete/test, drag-to-reorder.
// Mirrors src/admin/object-list.js but for kata_words.

import { showToast, escapeHtml } from '../utils.js';
import { getAllKataWords, putKataWord, deleteKataWord } from '../db.js';
import { speakWord } from '../kata/audio.js';

export function renderWordList(words, selectFn) {
  const list = document.getElementById('kataWordList');
  if (!list) return;
  list.innerHTML = '';
  const sorted = [...words].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  sorted.forEach((word) => {
    const item = document.createElement('div');
    item.className = 'object-item ' + (word.enabled ? 'active' : 'inactive');
    item.draggable = true;
    item.dataset.id = word.id;

    const info = document.createElement('div');
    info.className = 'obj-info';
    const nameLine = document.createElement('div');
    nameLine.className = 'obj-name';
    nameLine.textContent = word.word;
    const badge = document.createElement('span');
    badge.className = 'obj-source ' + (word.source === 'custom' ? 'custom' : 'starter');
    badge.textContent = word.source === 'custom' ? 'custom' : 'default';
    nameLine.appendChild(badge);
    info.appendChild(nameLine);

    const meta = document.createElement('div');
    meta.style.fontSize = '11px';
    meta.style.color = '#666';
    meta.textContent = word.category + (word.useRecording ? ' · rekaman' : ' · TTS');
    info.appendChild(meta);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'obj-actions';
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn small';
    btnEdit.textContent = 'Edit';
    const btnTest = document.createElement('button');
    btnTest.className = 'btn small secondary';
    btnTest.textContent = 'Test';
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn small danger';
    btnDelete.textContent = 'Hapus';
    actions.append(btnEdit, btnTest, btnDelete);
    item.appendChild(actions);

    btnEdit.onclick = (e) => { e.stopPropagation(); selectFn(word.id); };
    btnTest.onclick = (e) => { e.stopPropagation(); testWord(word); };
    btnDelete.onclick = (e) => { e.stopPropagation(); deleteFromList(word.id); };
    item.addEventListener('click', () => selectFn(word.id));
    bindReorder(item);
    list.appendChild(item);
  });
}

async function testWord(word) {
  speakWord(word, {});
}

async function deleteFromList(id) {
  if (!confirm('Yakin hapus kata ini?')) return;
  await deleteKataWord(id);
  showToast('Kata dihapus');
  window.dispatchEvent(new CustomEvent('tepuq:refresh-admin'));
}

function bindReorder(item) {
  item.addEventListener('dragstart', (e) => {
    item.classList.add('dragging');
    e.dataTransfer.setData('text/plain', item.dataset.id);
  });
  item.addEventListener('dragend', () => item.classList.remove('dragging'));
  item.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = document.querySelector('#kataWordList .object-item.dragging');
    if (!dragging || dragging === item) return;
    const list = document.getElementById('kataWordList');
    const children = [...list.children];
    const fromIndex = children.indexOf(dragging);
    const toIndex = children.indexOf(item);
    if (fromIndex < toIndex) item.after(dragging);
    else item.before(dragging);
  });
  item.addEventListener('drop', async (e) => {
    e.preventDefault();
    await saveKataOrder();
  });
}

async function saveKataOrder() {
  const list = document.getElementById('kataWordList');
  const ids = [...list.children].map((c) => c.dataset.id);
  const words = await getAllKataWords();
  for (let i = 0; i < ids.length; i++) {
    const w = words.find((x) => x.id === ids[i]);
    if (w) {
      w.order = i;
      await putKataWord(w);
    }
  }
  showToast('Urutan disimpan');
  window.dispatchEvent(new CustomEvent('tepuq:refresh-admin'));
}