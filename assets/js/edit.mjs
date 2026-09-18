import { postToWebApp } from './data.mjs';
import { GRADE_KEYS, baseStatForSlot, itemNameFor } from './catalog.mjs';
import { GRADES, SLOT_TYPES } from './constants.mjs';
import { emptyCellHtml, equipIconPath, renderCard } from './render.mjs';
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

/**
 * NOTE: โชว์เฉพาะ rarity ที่มีสีกรอบใน GRADES — rarity อื่นยังไม่มีทั้งสีและไฟล์ไอคอน
 * ในรีโป เลือกไปการ์ดจะพัง อยากเปิดเพิ่มก็ใส่สีใน constants.mjs + วางรูปใน assets
 */
function gradeOptions(selected) {
  return GRADE_KEYS.map((key, i) => [key, i + 1])
    .filter(([key]) => GRADES[key])
    .map(
      ([key, code]) =>
        `<option value="${code}"${key === selected ? ' selected' : ''}>${code} · ${escapeHtml(key)}</option>`,
    )
    .join('');
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

function cardChrome(slot, grade) {
  const g = GRADES[grade] || GRADES.legendary;
  return {
    grade,
    frame: g.frame,
    glow: g.glow,
    name: itemNameFor(slot, grade),
    icon: equipIconPath({ grade }, slot - 1),
  };
}

/** การ์ดของ set นั้นตามจริง ไว้ดูเทียบก่อนกรอก — อ่านอย่างเดียว */
function previewHtml(set, slot) {
  const item = (set.items || [])[slot - 1] || null;
  return `<div class="edit-preview">
    <p class="edit-col-title">${escapeHtml(set.title)}${item ? '' : ' · empty'}</p>
    ${item ? renderCard(item, slot - 1, []) : emptyCellHtml(slot - 1)}
  </div>`;
}

/**
 * ฟอร์มกรอกของใหม่ — หน้าตาเป็นการ์ดเหมือนกัน จะได้เห็นว่ากรอกแล้วออกมาหน้าตายังไง
 *
 * NOTE: ใช้คลาสเดียวกับการ์ดบนหน้าเว็บ (.card/.name-bar/.stats) ไม่ต้องดูแล layout สองชุด
 */
function formCardHtml(slot) {
  const grade = GRADE_KEYS[GRADE_KEYS.length - 1];
  const chrome = cardChrome(slot, grade);
  const baseStat = baseStatForSlot(slot);

  let subRows = '';
  for (let i = 1; i <= SUB_COUNT; i += 1) {
    subRows += `<li>
      <select name="sub${i}Type" aria-label="Sub ${i} stat"><option value="">— none —</option>${statOptions('')}</select>
      <input name="sub${i}Value" type="number" step="any" class="edit-inline" value="" aria-label="Sub ${i} value" />
    </li>`;
  }

  return `<div class="edit-form-card">
    <p class="edit-col-title">New item</p>

    <article class="card ${escapeHtml(grade)} edit-card" data-card style="--frame:${chrome.frame};--glow:${chrome.glow}">
      <div class="name-bar">
        <span class="name-bar-icon-wrap"><img class="name-bar-icon" src="${escapeHtml(chrome.icon)}" alt="" width="36" height="36" decoding="async" /></span>
        <span class="name-bar-text-wrap"><span class="name-bar-text">${escapeHtml(chrome.name)}</span></span>
      </div>
      <div class="card-body">
        <div class="meta">
          <span class="level">Lv.<input name="level" type="number" min="1" step="1" class="edit-inline" aria-label="Level" /></span>
          <span class="meta-power"><input name="power" type="number" step="any" class="edit-inline" aria-label="Power" />M</span>
        </div>
        <div class="stat-primary-block">
          <span class="label">${escapeHtml(statLabel(baseStat))}</span>
          <span class="value"><input name="base" type="number" step="any" class="edit-inline" aria-label="${escapeHtml(
            statLabel(baseStat),
          )}" /></span>
        </div>
        <ul class="stats">${subRows}</ul>
      </div>
    </article>

    <div class="edit-row">
      <label for="editGrade">Rarity</label>
      <select id="editGrade" name="grade">${gradeOptions(grade)}</select>
    </div>
  </div>`;
}

function dialogHtml(pair, slot, needsKey) {
  return `<form method="dialog">
    <div class="edit-row">
      <label for="editSlot">Slot</label>
      <select id="editSlot" name="slot">${slotOptions(slot)}</select>
    </div>

    <div class="edit-previews">${pair.map((set) => previewHtml(set, slot)).join('')}</div>

    ${formCardHtml(slot)}

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
      ${pair
        .map(
          (set, i) =>
            `<button type="submit" value="replace${i}" class="edit-replace">Replace ${escapeHtml(set.title)}</button>`,
        )
        .join('')}
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

  function collect(form, targetSlot) {
    const baseStat = baseStatForSlot(targetSlot);
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

    form.addEventListener('change', (event) => {
      const select = event.target.closest('select[name="grade"]');
      if (!select) {
        return;
      }
      const chrome = cardChrome(slot, GRADE_KEYS[Number(select.value) - 1]);
      const card = form.querySelector('.edit-card[data-card]');
      card.className = `card ${chrome.grade} edit-card`;
      card.style.setProperty('--frame', chrome.frame);
      card.style.setProperty('--glow', chrome.glow);
      card.querySelector('.name-bar-text').textContent = chrome.name;
      card.querySelector('.name-bar-icon').src = chrome.icon;
    });

    form.addEventListener('submit', async (event) => {
      const action = (event.submitter && event.submitter.value) || '';
      if (!action.startsWith('replace')) {
        return; // method="dialog" ปิดให้เอง
      }
      event.preventDefault();
      const set = pair()[Number(action.slice('replace'.length))];
      const targetSlot = slot;
      const ok = await send(form, [
        {
          action: 'updateItem',
          setKey: set.setKey,
          slot: targetSlot,
          item: collect(form, targetSlot),
        },
      ]);
      if (ok) {
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
