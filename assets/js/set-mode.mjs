import { MODES, MODE_ICONS, MODE_LABELS, bestSubstatFor, defaultModeFor } from './constants.mjs';
import { buildMetaFromSets } from './data.mjs';
import { statBestMatch } from './utils.mjs';
import { COMPARE_KEY, bestTagsHtml, compareCaptionHtml } from './render.mjs';

const MODE_STORAGE = 'equipment-sets-mode';

function readStoredModes() {
  try {
    const raw = JSON.parse(localStorage.getItem(MODE_STORAGE) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch (err) {
    return {};
  }
}

function storeModes(modes) {
  try {
    localStorage.setItem(MODE_STORAGE, JSON.stringify(modes));
  } catch (err) {
     }
}

export function createSetModeUi() {
  let modes = {};
  let setMeta = {};
  let compareSets = [];
  let activeSetKey = '';
  let toggle = null;
  let tabs = [];
  let panels = [];
  let toggleBound = false;

  const modeFor = (setKey) => modes[setKey] || '';

  function configure(sets) {
    const stored = readStoredModes();
    modes = {};
    sets.forEach((set) => {
      const fallback = defaultModeFor(set.setKey);
      const chosen = stored[set.setKey];
      modes[set.setKey] = MODES.includes(chosen) && fallback ? chosen : fallback;
    });
    setMeta = buildMetaFromSets(sets);
    compareSets = sets.slice(0, 2).filter((set) => defaultModeFor(set.setKey));
  }

   function modeGroupHtml(setKey, label) {
    const mode = modeFor(setKey);
    const iconOnly = Boolean(label);
    const buttons = MODES.map(
      (m) =>
        `<button type="button" class="mode-option${iconOnly ? ' icon-only' : ''}" data-set-key="${setKey}" data-mode="${m}" aria-pressed="${
          m === mode
        }"${iconOnly ? ` aria-label="${label} ${MODE_LABELS[m]}" title="${MODE_LABELS[m]}"` : ''}><i data-lucide="${
          MODE_ICONS[m]
        }" aria-hidden="true"></i>${iconOnly ? '' : MODE_LABELS[m]}</button>`,
    ).join('');
    const labelHtml = label ? `<span class="mode-group-label">${label}</span>` : '';
    return `<div class="mode-group glass-chip">${labelHtml}${buttons}</div>`;
  }

  function renderToggle() {
    if (!toggle) {
      return;
    }

       if (activeSetKey === COMPARE_KEY) {
      toggle.hidden = compareSets.length < 2;
      toggle.innerHTML = toggle.hidden
        ? ''
        : compareSets.map((set) => modeGroupHtml(set.setKey, set.title)).join('');
    } else {
      const mode = modeFor(activeSetKey);
      toggle.hidden = !mode;
      toggle.innerHTML = mode ? modeGroupHtml(activeSetKey, '') : '';
    }

       if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function highlightStats(root, bestStats) {
    root.querySelectorAll('.stats [data-stat-id]').forEach((el) => {
      el.classList.toggle('stat-row-best', statBestMatch(el.dataset.statId, bestStats));
    });
  }

  function applyHighlights() {
    panels.forEach((section) => {
      const setKey = section.dataset.setKey;
      const meta = setMeta[setKey];

      const titleEl = section.querySelector('.section-title');
      if (titleEl && meta && meta.title) {
        titleEl.textContent = meta.title;
      }

           if (!modeFor(setKey)) {
        return;
      }

      const best = bestSubstatFor(modeFor(setKey));
      section.querySelectorAll('.grid-row-group').forEach((group) => {
        const rowIndex = Number(group.dataset.rowIndex);
        const bestStats = best.rows[rowIndex] || [];
        const caption = group.querySelector('.row-best-caption');
        if (caption) {
          caption.innerHTML = bestTagsHtml(bestStats);
        }
        highlightStats(group, bestStats);
      });
    });

       document.querySelectorAll('.compare-cell[data-set-key]').forEach((cell) => {
      const setKey = cell.dataset.setKey;
      const best = bestSubstatFor(modeFor(setKey));
      const bestStats = best.rows[Number(cell.dataset.rowIndex)] || [];

      const caption = cell.querySelector('.compare-set');
      const meta = setMeta[setKey];
      if (caption && meta) {
        caption.innerHTML = compareCaptionHtml(meta.title, bestStats);
      }
      highlightStats(cell, bestStats);
    });
  }

  function showSet(setKey) {
    activeSetKey = setKey;
    tabs.forEach((tab) => {
      tab.setAttribute('aria-selected', tab.dataset.setKey === setKey ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      if (panel.dataset.setKey === setKey) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });
    renderToggle();
  }

  function bind() {
    toggle = document.getElementById('setModeToggle');
    tabs = Array.from(document.querySelectorAll('.set-tab'));
    panels = Array.from(document.querySelectorAll('.section[role="tabpanel"]'));

       const stillThere = tabs.some((tab) => tab.dataset.setKey === activeSetKey);
    if (!stillThere) {
      activeSetKey = tabs.length ? tabs[0].dataset.setKey : '';
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => showSet(tab.dataset.setKey));
    });

       if (toggle && !toggleBound) {
      toggleBound = true;
      toggle.addEventListener('click', (event) => {
        const btn = event.target.closest('.mode-option');
               const targetKey = btn && btn.dataset.setKey;
        if (!targetKey) {
          return;
        }
        modes[targetKey] = btn.dataset.mode;
        storeModes(modes);
        renderToggle();
        applyHighlights();
      });
    }

    showSet(activeSetKey);
    applyHighlights();
  }

  return { configure, bind, modeFor };
}
