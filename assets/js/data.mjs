import { resolveStatId, toStatNumber } from './stats.mjs';
import { baseStatForSlot, itemNameFor, resolveGrade } from './catalog.mjs';
import { computeBaseStat } from './base-stat.mjs';

function normalizeItem(item, index) {
  if (!item) {
    return null;
  }

  const slot = index + 1;
  const grade = resolveGrade(item.grade);
  const level = Number(item.level) || 0;
  const subs = (item.subs || []).map(([type, value]) => [
    resolveStatId(type),
    toStatNumber(value),
  ]);

  return {
    level,
    grade,
    isMain: Boolean(item.isMain),
    isNew: Boolean(item.isNew),
       row: Number(item.row) || 0,
    name: item.name || itemNameFor(slot, grade),
    stats: [[baseStatForSlot(slot), computeBaseStat(slot, grade, level) || 0], ...subs],
  };
}

function normalizeSlot(entry, index) {
  const list = Array.isArray(entry) ? entry : [entry];
  const items = list.map((item) => normalizeItem(item, index)).filter(Boolean);
   return items.filter((item) => item.isMain).concat(items.filter((item) => !item.isMain));
}

export function buildMetaFromSets(sets) {
  const hash = {};
  sets.forEach((set) => {
    hash[set.setKey] = { title: set.title };
  });
  return hash;
}

function normalizeSetsPayload(raw) {
  const list = raw.sets || raw;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((set) => ({
    setKey: set.setKey || set.set_key,
    title: set.title,
    items: (set.items || []).map(normalizeSlot),
  }));
}

function normalizeBestStats(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const profiles = {};
  Object.keys(raw).forEach((mode) => {
    const rows = raw[mode] && raw[mode].rows;
    if (!Array.isArray(rows)) {
      return;
    }
    profiles[mode] = { rows: rows.map((row) => (row || []).map(resolveStatId)) };
  });
  return Object.keys(profiles).length ? profiles : null;
}

function resolveWebAppUrl(sheetsConfig) {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('webApp') ||
    params.get('webAppUrl') ||
    sheetsConfig.webAppUrl ||
    sheetsConfig.googleSheetJsonUrl ||
    ''
  ).trim();
}

export async function postToWebApp(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Web App HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.error) {
    throw new Error(payload.error);
  }
  return normalizeSetsPayload(payload.sets || []);
}

const FETCH_TIMEOUT_MS = 30000;

export async function fetchSetsFromWebApp(url) {
  const sep = url.includes('?') ? '&' : '?';
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}${sep}t=${Date.now()}`, { signal: stop.signal });
    if (!res.ok) {
      throw new Error(`Web App HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    throw stop.signal.aborted ? new Error(`timed out after ${FETCH_TIMEOUT_MS / 1000}s`) : err;
  } finally {
    clearTimeout(timer);
  }
}

const CACHE_KEY = 'equipment-sets-cache';

function readCachedPayload() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function writeCachedPayload(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
     }
}

export function loadCachedPayload() {
  const configEl = document.getElementById('equipment-sheets-config');
  const sheetsConfig = configEl ? JSON.parse(configEl.textContent) : {};
  if (!resolveWebAppUrl(sheetsConfig)) {
    return null;
  }

  const payload = readCachedPayload();
  if (!payload) {
    return null;
  }
  const sets = normalizeSetsPayload(payload);
  return sets.length ? { sets, bestStats: normalizeBestStats(payload.bestStats) } : null;
}

export async function loadSetsPayload() {
  const embeddedEl = document.getElementById('equipment-sets-data');
  const configEl = document.getElementById('equipment-sheets-config');
  if (!embeddedEl) {
    return { sets: [], loadError: 'Missing embedded data' };
  }

  const embeddedSets = normalizeSetsPayload(JSON.parse(embeddedEl.textContent));
  const sheetsConfig = configEl ? JSON.parse(configEl.textContent) : {};
  const webAppUrl = resolveWebAppUrl(sheetsConfig);

  if (!webAppUrl) {
    return { sets: embeddedSets, loadError: '', webAppUrl: '', bestStats: null };
  }

  try {
    const payload = await fetchSetsFromWebApp(webAppUrl);
    const sets = normalizeSetsPayload(payload);
    if (!sets.length) {
      throw new Error('Web App returned empty sets');
    }
    writeCachedPayload(payload);
    return { sets, loadError: '', webAppUrl, bestStats: normalizeBestStats(payload.bestStats) };
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    return {
      sets: embeddedSets,
      loadError: `Could not load the Web App — showing built-in fallback data (${message})`,
      bestStats: null,
    };
  }
}
