import { MODES, MODE_ICONS, MODE_LABELS, bestSubstatFor, defaultModeFor } from './constants.mjs';
import { buildMetaFromSets } from './data.mjs';
import { statBestMatch } from './utils.mjs';
import { bestTagsHtml } from './render.mjs';

const MODE_STORAGE = 'equipment-sets-mode';

/** โหมดที่ผู้ใช้เลือกไว้ต่อ set — จำข้ามการ refresh */
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
    /* private mode — ใช้ต่อได้ แค่ไม่จำ */
  }
}

/**
 * Tab + toggle PvE/Boss ต่อ set
 *
 * NOTE: set ที่ไม่มีโหมดตั้งต้น (เช่น set3) จะไม่มี toggle และไม่ highlight อะไรเลย
 */
export function createSetModeUi() {
  let modes = {};
  let setMeta = {};
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
  }

  function renderToggle() {
    if (!toggle) {
      return;
    }
    const mode = modeFor(activeSetKey);
    toggle.hidden = !mode;
    if (!mode) {
      toggle.innerHTML = '';
      return;
    }
    toggle.innerHTML = MODES.map(
      (m) =>
        `<button type="button" class="mode-option" data-mode="${m}" aria-pressed="${m === mode}"><i data-lucide="${MODE_ICONS[m]}" aria-hidden="true"></i>${MODE_LABELS[m]}</button>`,
    ).join('');

    // NOTE: ต้องเรียกทุกครั้งที่เขียน innerHTML ใหม่ — lucide แทน <i data-lucide> ด้วย <svg> ตอนถูกเรียกเท่านั้น
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function applyHighlights() {
    panels.forEach((section) => {
      const setKey = section.dataset.setKey;
      // NOTE: panel ที่ไม่มีโหมด (Compare, set ที่ยังไม่ตั้งโหมด) วาดมาครบแล้วตั้งแต่ render
      if (!modeFor(setKey)) {
        return;
      }
      const best = bestSubstatFor(modeFor(setKey));
      const meta = setMeta[setKey];

      const titleEl = section.querySelector('.section-title');
      if (titleEl && meta && meta.title) {
        titleEl.textContent = meta.title;
      }

      section.querySelectorAll('.grid-row-group').forEach((group) => {
        const rowIndex = Number(group.dataset.rowIndex);
        const bestStats = best.rows[rowIndex] || [];
        const caption = group.querySelector('.row-best-caption');
        if (caption) {
          caption.innerHTML = bestTagsHtml(bestStats);
        }
        group.querySelectorAll('.stats [data-stat-id]').forEach((el) => {
          el.classList.toggle('stat-row-best', statBestMatch(el.dataset.statId, bestStats));
        });
      });
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
    activeSetKey = tabs.length ? tabs[0].dataset.setKey : '';

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => showSet(tab.dataset.setKey));
    });

    // NOTE: toggle อยู่ใน shell ไม่ได้สร้างใหม่ตอน re-render — ผูก listener ได้ครั้งเดียว
    if (toggle && !toggleBound) {
      toggleBound = true;
      toggle.addEventListener('click', (event) => {
        const btn = event.target.closest('.mode-option');
        if (!btn || !activeSetKey) {
          return;
        }
        modes[activeSetKey] = btn.dataset.mode;
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
