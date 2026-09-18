import { GRADES, SLOT_TYPES, bestSubstatFor } from './constants.mjs';
import { gradeTier } from './catalog.mjs';
import { escapeHtml, statBestMatch } from './utils.mjs';
import { formatPower, formatStat, statLabel } from './stats.mjs';
import { buildSetSummary } from './summary.mjs';

function equipIconPath(item, gridIndex) {
  const type = SLOT_TYPES[gridIndex] || 'sword';
  const tier = gradeTier(item.grade);
  const folder = type.charAt(0).toUpperCase() + type.slice(1);
  return `assets/equipment/${folder}/icon_equip_${type}_${tier}.png`;
}

function platePath(gridIndex) {
  const type = SLOT_TYPES[gridIndex] || 'sword';
  return `assets/plates/icon_plate_${type}.png`;
}

function renderCard(item, gridIndex, bestStats) {
  const g = GRADES[item.grade] || GRADES.legendary;
  const stats = item.stats || [];
  const primary = stats[0] || ['', 0];
  const subRows = stats.slice(1).map(([statId, value]) => {
    const best = statBestMatch(statId, bestStats);
    return `<li${best ? ' class="stat-row-best"' : ''} data-stat-id="${escapeHtml(statId)}"><span class="label">${escapeHtml(statLabel(statId))}</span><span class="value">${escapeHtml(formatStat(statId, value))}</span></li>`;
  });

  return `<article class="card ${escapeHtml(item.grade)}" style="--frame:${g.frame};--glow:${g.glow}"><div class="name-bar"><span class="name-bar-icon-wrap"><img class="name-bar-icon" src="${escapeHtml(equipIconPath(item, gridIndex))}" alt="" width="36" height="36" decoding="async" /></span><span class="name-bar-text-wrap"><span class="name-bar-text">${escapeHtml(item.name)}</span></span></div><div class="card-body"><div class="meta"><span class="level">Lv.${escapeHtml(item.level)}</span><span class="meta-power">${escapeHtml(formatPower(item.power))}</span></div><div class="stat-primary-block"><span class="label">${escapeHtml(statLabel(primary[0]))}</span><span class="value">${escapeHtml(formatStat(primary[0], primary[1]))}</span></div><ul class="stats">${subRows.join('')}</ul></div></article>`;
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
    const rowLabel = best.labels[rowIndex] || '';
    const bestStats = best.rows[rowIndex] || [];
    const cells = rowItems.map((item, colIndex) => {
      const gridIndex = rowIndex * 3 + colIndex;
      if (!item) {
        return `<div class="grid-empty" aria-hidden="true"><img class="grid-empty-plate" src="${escapeHtml(platePath(gridIndex))}" alt="" width="72" height="72" decoding="async" /></div>`;
      }
      return renderCard(item, gridIndex, bestStats);
    });
    rowsHtml += `<div class="grid-row-group" data-row-index="${rowIndex}"><p class="row-best-caption">${escapeHtml(rowLabel)}</p><div class="grid">${cells.join('')}</div></div>`;
  }

  const summaryRows = (summary.aggregatedStats || [])
    .map(
      (row) =>
        `<tr><td class="stat-label">${escapeHtml(row.label)}</td><td class="stat-total">${escapeHtml(row.display)}</td></tr>`,
    )
    .join('');

  return `<section class="section" data-set-key="${escapeHtml(set.setKey)}" role="tabpanel" id="panel-${escapeHtml(set.setKey)}" aria-labelledby="tab-${escapeHtml(set.setKey)}"${setIndex === 0 ? '' : ' hidden'}><div class="summary-hover summary-float"><button type="button" class="dock-fab glass-chip" aria-label="Total stats"><i data-lucide="info" aria-hidden="true"></i></button><div class="summary-popover" role="tooltip"><div class="summary-table-wrap"><table class="summary-table"><tbody>${summaryRows}</tbody></table></div></div></div><div class="section-header"><div class="section-title-row"><h2 class="section-title">${escapeHtml(set.title)}</h2></div></div>${rowsHtml}</section>`;
}

function renderTabs(sets) {
  return sets
    .map(
      (set, index) =>
        `<button type="button" class="set-tab" role="tab" id="tab-${escapeHtml(set.setKey)}" data-set-key="${escapeHtml(set.setKey)}" aria-selected="${index === 0 ? 'true' : 'false'}" aria-controls="panel-${escapeHtml(set.setKey)}"><span class="set-tab-indicator" aria-hidden="true"></span><span class="set-tab-label">${escapeHtml(set.title)}</span></button>`,
    )
    .join('');
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

  page.innerHTML =
    errorHtml +
    sets.map((set, index) => renderSection(set, index, buildSetSummary(set), modeFor(set.setKey))).join('');

  tabList.innerHTML = renderTabs(sets);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  return { page, tabList };
}
