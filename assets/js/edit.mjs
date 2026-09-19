import { postToWebApp } from './data.mjs';
import { GRADE_KEYS, baseStatForSlot, itemNameFor } from './catalog.mjs';
import { GRADES, SLOT_TYPES, bestSubstatFor } from './constants.mjs';
import { emptyCellHtml, equipIconPath, renderCard, rollMarkHtml, statTagsHtml } from './render.mjs';
import { computeBaseStat, subStatFixed, subStatRange, subStatRatio } from './base-stat.mjs';
import { STATS, formatStat, formatStatRange, statLabel } from './stats.mjs';
import { escapeHtml } from './utils.mjs';

const KEY_STORAGE = 'equipment-sets-edit-key';
const SLOT_COUNT = 12;
/** ยังไม่เลือก slot — เปิดฟอร์มมาใหม่ทุกครั้งจะอยู่สถานะนี้ */
const NO_SLOT = 0;
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

/** ตารางไอคอน 6×2 สำหรับเลือก slot — รูปเป็นไอเทมจริงของเกรดที่เลือกอยู่ */
function slotButtonsHtml(selected, grade) {
  let html = '';
  for (let n = 1; n <= SLOT_COUNT; n += 1) {
    const name = titleCase(SLOT_TYPES[n - 1] || '');
    html += `<button type="button" class="add-slot" data-slot="${n}" aria-pressed="${n === selected}" title="${escapeHtml(
      name,
    )}" aria-label="${escapeHtml(name)}"><img src="${escapeHtml(
      equipIconPath({ grade }, n - 1),
    )}" alt="" width="30" height="30" decoding="async" /></button>`;
  }
  return html;
}

/**
 * Rarity เป็นปุ่มสลับ ไม่ใช่ dropdown — มีให้เลือกไม่กี่ตัว เห็นพร้อมกันหมดเลยเร็วกว่า
 *
 * NOTE: โชว์เฉพาะ rarity ที่มีสีกรอบใน GRADES — rarity อื่นยังไม่มีทั้งสีและไฟล์ไอคอน
 * ในรีโป เลือกไปการ์ดจะพัง อยากเปิดเพิ่มก็ใส่สีใน constants.mjs + วางรูปใน assets
 *
 * NOTE: ค่าจริงอยู่ใน input ที่ซ่อนไว้ ตอนกดปุ่มถึงยิง change ให้เอง — โค้ดที่เหลือ
 * เลยอ่าน form.elements.grade ได้เหมือนตอนเป็น <select>
 */
function rarityToggleHtml(selected) {
  const buttons = GRADE_KEYS.map((key, i) => [key, i + 1])
    .filter(([key]) => GRADES[key])
    // เกรดสูงสุดขึ้นก่อน — เป็นตัวที่เลือกบ่อยสุด
    .reverse()
    .map(
      ([key, code]) =>
        `<button type="button" class="rarity-option" data-grade="${code}" aria-pressed="${key === selected}">${escapeHtml(titleCase(key))}</button>`,
    )
    .join('');
  const code = GRADE_KEYS.indexOf(selected) + 1;
  return `<div class="rarity-group glass-chip" role="group" aria-label="Rarity">${buttons}</div><input type="hidden" name="grade" value="${code}" />`;
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

/** ยังไม่เลือก slot ก็ยังไม่มีรูปไอเทม — โชว์เครื่องหมาย + ให้รู้ว่ากดได้ */
function slotIconHtml(slot, icon) {
  return slot
    ? `<img class="name-bar-icon" src="${escapeHtml(icon)}" alt="" width="36" height="36" decoding="async" />`
    : '<svg class="slot-pick-hint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>';
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

/**
 * การ์ดของ set นั้นตามจริง ไว้ดูเทียบก่อนกรอก — อ่านอย่างเดียว
 *
 * NOTE: ต้องส่ง best stat ของโหมดที่ set นั้นเลือกอยู่เข้าไปด้วย ไม่งั้นการ์ดในนี้
 * ไม่ highlight อะไรเลย ดูไม่เหมือนใบเดียวกันกับที่อยู่บนหน้าเว็บ
 */
function previewHtml(set, slot, mode) {
  if (!slot) {
    return `<div class="edit-preview">
      <p class="edit-col-title">${escapeHtml(set.title)}</p>
      <div class="edit-blank">Pick a slot</div>
    </div>`;
  }
  const item = (set.items || [])[slot - 1] || null;
  const bestStats = bestSubstatFor(mode).rows[Math.floor((slot - 1) / 3)] || [];
  return `<div class="edit-preview">
    <p class="edit-col-title">${escapeHtml(set.title)}${item ? '' : ' · empty'}</p>
    <p class="edit-tags">${statTagsHtml(bestStats)}</p>
    ${item ? renderCard(item, slot - 1, bestStats) : emptyCellHtml(slot - 1)}
  </div>`;
}

/**
 * ฟอร์มกรอกของใหม่ — หน้าตาเป็นการ์ดเหมือนกัน จะได้เห็นว่ากรอกแล้วออกมาหน้าตายังไง
 *
 * NOTE: ใช้คลาสเดียวกับการ์ดบนหน้าเว็บ (.card/.name-bar/.stats) ไม่ต้องดูแล layout สองชุด
 */
function formCardHtml(slot, grade) {
  const chrome = cardChrome(slot, grade);
  const baseStat = baseStatForSlot(slot);
  const iconHtml = slotIconHtml(slot, chrome.icon);

  let subRows = '';
  for (let i = 1; i <= SUB_COUNT; i += 1) {
    // NOTE: ช่วงค่าใต้ช่องกรอกใช้หน่วยเดียวกับที่พิมพ์ (8.53 ไม่ใช่ 0.0853) จะได้เทียบกันตรงๆ
    subRows += `<li>
      <span class="edit-sub-label">Substat ${i}</span>
      <span class="ui-select">
        <select name="sub${i}Type" aria-label="Substat ${i} type" hidden><option value="">— none —</option>${statOptions('')}</select>
        <button type="button" class="ui-select-trigger" data-select="${i}" aria-haspopup="listbox" aria-expanded="false"><span class="ui-select-text" data-select-text="${i}">— none —</span><svg class="ui-select-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
      </span>
      <span class="edit-sub-value">
        <span class="edit-field">
          <span class="edit-sub-mark" data-sub-mark="${i}" aria-hidden="true"></span>
          <input name="sub${i}Value" type="number" step="any" class="edit-inline" value="" aria-label="Substat ${i} value" />
          <span class="edit-unit" data-sub-unit="${i}" aria-hidden="true">%</span>
        </span>
        <small class="stat-range" data-sub-range="${i}"></small>
      </span>
    </li>`;
  }

  /*
   * ทุกช่องกรอกอยู่ในการ์ด และอยู่ตรงที่ค่านั้นจะไปโผล่จริง — ไอคอนคือ slot,
   * badge คือ level, ช่องขวาบนคือ power กรอกแล้วเห็นผลทันทีในที่เดียวกัน
   */
  return `<div class="edit-form-card">
    <article class="card ${escapeHtml(grade)} edit-card" data-card style="--frame:${chrome.frame};--glow:${chrome.glow}">
      <div class="name-bar edit-name-bar">
        <span class="name-bar-icon-wrap">
          <button type="button" class="slot-pick" data-slot-pick aria-expanded="false" aria-label="Pick a slot" title="Pick a slot">${iconHtml}</button>
        </span>
        <div class="edit-name-lines">
          <span class="name-bar-text">${escapeHtml(slot ? chrome.name : '')}</span>
          <div class="edit-name-controls">
            <span class="edit-lv">Lv.<input name="level" type="number" min="1" step="1" class="level-input" aria-label="Level" autofocus /></span>
            ${rarityToggleHtml(grade)}
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="stat-primary-block">
          <span class="primary-cell">
            <span class="label">${escapeHtml(slot ? statLabel(baseStat) : '—')}</span>
            <span class="value" data-base-display>—</span>
          </span>
          <span class="primary-cell is-power">
            <span class="label">Power</span>
            <span class="edit-field edit-power-field">
              <input name="power" type="number" step="any" class="power-input" placeholder="—" aria-label="Power in millions" />
              <span class="edit-unit" aria-hidden="true">M</span>
            </span>
          </span>
        </div>
        <ul class="stats">${subRows}</ul>
      </div>
    </article>

    <div class="slot-picker glass-chip" data-slot-picker role="group" aria-label="Slot" hidden>${slotButtonsHtml(slot, grade)}</div>
    <div class="ui-select-list" data-select-list role="listbox" hidden></div>
  </div>`;
}

/**
 * ซ้าย = ของเดิมทั้งสอง set วางซ้อนกันไว้เทียบ / ขวา = ตัวเลือก slot กับฟอร์ม
 *
 * NOTE: แยกเป็นคอลัมน์ของใครของมัน ไม่ใช่กริดแถวเดียวกัน — ไม่งั้นแถวบนจะสูงตาม
 * การ์ด Set A ทั้งที่ฝั่งขวามีแค่ช่องเลือก slot บรรทัดเดียว
 */
function dialogHtml(pair, slot, modeFor) {
  const grade = GRADE_KEYS[GRADE_KEYS.length - 1];
  /*
   * NOTE: หัวเรื่องกับปุ่มอยู่ในคอลัมน์ขวา ไม่ใช่คร่อมทั้ง modal — ทุกอย่างที่เกี่ยวกับ
   * "สร้างของใหม่" เลยอยู่ฝั่งเดียวกันหมด และเส้นคั่นพาดได้เต็มความสูงโดยไม่มีอะไรมาขวาง
   */
  return `<form method="dialog">
    <div class="edit-cols">
      <div class="edit-col" data-previews>${pair.map((set) => previewHtml(set, slot, modeFor(set.setKey))).join('')}</div>
      <div class="edit-col">
        <header class="edit-header">
          <h2 class="edit-title">New item</h2>
          <button type="submit" value="cancel" class="edit-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        </header>

        ${formCardHtml(slot, grade)}

        <p class="edit-status" id="editStatus"></p>
        <div class="edit-actions">
          <button type="submit" value="cancel">Cancel</button>
          ${pair
            .map(
              (set, i) =>
                `<button type="submit" value="replace${i}" class="edit-replace" disabled>Replace ${escapeHtml(set.title)}</button>`,
            )
            .join('')}
        </div>
      </div>
    </div>
  </form>`;
}

/**
 * ปุ่ม + เปิดฟอร์มแก้ของทีละ slot — เห็นทั้งสอง set พร้อมกัน
 *
 * NOTE: ปุ่มจะโผล่เฉพาะตอนต่อ Web App ได้จริง ถ้าใช้ข้อมูลสำรองในเว็บอยู่
 * ก็ไม่มีอะไรให้เขียนกลับ
 */
export function createEditUi({ onSaved, modeFor }) {
  let webAppUrl = '';
  let sets = [];
  let dialog = null;
  let menu = null;
  let trigger = null;
  let slot = NO_SLOT;

  const pair = () => sets.slice(0, 2);

  function configure(payload) {
    sets = payload.sets;
    webAppUrl = payload.webAppUrl || '';
  }

  /** base stat คำนวณจาก slot + rarity + level ไม่ได้ให้กรอก */
  function baseValue(form, targetSlot) {
    const grade = Number(form.elements.grade.value);
    const level = Number(form.elements.level.value);
    return computeBaseStat(targetSlot, grade, level);
  }

  function collect(form, targetSlot) {
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
      power: Number(form.elements.power.value) || 0,
      grade: Number(form.elements.grade.value),
      subs,
    };
  }

  /**
   * NOTE: ไม่มีช่องกรอกในฟอร์มแล้ว — เก็บไว้ในเครื่องตั้งแต่ครั้งแรก
   * ยังต้องส่งอยู่เพราะ Web App เปิด public ใครเจอ URL ก็ยิงเขียนทับได้
   */
  function resolveKey() {
    const stored = readStoredKey();
    if (stored) {
      return stored;
    }
    return (window.prompt('Edit key (ตั้งไว้ใน Script Properties)') || '').trim();
  }

  async function send(form, requests) {
    const status = form.querySelector('.edit-status');
    const key = resolveKey();
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
    dialog.innerHTML = dialogHtml(pair(), slot, modeFor);
    const form = dialog.querySelector('form');

    // ไอคอนในการ์ด = ปุ่มเปิดตารางเลือก slot
    const picker = form.querySelector('[data-slot-picker]');
    const pickBtn = form.querySelector('[data-slot-pick]');
    const host = form.querySelector('.edit-form-card');
    const setPickerOpen = (open) => {
      if (open) {
        // NOTE: วัดจากของจริงตอนเปิด ขนาดหัวการ์ดเปลี่ยนเมื่อไหร่ตำแหน่งก็ตามเอง
        const h = host.getBoundingClientRect();
        const b = pickBtn.getBoundingClientRect();
        picker.style.left = `${b.left - h.left}px`;
        picker.style.top = `${b.bottom - h.top + 6}px`;
      }
      picker.hidden = !open;
      pickBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    pickBtn.addEventListener('click', () => setPickerOpen(picker.hidden));
    // กดที่อื่นในฟอร์มแล้วปิด เหมือน dropdown ทั่วไป
    form.addEventListener('click', (event) => {
      if (!picker.hidden && !picker.contains(event.target) && !pickBtn.contains(event.target)) {
        setPickerOpen(false);
      }
    });
    picker.addEventListener('click', (event) => {
      const btn = event.target.closest('.add-slot');
      if (!btn) {
        return;
      }
      slot = Number(btn.dataset.slot) || 1;
      setPickerOpen(false);
      applySlot();
    });

    /*
     * ยังไม่เลือก slot หรือยังไม่ใส่ level = ยังไม่ต้องโชว์ช่อง substat
     * ช่วงค่าของ substat ผูกกับ slot + rarity ส่วน base stat ผูกกับ level
     * โผล่มาก่อนก็กรอกได้แต่ไม่มีอะไรมาบอกว่ากรอกถูกหรือผิด
     */
    const refreshBase = () => {
      const cell = form.querySelector('[data-base-display]');
      const value = slot ? baseValue(form, slot) : null;
      cell.textContent = value === null ? '—' : formatStat(baseStatForSlot(slot), value);

      const ready = Boolean(slot) && Number(form.elements.level.value) > 0;
      // NOTE: ต้องระบุ .edit-card — การ์ดตัวอย่างซ้ายมือก็มี .stats เหมือนกัน
      form.querySelector('.edit-card .stats').hidden = !ready;
      form.querySelectorAll('.edit-replace').forEach((btn) => {
        btn.disabled = !ready;
      });
    };
    /**
     * ช่วงค่าของ substat ที่เลือก — ขึ้นกับ slot + rarity เลยต้องคิดใหม่ทุกครั้งที่เปลี่ยน
     *
     * NOTE: stat ที่โรลไม่ได้ (Skill Haste) เติมค่าให้แล้วล็อกช่องไว้ มีทางเลือกเดียว
     * จะให้กรอกเองก็มีแต่จะกรอกผิด
     */
    const refreshMarks = () => {
      const grade = Number(form.elements.grade.value);
      for (let i = 1; i <= SUB_COUNT; i += 1) {
        const statId = form.elements[`sub${i}Type`].value;
        const raw = form.elements[`sub${i}Value`].value;
        const ratio =
          statId && raw !== '' ? subStatRatio(slot, grade, statId, fromInput(statId, raw)) : null;
        form.querySelector(`[data-sub-mark="${i}"]`).innerHTML =
          ratio === null ? '' : rollMarkHtml(ratio);
      }
    };

    const refreshSubs = () => {
      const grade = Number(form.elements.grade.value);
      for (let i = 1; i <= SUB_COUNT; i += 1) {
        const statId = form.elements[`sub${i}Type`].value;
        const input = form.elements[`sub${i}Value`];
        const range = statId ? subStatRange(slot, grade, statId) : null;
        const fixed = statId && !range ? subStatFixed(slot, grade, statId) : null;

        if (fixed !== null) {
          input.value = toInput(statId, fixed);
          input.readOnly = true;
        } else {
          // เพิ่งเปลี่ยนออกจาก stat ที่ล็อกไว้ — ค่าเดิมไม่เกี่ยวกับ stat ใหม่แล้ว
          if (input.readOnly) {
            input.value = '';
          }
          input.readOnly = false;
        }

        form.querySelector(`[data-sub-range="${i}"]`).textContent = range
          ? formatStatRange(statId, range[0], range[1])
          : '';
        form.querySelector(`[data-sub-unit="${i}"]`).hidden = !isPercent(statId);
      }
      refreshMarks();
    };

    /*
     * Dropdown ที่วาดเอง — <select> ตัวจริงยังอยู่ (ซ่อนไว้) เป็นที่เก็บค่า
     * โค้ดส่วนอื่นเลยอ่าน form.elements.subNType ได้เหมือนเดิม แค่ยิง change ให้ตอนเลือก
     */
    const list = form.querySelector('[data-select-list]');
    const closeList = () => {
      list.hidden = true;
      form.querySelectorAll('[data-select]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    };
    const openList = (index) => {
      const select = form.elements[`sub${index}Type`];
      list.innerHTML = Array.from(select.options)
        .map(
          (opt) =>
            `<button type="button" class="ui-select-option" role="option" aria-selected="${opt.value === select.value}" data-value="${escapeHtml(opt.value)}">${escapeHtml(opt.textContent)}</button>`,
        )
        .join('');
      list.dataset.for = String(index);
      const h = host.getBoundingClientRect();
      const trigger = form.querySelector(`[data-select="${index}"]`).getBoundingClientRect();
      list.style.left = `${trigger.left - h.left}px`;
      list.style.top = `${trigger.bottom - h.top + 6}px`;
      list.style.width = `${trigger.width}px`;
      list.hidden = false;
      form.querySelector(`[data-select="${index}"]`).setAttribute('aria-expanded', 'true');
    };

    form.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-select]');
      if (trigger) {
        const index = trigger.dataset.select;
        const wasOpen = !list.hidden && list.dataset.for === index;
        closeList();
        if (!wasOpen) {
          openList(index);
        }
        return;
      }

      const option = event.target.closest('.ui-select-option');
      if (option) {
        const index = list.dataset.for;
        const select = form.elements[`sub${index}Type`];
        select.value = option.dataset.value;
        form.querySelector(`[data-select-text="${index}"]`).textContent = option.textContent;
        closeList();
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }

      if (!list.hidden) {
        closeList();
      }
    });

    /**
     * วาดส่วนที่ผูกกับ slot/rarity ใหม่
     *
     * NOTE: ไม่ render ทั้ง dialog ใหม่ — ไม่งั้น level/power/substat ที่พิมพ์ไว้แล้ว
     * หายหมดทุกครั้งที่สลับ slot
     */
    function applySlot() {
      const gradeKey = GRADE_KEYS[Number(form.elements.grade.value) - 1];
      const chrome = cardChrome(slot, gradeKey);
      const card = form.querySelector('.edit-card[data-card]');

      card.className = `card ${chrome.grade} edit-card`;
      card.style.setProperty('--frame', chrome.frame);
      card.style.setProperty('--glow', chrome.glow);
      pickBtn.innerHTML = slotIconHtml(slot, chrome.icon);

      card.querySelector('.name-bar-text').textContent = slot ? chrome.name : '';

      card.querySelector('.primary-cell .label').textContent = slot
        ? statLabel(baseStatForSlot(slot))
        : '—';

      // การ์ดตัวอย่างสองใบซ้ายมือขึ้นกับ slot ล้วนๆ
      form.querySelector('[data-previews]').innerHTML = pair()
        .map((set) => previewHtml(set, slot, modeFor(set.setKey)))
        .join('');
      picker.innerHTML = slotButtonsHtml(slot, gradeKey);

      refreshBase();
      refreshSubs();
    }

    refreshBase();
    refreshSubs();
    form.elements.level.addEventListener('input', refreshBase);
    form.elements.grade.addEventListener('change', applySlot);
    for (let i = 1; i <= SUB_COUNT; i += 1) {
      form.elements[`sub${i}Type`].addEventListener('change', refreshSubs);
      form.elements[`sub${i}Value`].addEventListener('input', refreshMarks);
    }

    // ปุ่ม rarity เขียนค่าลง input ที่ซ่อนไว้ แล้วยิง change ให้ตัวที่ฟังอยู่ทำงานต่อ
    form.addEventListener('click', (event) => {
      const btn = event.target.closest('.rarity-option');
      if (!btn) {
        return;
      }
      form.querySelectorAll('.rarity-option').forEach((el) => {
        el.setAttribute('aria-pressed', el === btn ? 'true' : 'false');
      });
      form.elements.grade.value = btn.dataset.grade;
      form.elements.grade.dispatchEvent(new Event('change', { bubbles: true }));
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

  function bind() {
    dialog = document.getElementById('editDialog');
    menu = document.getElementById('addMenu');
    trigger = document.getElementById('editModeToggle');
    if (!dialog || !menu || !trigger) {
      return;
    }

    menu.hidden = !webAppUrl || pair().length < 2;
    if (menu.hidden) {
      return;
    }

    /*
     * NOTE: กด + แล้วเข้าฟอร์มเลย ไม่มีเมนูเลือก slot คั่นก่อน — ในฟอร์มมีตัวเลือก slot
     * อยู่แล้ว (ไอคอนในการ์ด) และ `slot` จำค่าล่าสุดไว้ เปิดซ้ำก็ได้ช่องเดิม
     */
    trigger.addEventListener('click', () => {
      slot = NO_SLOT;
      renderDialog();
      dialog.showModal();
    });
  }

  return { configure, bind };
}
