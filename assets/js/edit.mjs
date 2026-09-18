import { postToWebApp } from './data.mjs';
import { GRADE_KEYS, baseStatForSlot, itemNameFor } from './catalog.mjs';
import { STATS, statLabel } from './stats.mjs';
import { escapeHtml } from './utils.mjs';

const KEY_STORAGE = 'equipment-sets-edit-key';
const SUB_COUNT = 2;

/** อ่าน/เขียน localStorage แบบไม่พังใน private mode */
function readStoredKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || '';
  } catch (err) {
    return '';
  }
}

function storeKey(value) {
  try {
    localStorage.setItem(KEY_STORAGE, value);
  } catch (err) {
    /* private mode — ใช้ต่อได้ แค่ไม่จำ */
  }
}

const isPercent = (statId) => Boolean(STATS[statId]) && STATS[statId].format === 'percent';
const statFormat = (statId) => (STATS[statId] ? STATS[statId].format : '');

/** ค่าที่เก็บ (0.0853) → ค่าที่พิมพ์ในฟอร์ม (8.53) */
const toInput = (statId, value) => (isPercent(statId) ? Number(value) * 100 : Number(value));
const fromInput = (statId, value) => (isPercent(statId) ? Number(value) / 100 : Number(value));

const statOptions = (selected) =>
  Object.keys(STATS)
    .sort()
    .map(
      (id) =>
        `<option value="${id}"${id === selected ? ' selected' : ''}>${escapeHtml(statLabel(id))}</option>`,
    )
    .join('');

const gradeOptions = (selected) =>
  GRADE_KEYS.map(
    (key, i) =>
      `<option value="${i + 1}"${key === selected ? ' selected' : ''}>${i + 1} · ${escapeHtml(key)}</option>`,
  ).join('');

function subRow(index, statId, value) {
  return `<div class="edit-row edit-row-pair">
    <label for="editSub${index}Type">substat ${index}</label>
    <select id="editSub${index}Type" name="sub${index}Type"><option value="">— ไม่มี —</option>${statOptions(statId)}</select>
    <input id="editSub${index}Value" name="sub${index}Value" type="number" step="any" value="${value}" aria-label="ค่า substat ${index}" />
  </div>`;
}

function dialogHtml(setKey, slot, item, needsKey) {
  const grade = item ? item.grade : GRADE_KEYS[GRADE_KEYS.length - 1];
  const baseStat = baseStatForSlot(slot);
  const subs = (item && item.stats ? item.stats.slice(1) : []).slice(0, SUB_COUNT);

  let rows = '';
  for (let i = 1; i <= SUB_COUNT; i += 1) {
    const [statId, value] = subs[i - 1] || ['', ''];
    rows += subRow(i, statId, statId === '' ? '' : toInput(statId, value));
  }

  return `<form method="dialog">
    <h2 class="edit-title">${escapeHtml(itemNameFor(slot, grade))}</h2>
    <p class="edit-sub">${escapeHtml(setKey)} · slot ${slot}${item ? '' : ' · ช่องว่าง'}</p>

    <div class="edit-row">
      <label for="editLevel">Level</label>
      <input id="editLevel" name="level" type="number" min="1" step="1" value="${item ? item.level : 1}" />
    </div>
    <div class="edit-row">
      <label for="editGrade">Grade</label>
      <select id="editGrade" name="grade">${gradeOptions(grade)}</select>
    </div>
    <div class="edit-row">
      <label for="editPower">Power (M)</label>
      <input id="editPower" name="power" type="number" step="any" value="${item ? item.power : 0}" />
    </div>
    <div class="edit-row">
      <label for="editBase">${escapeHtml(statLabel(baseStat))}</label>
      <input id="editBase" name="base" type="number" step="any" value="${item ? toInput(baseStat, item.stats[0][1]) : 0}" />
    </div>
    ${rows}
    ${
      needsKey
        ? `<div class="edit-row">
      <label for="editKey">Edit key</label>
      <input id="editKey" name="editKey" type="password" autocomplete="off" placeholder="ตั้งไว้ใน Script Properties" />
    </div>`
        : ''
    }

    <p class="edit-status" id="editStatus"></p>
    <div class="edit-actions">
      ${item ? '<button type="submit" value="clear">ลบออก</button>' : ''}
      <button type="submit" value="cancel">ยกเลิก</button>
      <button type="submit" value="save">บันทึก</button>
    </div>
  </form>`;
}

/**
 * โหมดแก้ไข — กดการ์ดแล้วแก้ค่า ส่งกลับไปเขียนชีตผ่าน doPost
 *
 * NOTE: ปุ่มจะโผล่เฉพาะตอนที่ต่อกับ Web App ได้จริง (มี webAppUrl)
 * ถ้าใช้ข้อมูลสำรองในเว็บอยู่ ก็ไม่มีอะไรให้เขียนกลับ
 */
export function createEditUi({ onSaved }) {
  let webAppUrl = '';
  let sets = [];
  let editing = false;
  let dialog = null;
  let toggle = null;

  const setOf = (setKey) => sets.find((set) => set.setKey === setKey);

  function configure(payload) {
    sets = payload.sets;
    webAppUrl = payload.webAppUrl || '';
  }

  function setEditing(next) {
    editing = next;
    document.body.classList.toggle('is-editing', editing);
    if (toggle) {
      toggle.setAttribute('aria-pressed', editing ? 'true' : 'false');
    }
  }

  function collect(form, slot) {
    const baseStat = baseStatForSlot(slot);
    const subs = [];
    for (let i = 1; i <= SUB_COUNT; i += 1) {
      const statId = form.elements[`sub${i}Type`].value;
      const raw = form.elements[`sub${i}Value`].value;
      if (statId && raw !== '') {
        subs.push([statId, fromInput(statId, raw), statFormat(statId)]);
      }
    }
    return {
      level: Number(form.elements.level.value) || 0,
      grade: Number(form.elements.grade.value),
      power: Number(form.elements.power.value) || 0,
      base: fromInput(baseStat, form.elements.base.value || 0),
      baseFormat: statFormat(baseStat),
      subs,
    };
  }

  async function submit(form, action, setKey, slot) {
    const status = form.querySelector('.edit-status');
    const keyField = form.elements.editKey;
    const key = keyField ? keyField.value.trim() : readStoredKey();
    if (!key) {
      status.dataset.tone = 'error';
      status.textContent = 'ต้องใส่ edit key ก่อน';
      return false;
    }

    form.querySelectorAll('button').forEach((btn) => {
      btn.disabled = true;
    });
    status.dataset.tone = '';
    status.textContent = 'กำลังบันทึก…';

    try {
      const body = { key, action, setKey, slot };
      if (action === 'updateItem') {
        body.item = collect(form, slot);
      }
      const nextSets = await postToWebApp(webAppUrl, body);
      storeKey(key);
      sets = nextSets;
      onSaved(nextSets);
      return true;
    } catch (err) {
      status.dataset.tone = 'error';
      status.textContent = (err && err.message) || 'บันทึกไม่สำเร็จ';
      form.querySelectorAll('button').forEach((btn) => {
        btn.disabled = false;
      });
      return false;
    }
  }

  function openFor(setKey, slot) {
    const set = setOf(setKey);
    if (!set) {
      return;
    }
    const item = set.items[slot - 1] || null;
    dialog.innerHTML = dialogHtml(setKey, slot, item, !readStoredKey());

    const form = dialog.querySelector('form');
    form.addEventListener('submit', async (event) => {
      const action = event.submitter && event.submitter.value;
      if (action === 'cancel') {
        return; // method="dialog" ปิดให้เอง
      }
      event.preventDefault();
      const ok = await submit(form, action === 'clear' ? 'clearSlot' : 'updateItem', setKey, slot);
      if (ok) {
        dialog.close();
      }
    });

    dialog.showModal();
  }

  function bind() {
    dialog = document.getElementById('editDialog');
    toggle = document.getElementById('editModeToggle');
    if (!dialog || !toggle) {
      return;
    }

    toggle.hidden = !webAppUrl;
    if (!webAppUrl) {
      return;
    }

    toggle.addEventListener('click', () => setEditing(!editing));

    document.getElementById('equipmentPage').addEventListener('click', (event) => {
      if (!editing) {
        return;
      }
      const cell = event.target.closest('.card, .grid-empty');
      const section = event.target.closest('.section[data-set-key]');
      if (!cell || !section) {
        return;
      }
      const group = cell.closest('.grid-row-group');
      const cells = Array.from(group.querySelector('.grid').children);
      const slot = Number(group.dataset.rowIndex) * 3 + cells.indexOf(cell) + 1;
      openFor(section.dataset.setKey, slot);
    });
  }

  return { configure, bind, setEditing };
}
