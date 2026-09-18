import { buildConfigFromSets, buildMetaFromSets } from './data.mjs';
import { statBestMatch } from './utils.mjs';

/**
 * Tab visibility + PvE/Boss swap highlights and badges.
 */
export function createBestSubstatUi() {
  let swapped = false;
  let config = {};
  let setMeta = {};
  let activeSetKey = '';
  let btn = null;
  let tabs = [];
  let panels = [];

  function sourceKeyForSet(setKey) {
    if (setKey === 'set3') {
      return 'set3';
    }
    return swapped ? (setKey === 'pve' ? 'boss' : 'pve') : setKey;
  }

  function configForSet(setKey) {
    return config[sourceKeyForSet(setKey)] || { rows: [], labels: [] };
  }

  function modeBadgeLabel(setKey) {
    if (setKey === 'set3') {
      return '';
    }
    const source = sourceKeyForSet(setKey);
    return source === 'pve' ? 'Boss' : 'PvE';
  }

  function updateFabVisibility() {
    if (btn) {
      btn.hidden = activeSetKey === 'set3';
    }
  }

  function showSet(setKey) {
    activeSetKey = setKey;
    tabs.forEach((tab) => {
      const selected = tab.dataset.setKey === setKey;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      if (panel.dataset.setKey === setKey) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });
    updateFabVisibility();
  }

  function applyBestSubstat() {
    panels.forEach((section) => {
      const setKey = section.dataset.setKey;
      const cfg = configForSet(setKey);
      const panelMeta = setMeta[setKey];

      const titleEl = section.querySelector('.section-title');
      if (titleEl && panelMeta && panelMeta.title) {
        titleEl.textContent = panelMeta.title;
      }

      const badgeEl = section.querySelector('.section-mode-badge');
      if (badgeEl) {
        if (setKey === 'set3') {
          badgeEl.hidden = true;
        } else {
          badgeEl.hidden = false;
          badgeEl.textContent = modeBadgeLabel(setKey);
        }
      }

      section.querySelectorAll('.grid-row-group').forEach((group) => {
        const rowIndex = Number(group.dataset.rowIndex);
        const caption = group.querySelector('.row-best-caption');
        if (caption) {
          caption.textContent = (cfg.labels[rowIndex] || '').toString();
        }
        const bestStats = cfg.rows[rowIndex] || [];
        group.querySelectorAll('.stats [data-stat-label]').forEach((el) => {
          el.classList.toggle('stat-row-best', statBestMatch(el.dataset.statLabel, bestStats));
        });
      });
    });

    if (btn) {
      btn.setAttribute('aria-pressed', swapped ? 'true' : 'false');
    }
  }

  function configure(sets) {
    config = buildConfigFromSets(sets);
    setMeta = buildMetaFromSets(sets);
  }

  function bind() {
    btn = document.getElementById('bestSubstatSwap');
    tabs = Array.from(document.querySelectorAll('.set-tab'));
    panels = Array.from(document.querySelectorAll('.section[role="tabpanel"]'));
    activeSetKey = tabs.length ? tabs[0].dataset.setKey : 'pve';

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        showSet(tab.dataset.setKey);
      });
    });

    if (btn) {
      btn.addEventListener('click', () => {
        swapped = !swapped;
        applyBestSubstat();
      });
    }

    updateFabVisibility();
    applyBestSubstat();
  }

  return { configure, bind };
}
