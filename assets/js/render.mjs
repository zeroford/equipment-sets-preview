import { GRADES, SLOT_TYPES, bestSubstatFor } from './constants.mjs';
import { gradeTier } from './catalog.mjs';
import { escapeHtml, statBestMatch } from './utils.mjs';
import { formatPower, formatStat, formatStatRange, statLabel } from './stats.mjs';
import { subStatRange, subStatRatio } from './base-stat.mjs';
import { buildSetSummary } from './summary.mjs';

// โรลติดขอบบน/ล่าง 10% ของช่วง
const HIGH_ROLL = 0.9;
const LOW_ROLL = 0.1;

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

    // จุดบอกว่าโรลได้ดี/แย่ — เทียบกับช่วงที่เป็นไปได้ของ stat ตัวนั้น
    const ratio = subStatRatio(gridIndex + 1, item.grade, statId, value);
    const flag =
      ratio === null || (ratio < HIGH_ROLL && ratio > LOW_ROLL)
        ? ''
        : `<span class="stat-flag ${ratio >= HIGH_ROLL ? 'is-high' : 'is-low'}" aria-hidden="true"></span>`;
    return `<li${best ? ' class="stat-row-best"' : ''} data-stat-id="${escapeHtml(statId)}"><span class="label">${escapeHtml(statLabel(statId))}</span><span class="value">${escapeHtml(formatStat(statId, value))}${rangeHtml}</span>${flag}</li>`;
  });

  return `<article class="card ${escapeHtml(item.grade)}" style="--frame:${g.frame};--glow:${g.glow}"><div class="name-bar"><span class="name-bar-icon-wrap"><img class="name-bar-icon" src="${escapeHtml(equipIconPath(item, gridIndex))}" alt="" width="36" height="36" decoding="async" /><span class="level-badge">${escapeHtml(item.level)}</span></span><span class="name-bar-text-wrap"><span class="name-bar-text">${escapeHtml(item.name)}</span></span></div><div class="card-body"><div class="stat-primary-block"><span class="primary-cell"><span class="label">${escapeHtml(statLabel(primary[0]))}</span><span class="value">${escapeHtml(formatStat(primary[0], primary[1]))}</span></span><span class="primary-cell is-power"><span class="label">Power</span><span class="value">${escapeHtml(formatPower(item.power))}</span></span></div><ul class="stats">${subRows.join('')}</ul></div></article>`;
}

/**
 * แถบ best substat เหนือแต่ละแถว — 1 stat = 1 tag
 *
 * NOTE: สร้างจาก rows (ชุดเดียวกับที่ใช้ตัดสินว่า substat ไหน highlight)
 * ไม่ได้ใช้ข้อความ label แยกอีกแล้ว ป้ายกับ highlight เลยตรงกันเสมอ
 */
export function bestTagsHtml(statIds) {
  const tags = (statIds || [])
    .map((statId) => `<span class="best-tag">${escapeHtml(statLabel(statId))}</span>`)
    .join('');
  // แถวที่ไม่มี stat ก็ไม่ต้องมีป้ายหัวแถบ (เช่น set ที่ยังไม่ได้ตั้งโหมด)
  return tags ? `<span class="best-label">Best Stat</span>${tags}` : '';
}

function renderSection(set, setIndex, summary, mode) {
  let rowsHtml = '';
  const items = set.items || [];
  const best = bestSubstatFor(mode);

  for (let rowIndex = 0; rowIndex < 4; rowIndex += 1) {
    const rowItems = items.slice(rowIndex * 3, rowIndex * 3 + 3);
    while (rowItems.length < 3) {
      rowItems.push(null);
    }
    const bestStats = best.rows[rowIndex] || [];
    const cells = rowItems.map((item, colIndex) => {
      const gridIndex = rowIndex * 3 + colIndex;
      if (!item) {
        return `<div class="grid-empty" aria-hidden="true"><img class="grid-empty-plate" src="${escapeHtml(platePath(gridIndex))}" alt="" width="72" height="72" decoding="async" /></div>`;
      }
      return renderCard(item, gridIndex, bestStats);
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
    if (!pair.some((set) => (set.items || [])[gridIndex])) {
      continue; // ไม่มีของทั้งสอง set ก็ไม่ต้องโชว์ช่องนี้
    }

    const slotName = SLOT_TYPES[gridIndex] || '';
    const cells = pair
      .map((set, i) => {
        const item = (set.items || [])[gridIndex];
        const bestStats = bestOf[i].rows[Math.floor(gridIndex / 3)] || [];
        const card = item ? renderCard(item, gridIndex, bestStats) : emptyCellHtml(gridIndex);
        // NOTE: ติด setKey/rowIndex ไว้ให้ set-mode.mjs วาด highlight ใหม่ได้ตอนสลับโหมด
        return `<div class="compare-cell" data-set-key="${escapeHtml(set.setKey)}" data-row-index="${Math.floor(
          gridIndex / 3,
        )}"><span class="compare-set">${escapeHtml(set.title)}</span>${card}</div>`;
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
