import { getPlaceholder, escapeHtml, showToast, revokeObjectURLs } from '../utils.js';
import { putObject, getAllObjects, getSettings, deleteObject } from '../db.js';
import { speakOrPlay } from '../speech.js';

let listObjectUrls = [];

export function renderObjectList(objects, selectFn) {
  const list = document.getElementById('objectList');
  revokeObjectURLs(listObjectUrls);
  listObjectUrls = [];
  list.innerHTML = '';
  const sorted = [...objects].sort((a, b) => a.order - b.order);
  sorted.forEach((obj) => {
    const item = document.createElement('div');
    item.className = 'object-item ' + (obj.active ? 'active' : 'inactive');
    item.style.setProperty('--obj-color', obj.color || '#ddd');
    item.draggable = true;
    item.dataset.id = obj.id;

    const thumb = document.createElement('img');
    thumb.className = 'obj-thumb';
    thumb.alt = '';
    if (obj.imageUrl) {
      thumb.src = obj.imageUrl;
    } else if (obj.imageBlob) {
      const url = URL.createObjectURL(obj.imageBlob);
      listObjectUrls.push(url);
      thumb.src = url;
    } else {
      thumb.src = getPlaceholder(obj);
    }
    item.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'obj-info';

    const nameLine = document.createElement('div');
    nameLine.className = 'obj-name';
    nameLine.textContent = obj.name;
    const sourceBadge = document.createElement('span');
    sourceBadge.className = 'obj-source ' + (obj.source === 'custom' ? 'custom' : 'starter');
    sourceBadge.textContent = obj.source === 'custom' ? 'custom' : 'default';
    nameLine.appendChild(sourceBadge);
    info.appendChild(nameLine);

    const meta = document.createElement('div');
    meta.style.fontSize = '11px';
    meta.style.color = '#666';
    const keys = obj.keyBindings || [];
    meta.textContent = (obj.ttsText || obj.name) + (keys.length ? ' · keys: ' + keys.map((k) => k.toString()).join(', ') : '');
    info.appendChild(meta);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'obj-actions';
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn small';
    btnEdit.dataset.action = 'edit';
    btnEdit.textContent = 'Edit';
    const btnTest = document.createElement('button');
    btnTest.className = 'btn small secondary';
    btnTest.dataset.action = 'test';
    btnTest.textContent = 'Test';
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn small danger';
    btnDelete.dataset.action = 'delete';
    btnDelete.textContent = 'Hapus';
    actions.append(btnEdit, btnTest, btnDelete);
    item.appendChild(actions);

    btnEdit.onclick = (e) => { e.stopPropagation(); selectFn(obj.id); };
    btnTest.onclick = (e) => { e.stopPropagation(); testObject(obj); };
    btnDelete.onclick = (e) => { e.stopPropagation(); deleteFromList(obj.id); };
    item.addEventListener('click', () => selectFn(obj.id));
    bindDrag(item);
    list.appendChild(item);
  });
}

async function testObject(obj) {
  const settings = await getSettings();
  speakOrPlay(obj, settings);
}

async function deleteFromList(id) {
  if (!confirm('Yakin hapus objek ini?')) return;
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
