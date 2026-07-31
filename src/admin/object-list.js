import { getPlaceholder, escapeHtml, showToast } from '../utils.js';
import { putObject, getAllObjects } from '../db.js';

export function renderObjectList(objects, selectFn) {
  const list = document.getElementById('objectList');
  list.innerHTML = '';
  const sorted = [...objects].sort((a, b) => a.order - b.order);
  sorted.forEach((obj) => {
    const item = document.createElement('div');
    item.className = 'object-item ' + (obj.active ? 'active' : 'inactive');
    item.style.setProperty('--obj-color', obj.color || '#ddd');
    item.draggable = true;
    item.dataset.id = obj.id;
    item.innerHTML = `
      <img class="obj-thumb" src="${obj.imageUrl || (obj.imageBlob ? URL.createObjectURL(obj.imageBlob) : getPlaceholder(obj))}" alt="">
      <div class="obj-info">
        <div class="obj-name">${escapeHtml(obj.name)} <span class="obj-source ${obj.source === 'custom' ? 'custom' : 'starter'}">${obj.source === 'custom' ? 'custom' : 'default'}</span></div>
        <div style="font-size:11px;color:#666">${escapeHtml(obj.ttsText || obj.name)}${(obj.keyBindings || []).length ? ' · keys: ' + obj.keyBindings.join(', ') : ''}</div>
      </div>
      <div class="obj-actions">
        <button class="btn small" data-action="edit">Edit</button>
        <button class="btn small secondary" data-action="test">Test</button>
        <button class="btn small danger" data-action="delete">Hapus</button>
      </div>
    `;
    item.querySelector('[data-action="edit"]').onclick = (e) => { e.stopPropagation(); selectFn(obj.id); };
    item.querySelector('[data-action="test"]').onclick = (e) => { e.stopPropagation(); testObject(obj); };
    item.querySelector('[data-action="delete"]').onclick = (e) => { e.stopPropagation(); deleteFromList(obj.id); };
    item.addEventListener('click', () => selectFn(obj.id));
    bindDrag(item);
    list.appendChild(item);
  });
}

async function testObject(obj) {
  const { speakOrPlay } = await import('../speech.js');
  const { getSettings } = await import('../db.js');
  const settings = await getSettings();
  speakOrPlay(obj, settings);
}

async function deleteFromList(id) {
  if (!confirm('Yakin hapus objek ini?')) return;
  const { deleteObject } = await import('../db.js');
  await deleteObject(id);
  showToast('Objek dihapus');
  window.dispatchEvent(new CustomEvent('tepuq:refresh-admin'));
}

function bindDrag(item) {
  item.addEventListener('dragstart', (e) => {
    item.classList.add('dragging');
    e.dataTransfer.setData('text/plain', item.dataset.id);
  });
  item.addEventListener('dragend', () => item.classList.remove('dragging'));
  item.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = document.querySelector('.object-item.dragging');
    if (!dragging || dragging === item) return;
    const list = document.getElementById('objectList');
    const children = [...list.children];
    const fromIndex = children.indexOf(dragging);
    const toIndex = children.indexOf(item);
    if (fromIndex < toIndex) item.after(dragging);
    else item.before(dragging);
  });
  item.addEventListener('drop', async (e) => {
    e.preventDefault();
    await saveOrderFromDOM();
  });
}

async function saveOrderFromDOM() {
  const list = document.getElementById('objectList');
  const ids = [...list.children].map((c) => c.dataset.id);
  const objects = await getAllObjects();
  for (let i = 0; i < ids.length; i++) {
    const obj = objects.find((o) => o.id === ids[i]);
    if (obj) {
      obj.order = i;
      await putObject(obj);
    }
  }
  showToast('Urutan disimpan');
  window.dispatchEvent(new CustomEvent('tepuq:refresh-admin'));
}
