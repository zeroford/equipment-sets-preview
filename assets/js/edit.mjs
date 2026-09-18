import { postToWebApp } from './data.mjs';
import { GRADE_KEYS, baseStatForSlot, itemNameFor, resolveGrade } from './catalog.mjs';
import { SLOT_TYPES } from './constants.mjs';
import { STATS, statLabel } from './stats.mjs';
import { escapeHtml } from './utils.mjs';

const KEY_STORAGE = 'equipment-sets-edit-key';
const SLOT_COUNT = 12;
const SUB_COUNT = 2;

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

// NOTE: 0.0729 * 100 ได้ 7.290000000000001 — ปัดทิ้งก่อนโยนเข้าช่องกรอก
const round6 = (value) => Math.round(Number(value) * 1e6) / 1e6;

/** ค่าที่เก็บ (0.0853) → ค่าที่พิมพ์ในฟอร์ม (8.53) */
const toInput = (statId, value) => round6(isPercent(statId) ? Number(value) * 100 : Number(value));
const fromInput = (statId, value) => round6(isPercent(statId) ? Number(value) / 100 : Number(value));

const titleCase = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function slotOptions(selected) {
  let html = '';
  for (let slot = 1; slot <= SLOT_COUNT; slot += 1) {
    const name = titleCase(SLOT_TYPES[slot - 1] || `slot ${slot}`);
    html += `<option value="${slot}"${slot === selected ? ' selected' : ''}>${slot} · ${escapeHtml(name)}</option>`;
  }
  return html;
}

function gradeOptions(selected) {
  return GRADE_KEYS.map(
    (key, i) =>
      `<option value="${i + 1}"${key === selected ? ' selected' : ''}>${i + 1} · ${escapeHtml(key)}</option>`,
  ).join('');
}

function statOptions(selected) {
  return Object.keys(STATS)
    .sort()
    .map(
      (id) =>
        `<option value="${id}"${id === selected ? ' selected' : ''}>${escapeHtml(statLabel(id))}</option>`,
    )
    .join('');
}

/** ฟอร์มหนึ่งคอลัมน์ = ของชิ้นเดียวใน set นั้น เรียงตาม layout ของการ์ด */
function columnHtml(set, index, slot) {
  const item = (set.items || [])[slot - 1] || null;
  const grade = item ? item.grade : GRADE_KEYS[GRADE_KEYS.length - 1];
  const baseStat = baseStatForSlot(slot);
  const subs = (item && item.stats ? item.stats.slice(1) : []).slice(0, SUB_COUNT);
  const p = `s${index}`;

  let subRows = '';
  for (let i = 1; i <= SUB_COUNT; i += 1) {
    const [statId, value] = subs[i - 1] || ['', ''];
    subRows += `<div class="edit-row edit-row-pair">
      <label for="${p}Sub${i}Type">Sub ${i}</label>
      <select id="${p}Sub${i}Type" name="${p}Sub${i}Type"><option value="">— none —</option>${statOptions(statId)}</select>
      <input id="${p}Sub${i}Value" name="${p}Sub${i}Value" type="number" step="any" value="${
        statId === '' ? '' : toInput(statId, value)
      }" aria-label="Sub ${i} value" />
    </div>`;
  }

  return `<div class="edit-col">
    <p class="edit-col-title">${escapeHtml(set.title)}${item ? '' : ' · empty'}</p>
    <p class="edit-col-name">${escapeHtml(itemNameFor(slot, grade))}</p>

    <div class="edit-row">
      <label for="${p}Grade">Rarity</label>
      <select id="${p}Grade" name="${p}Grade">${gradeOptions(grade)}</select>
    </div>
    <div class="edit-row">
      <label for="${p}Level">Lv.</label>
      <input id="${p}Level" name="${p}Level" type="number" min="1" step="1" value="${item ? item.level : ''}" />
    </div>
    <div class="edit-row">
      <label for="${p}Power">Power (M)</label>
      <input id="${p}Power" name="${p}Power" type="number" step="any" value="${item ? item.power : ''}" />
    </div>
    <div class="edit-row">
      <label for="${p}Base">${escapeHtml(statLabel(baseStat))}</label>
      <input id="${p}Base" name="${p}Base" type="number" step="any" value="${
        item ? toInput(baseStat, item.stats[0][1]) : ''
      }" />
    </div>
    ${subRows}
    ${item ? `<button type="button" class="edit-remove" data-remove="${index}">Remove from ${escapeHtml(set.title)}</button>` : ''}
  </div>`;
}

function dialogHtml(pair, slot, needsKey) {
  return `<form method="dialog">
    <div class="edit-row">
      <label for="editSlot">Slot</label>
      <select id="editSlot" name="slot">${slotOptions(slot)}</select>
    </div>

    <div class="edit-cols">${pair.map((set, i) => columnHtml(set, i, slot)).join('')}</div>

    ${
      needsKey
        ? `<div class="edit-row">
      <label for="editKey">Edit key</label>
      <input id="editKey" name="editKey" type="password" autocomplete="off" placeholder="set in Script Properties" />
    </div>`
        : ''
    }

    <p class="edit-status" id="editStatus"></p>
    <div class="edit-actions">
      <button type="submit" value="cancel">Cancel</button>
      <button type="submit" value="save">Save</button>
    </div>
  </form>`;
}

/**
 * ปุ่ม + เปิดฟอร์มแก้ของทีละ slot — เห็นทั้งสอง set พร้อมกัน
 *
 * NOTE: ปุ่มจะโผล่เฉพาะตอนต่อ Web App ได้จริง ถ้าใช้ข้อมูลสำรองในเว็บอยู่
 * ก็ไม่มีอะไรให้เขียนกลับ
 */
export function createEditUi({ onSaved }) {
  let webAppUrl = '';
  let sets = [];
  let dialog = null;
  let menu = null;
  let trigger = null;
  let slot = 1;

  const pair = () => sets.slice(0, 2);

  function configure(payload) {
    sets = payload.sets;
    webAppUrl = payload.webAppUrl || '';
  }

  function collect(form, index, targetSlot) {
    const p = `s${index}`;
    const baseStat = baseStatForSlot(targetSlot);
    const subs = [];
    for (let i = 1; i <= SUB_COUNT; i += 1) {
      const statId = form.elements[`${p}Sub${i}Type`].value;
      const raw = form.elements[`${p}Sub${i}Value`].value;
      if (statId && raw !== '') {
        subs.push([statId, fromInput(statId, raw), statFormat(statId)]);
      }
    }
    return {
      level: Number(form.elements[`${p}Level`].value) || 0,
      grade: Number(form.elements[`${p}Grade`].value),
      power: Number(form.elements[`${p}Power`].value) || 0,
      base: fromInput(baseStat, form.elements[`${p}Base`].value || 0),
      baseFormat: statFormat(baseStat),
      subs,
    };
  }

  function resolveKey(form) {
    const field = form.elements.editKey;
    return field ? field.value.trim() : readStoredKey();
  }

  async function send(form, requests) {
    const status = form.querySelector('.edit-status');
    const key = resolveKey(form);
    if (!key) {
      status.dataset.tone = 'error';
      status.textContent = 'Edit key required';
      return false;
    }

    form.querySelectorAll('button').forEach((btn) => {
      btn.disabled = true;
    });
    status.dataset.tone = '';
    status.textContent = 'Saving…';

    try {
      let latest = sets;
      // NOTE: ยิงทีละ request — Apps Script ล็อกสคริปต์ไว้ ยิงพร้อมกันจะชนกันเอง
      for (const body of requests) {
        latest = await postToWebApp(webAppUrl, Object.assign({ key }, body));
      }
      storeKey(key);
      sets = latest;
      onSaved(latest);
      return true;
    } catch (err) {
      status.dataset.tone = 'error';
      status.textContent = (err && err.message) || 'Save failed';
      form.querySelectorAll('button').forEach((btn) => {
        btn.disabled = false;
      });
      return false;
    }
  }

  function renderDialog() {
    dialog.innerHTML = dialogHtml(pair(), slot, !readStoredKey());
    const form = dialog.querySelector('form');

    form.elements.slot.addEventListener('change', (event) => {
      slot = Number(event.target.value) || 1;
      renderDialog();
    });

    form.addEventListener('click', async (event) => {
      const removeBtn = event.target.closest('.edit-remove');
      if (!removeBtn) {
        return;
      }
      event.preventDefault();
      const set = pair()[Number(removeBtn.dataset.remove)];
      const ok = await send(form, [{ action: 'clearSlot', setKey: set.setKey, slot }]);
      if (ok) {
        renderDialog();
      }
    });

    form.addEventListener('submit', async (event) => {
      const action = event.submitter && event.submitter.value;
      if (action !== 'save') {
        return; // method="dialog" ปิดให้เอง
      }
      event.preventDefault();
      const targetSlot = slot;
      const requests = pair().map((set, i) => ({
        action: 'updateItem',
        setKey: set.setKey,
        slot: targetSlot,
        item: collect(form, i, targetSlot),
      }));
      if (await send(form, requests)) {
        dialog.close();
      }
    });
  }

  function slotButtonsHtml() {
    let html = '';
    for (let n = 1; n <= SLOT_COUNT; n += 1) {
      const type = SLOT_TYPES[n - 1] || '';
      const name = titleCase(type);
      html += `<button type="button" class="add-slot" role="menuitem" data-slot="${n}" title="${escapeHtml(
        name,
      )}" aria-label="${escapeHtml(name)}"><img src="assets/plates/icon_plate_${escapeHtml(
        type,
      )}.png" alt="" width="30" height="30" decoding="async" /></button>`;
    }
    return html;
  }

  function closeMenu() {
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function bind() {
    dialog = document.getElementById('editDialog');
    menu = document.getElementById('addMenu');
    trigger = document.getElementById('editModeToggle');
    const grid = document.getElementById('addSlotGrid');
    if (!dialog || !menu || !trigger || !grid) {
      return;
    }

    menu.hidden = !webAppUrl || pair().length < 2;
    if (menu.hidden) {
      return;
    }

    grid.innerHTML = slotButtonsHtml();

    // จอสัมผัสไม่มี hover เลยให้กดปุ่มเปิด/ปิดเมนูได้ด้วย
    trigger.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    grid.addEventListener('click', (event) => {
      const btn = event.target.closest('.add-slot');
      if (!btn) {
        return;
      }
      slot = Number(btn.dataset.slot) || 1;
      closeMenu();
      renderDialog();
      dialog.showModal();
    });

    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target)) {
        closeMenu();
      }
    });
  }

  return { configure, bind };
}
