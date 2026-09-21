import { loadCachedPayload, loadSetsPayload } from './data.mjs';
import { configureBestSubstats } from './constants.mjs';
import { renderAppShell } from './render.mjs';
import { createSetModeUi } from './set-mode.mjs';
import { createEditUi } from './edit.mjs';
import { escapeHtml } from './utils.mjs';

const setModeUi = createSetModeUi();

function paint(sets, loadError) {
  setModeUi.configure(sets);
  renderAppShell(sets, loadError, setModeUi.modeFor);
  setModeUi.bind();
}

const editUi = createEditUi({
  onSaved: (sets) => paint(sets, ''),
  modeFor: setModeUi.modeFor,
});

function setRefreshing(on) {
  const badge = document.getElementById('refreshBadge');
  if (badge) {
    badge.hidden = !on;
  }
}

const CACHE_FALLBACK_MS = 10000;

async function bootstrap() {
  const cached = loadCachedPayload();
  const pending = loadSetsPayload();

   let timer = 0;
  if (cached) {
    timer = setTimeout(() => {
      configureBestSubstats(cached.bestStats);
      paint(cached.sets, '');
      setRefreshing(true);
    }, CACHE_FALLBACK_MS);
  }

  const payload = await pending;
  clearTimeout(timer);
  setRefreshing(false);

   const fallBackToCache = Boolean(payload.loadError && cached);
  const sets = fallBackToCache ? cached.sets : payload.sets;
  if (!sets.length) {
    throw new Error('No equipment sets found');
  }

   configureBestSubstats(fallBackToCache ? cached.bestStats : payload.bestStats);
  paint(
    sets,
    fallBackToCache
      ? `Could not reach the Web App — showing the last data this browser loaded (${payload.loadError.replace(/^.*\((.*)\)$/, '$1')})`
      : payload.loadError,
  );
  editUi.configure(payload);
  editUi.bind();
}

bootstrap().catch((err) => {
  const page = document.getElementById('equipmentPage');
  if (page) {
    page.innerHTML = `<p class="page-load-error" role="status">Could not load the page: ${escapeHtml(
      (err && err.message) || String(err),
    )}</p>`;
  }
  throw err;
});
