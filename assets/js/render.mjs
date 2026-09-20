import { GRADES, SLOT_TYPES, bestSubstatFor } from './constants.mjs';
import { gradeTier } from './catalog.mjs';
import { escapeHtml, statBestMatch } from './utils.mjs';
import { formatStat, formatStatRange, statLabel } from './stats.mjs';
import { subStatRange, subStatRatio } from './base-stat.mjs';
import { buildSetSummary } from './summary.mjs';

/**
 * เครื่องหมายบอกคุณภาพโรล ต่อท้ายตัวเลข substat
 *
 * เรียงจากชั้นหายากสุดลงมาทั้งฝั่งบนและฝั่งล่าง เพราะ find() หยุดที่ชั้นแรกที่ผ่าน
 * (ไม่งั้น bottom 10% จะโดน bottom 25% กินไปก่อน)
 */
const ROLL_TIERS = [
  { test: (r) => r >= 0.95, cls: 'is-top5', icon: 'star' },
  { test: (r) => r >= 0.9, cls: 'is-top10', icon: 'chevronsUp' },
  { test: (r) => r >= 0.75, cls: 'is-top25', icon: 'chevronUp' },
  { test: (r) => r <= 0.1, cls: 'is-bot10', icon: 'chevronsDown' },
  { test: (r) => r <= 0.25, cls: 'is-bot25', icon: 'chevronDown' },
];

// path ชุด lucide (viewBox 24) — star เป็นรูปทึบคนละ viewBox เลยไปอยู่ใน sprite ของหน้า
const CHEVRON_PATHS = {
  chevronUp: '<path d="m18 15-6-6-6 6"/>',
  chevronsUp: '<path d="m17 11-5-5-5 5"/><path d="m17 18-5-5-5 5"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronsDown: '<path d="m7 6 5 5 5-5"/><path d="m7 13 5 5 5-5"/>',
};

export function rollMarkHtml(ratio) {
  if (ratio === null) {
    return '';
  }
  const tier = ROLL_TIERS.find(({ test }) => test(ratio));
  if (!tier) {
    return '';
  }
  if (tier.icon === 'star') {
    return `<svg class="roll-mark ${tier.cls}" viewBox="10 -30 596 574" aria-hidden="true"><use href="#roll-star" /></svg>`;
  }
  return `<svg class="roll-mark ${tier.cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CHEVRON_PATHS[tier.icon]}</svg>`;
}

export function equipIconPath(item, gridIndex) {
  const type = SLOT_TYPES[gridIndex] || 'sword';
  const tier = gradeTier(item.grade);
  const folder = type.charAt(0).toUpperCase() + type.slice(1);
  return `assets/equipment/${folder}/icon_equip_${type}_${tier}.png`;
}

function platePath(gridIndex) {
  const type = SLOT_TYPES[gridIndex] || 'sword';
  return `assets/plates/icon_plate_${type}.png`;
}

export function renderCard(item, gridIndex, bestStats) {
  const g = GRADES[item.grade] || GRADES.legendary;
  const stats = item.stats || [];
  const primary = stats[0] || ['', 0];
  const subRows = stats.slice(1).map(([statId, value]) => {
    const best = statBestMatch(statId, bestStats);
    // ช่วงค่าที่ substat ตัวนี้ออกได้ ไว้เทียบว่าที่ได้มาถือว่าดีแค่ไหน
    const range = subStatRange(gridIndex + 1, item.grade, statId);
    const rangeHtml = range
      ? `<small class="stat-range">${escapeHtml(formatStatRange(statId, range[0], range[1]))}</small>`
      : '';

    // เครื่องหมายบอกว่าโรลได้ดีแค่ไหน — เทียบกับช่วงที่เป็นไปได้ของ stat ตัวนั้น
    const mark = rollMarkHtml(subStatRatio(gridIndex + 1, item.grade, statId, value));
    return `<li${best ? ' class="stat-row-best"' : ''} data-stat-id="${escapeHtml(statId)}"><span class="label">${escapeHtml(statLabel(statId))}</span><span class="value">${mark}${escapeHtml(formatStat(statId, value))}${rangeHtml}</span></li>`;
  });

  /*
   * ปุ่มมุมขวาบน: ปักหมุด (ตัวหลักของช่อง) กับ ลบ
   * NOTE: อยู่ในทุกการ์ด แต่ CSS โชว์เฉพาะตอน .can-edit (ต่อ Web App ได้จริง)
   */
  const pinBtn = item.isMain
    ? '' // ปักอยู่แล้ว กดไปก็ไม่เกิดอะไร — กรอบฟ้าบอกสถานะพอแล้ว
    : `<button type="button" class="card-pin" data-pin-slot="${gridIndex + 1}" aria-label="Set as main" title="Set as main"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5M9 10.76V3h6v7.76a2 2 0 0 0 .55 1.38l1.9 2A2 2 0 0 1 18 15.5V17H6v-1.5a2 2 0 0 1 .55-1.38l1.9-2A2 2 0 0 0 9 10.76z" /></svg></button>`;

  const actions = `<div class="card-actions">${pinBtn}<button type="button" class="card-delete" data-delete-slot="${gridIndex + 1}" aria-label="Remove this item" title="Remove this item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>`;

  return `<article class="card ${escapeHtml(item.grade)}${item.isMain ? ' is-main' : ''}" data-slot="${gridIndex + 1}" data-row="${escapeHtml(item.row || '')}" style="--frame:${g.frame};--glow:${g.glow}">${actions}<div class="name-bar"><span class="name-bar-icon-wrap"><img class="name-bar-icon" src="${escapeHtml(equipIconPath(item, gridIndex))}" alt="" width="36" height="36" decoding="async" /><span class="level-badge">Lv.${escapeHtml(item.level)}</span>${item.isNew ? '<span class="new-dot" aria-label="New" title="New"></span>' : ''}</span><span class="name-bar-text-wrap"><span class="name-bar-text">${escapeHtml(item.name)}</span></span></div><div class="card-body"><div class="stat-primary-block"><span class="primary-cell"><span class="label">${escapeHtml(statLabel(primary[0]))}</span><span class="value">${escapeHtml(formatStat(primary[0], primary[1]))}</span></span></div><ul class="stats">${subRows.join('')}</ul></div></article>`;
}

export function statTagsHtml(statIds) {
  return (statIds || [])
    .map((statId) => `<span class="best-tag">${escapeHtml(statLabel(statId))}</span>`)
    .join('');
}

/**
 * แถบ best substat เหนือแต่ละแถว — 1 stat = 1 tag
 *
 * NOTE: สร้างจาก rows (ชุดเดียวกับที่ใช้ตัดสินว่า substat ไหน highlight)
 * ไม่ได้ใช้ข้อความ label แยกอีกแล้ว ป้ายกับ highlight เลยตรงกันเสมอ
 */
export function bestTagsHtml(statIds) {
  const tags = statTagsHtml(statIds);
  // แถวที่ไม่มี stat ก็ไม่ต้องมีป้ายหัวแถบ (เช่น set ที่ยังไม่ได้ตั้งโหมด)
  return tags ? `<span class="best-label">Best Stat</span>${tags}` : '';
}

/**
 * คำกำกับเหนือการ์ดในแท็บ Compare — ชื่อ set + best stat ของ set นั้น
 *
 * NOTE: set-mode.mjs เรียกซ้ำตอน toggle โหมด ป้ายเลยเปลี่ยนตามทันที
 */
export function compareCaptionHtml(title, statIds) {
  return `<span class="compare-set-name">${escapeHtml(title)}</span>${statTagsHtml(statIds)}`;
}

function renderSection(set, setIndex, summary, mode) {
  let rowsHtml = '';
  const items = set.items || [];
  const best = bestSubstatFor(mode);

  for (let rowIndex = 0; rowIndex < 4; rowIndex += 1) {
    const rowItems = items.slice(rowIndex * 3, rowIndex * 3 + 3);
    while (rowItems.length < 3) {
      rowItems.push([]);
    }
    const bestStats = best.rows[rowIndex] || [];
    const cells = rowItems.map((slotItems, colIndex) => {
      const gridIndex = rowIndex * 3 + colIndex;
      const list = slotItems || [];
      if (!list.length) {
        return emptyCellHtml(gridIndex);
      }
      // ช่องเดียวมีได้หลายใบ — เรียงลงมาในช่องนั้น ไม่ไปกินช่องข้างๆ
      return `<div class="slot-stack">${list.map((item) => renderCard(item, gridIndex, bestStats)).join('')}</div>`;
    });
    rowsHtml += `<div class="grid-row-group" data-row-index="${rowIndex}"><p class="row-best-caption">${bestTagsHtml(bestStats)}</p><div class="grid">${cells.join('')}</div></div>`;
  }

  const summaryRows = (summary.aggregatedStats || [])
    .map(
      (row) =>
        `<tr><td class="stat-label">${escapeHtml(row.label)}</td><td class="stat-total">${escapeHtml(row.display)}</td></tr>`,
    )
    .join('');

  return `<section class="section" data-set-key="${escapeHtml(set.setKey)}" role="tabpanel" id="panel-${escapeHtml(set.setKey)}" aria-labelledby="tab-${escapeHtml(set.setKey)}"${setIndex === 0 ? '' : ' hidden'}><div class="summary-hover summary-float"><button type="button" class="dock-fab glass-chip" aria-label="Total stats"><i data-lucide="info" aria-hidden="true"></i></button><div class="summary-popover" role="tooltip"><div class="summary-table-wrap"><table class="summary-table"><tbody>${summaryRows}</tbody></table></div></div></div><div class="section-header"><div class="section-title-row"><h2 class="section-title">${escapeHtml(set.title)}</h2></div></div>${rowsHtml}</section>`;
}

export const COMPARE_KEY = '__compare';

export function emptyCellHtml(gridIndex) {
  return `<div class="grid-empty" aria-hidden="true"><img class="grid-empty-plate" src="${escapeHtml(platePath(gridIndex))}" alt="" width="72" height="72" decoding="async" /></div>`;
}

/**
 * แท็บ Compare — เอา slot เดียวกันของสอง set มาวางข้างกัน
 *
 * NOTE: highlight ของแต่ละใบยังใช้โหมดของ set ตัวเอง ไม่ได้บังคับให้เหมือนกัน
 * จะได้เห็นว่าแต่ละ set มองหา substat คนละชุด
 */
function renderCompareSection(sets, modeFor) {
  const pair = sets.slice(0, 2);
  const bestOf = pair.map((set) => bestSubstatFor(modeFor(set.setKey)));

  let groupsHtml = '';
  for (let slot = 1; slot <= 12; slot += 1) {
    const gridIndex = slot - 1;
    if (!pair.some((set) => ((set.items || [])[gridIndex] || []).length)) {
      continue; // ไม่มีของทั้งสอง set ก็ไม่ต้องโชว์ช่องนี้
    }

    const slotName = SLOT_TYPES[gridIndex] || '';
    const cells = pair
      .map((set, i) => {
        const list = (set.items || [])[gridIndex] || [];
        const bestStats = bestOf[i].rows[Math.floor(gridIndex / 3)] || [];
        const card = list.length
          ? `<div class="slot-stack">${list.map((item) => renderCard(item, gridIndex, bestStats)).join('')}</div>`
          : emptyCellHtml(gridIndex);
        // NOTE: ติด setKey/rowIndex ไว้ให้ set-mode.mjs วาด highlight ใหม่ได้ตอนสลับโหมด
        return `<div class="compare-cell" data-set-key="${escapeHtml(set.setKey)}" data-row-index="${Math.floor(
          gridIndex / 3,
        )}"><p class="compare-set">${compareCaptionHtml(set.title, bestStats)}</p>${card}</div>`;
      })
      .join('');

    groupsHtml += `<div class="grid-row-group compare-group"><p class="row-best-caption"><span class="best-label">${escapeHtml(
      slotName.charAt(0).toUpperCase() + slotName.slice(1),
    )}</span></p><div class="grid compare-grid">${cells}</div></div>`;
  }

  const header =
    '<div class="section-header"><div class="section-title-row"><h2 class="section-title">Compare</h2></div></div>';

  return `<section class="section compare" data-set-key="${COMPARE_KEY}" role="tabpanel" id="panel-${COMPARE_KEY}" aria-labelledby="tab-${COMPARE_KEY}" hidden>${header}${groupsHtml}</section>`;
}

function tabHtml(key, title, selected) {
  return `<button type="button" class="set-tab" role="tab" id="tab-${escapeHtml(key)}" data-set-key="${escapeHtml(key)}" aria-selected="${selected ? 'true' : 'false'}" aria-controls="panel-${escapeHtml(key)}"><span class="set-tab-indicator" aria-hidden="true"></span><span class="set-tab-label">${escapeHtml(title)}</span></button>`;
}

function renderTabs(sets, withCompare) {
  const tabs = sets.map((set, index) => tabHtml(set.setKey, set.title, index === 0));
  if (withCompare) {
    tabs.push(tabHtml(COMPARE_KEY, 'Compare', false));
  }
  return tabs.join('');
}

/**
 * Renders set panels and tab bar into the page shell.
 */
export function renderAppShell(sets, loadError, modeFor) {
  const page = document.getElementById('equipmentPage');
  const tabList = document.getElementById('setTabList');
  if (!page || !tabList) {
    return null;
  }

  const errorHtml = loadError
    ? `<p class="page-load-error" role="status">${escapeHtml(loadError)}</p>`
    : '';

  // ต้องมีอย่างน้อย 2 set ถึงจะมีอะไรให้เทียบ
  const withCompare = sets.length >= 2;

  page.innerHTML =
    errorHtml +
    sets
      .map((set, index) => renderSection(set, index, buildSetSummary(set), modeFor(set.setKey)))
      .join('') +
    (withCompare ? renderCompareSection(sets, modeFor) : '');

  tabList.innerHTML = renderTabs(sets, withCompare);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  return { page, tabList };
}
