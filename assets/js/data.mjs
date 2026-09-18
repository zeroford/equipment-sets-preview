export function buildConfigFromSets(sets) {
  const hash = {};
  sets.forEach((set) => {
    hash[set.setKey] = {
      rows: set.bestStatsByRow || [],
      labels: set.bestSubstatLabels || [],
    };
  });
  return hash;
}

export function buildMetaFromSets(sets) {
  const hash = {};
  sets.forEach((set) => {
    hash[set.setKey] = { title: set.title };
  });
  return hash;
}

export function normalizeSetsPayload(raw) {
  const list = raw.sets || raw;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((set) => ({
    setKey: set.setKey || set.set_key,
    title: set.title,
    items: set.items || [],
    bestStatsByRow: set.bestStatsByRow || set.best_stats_by_row || [],
    bestSubstatLabels: set.bestSubstatLabels || set.best_substat_labels || [],
  }));
}

export function resolveWebAppUrl(sheetsConfig) {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('webApp') ||
    params.get('webAppUrl') ||
    sheetsConfig.webAppUrl ||
    sheetsConfig.googleSheetJsonUrl ||
    ''
  ).trim();
}

export async function fetchSetsFromWebApp(url) {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`Web App HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Embedded JSON fallback, optional Google Apps Script Web App URL.
 */
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
    return { sets: embeddedSets, loadError: '' };
  }

  try {
    const payload = await fetchSetsFromWebApp(webAppUrl);
    const sets = normalizeSetsPayload(payload);
    if (!sets.length) {
      throw new Error('Web App returned empty sets');
    }
    return { sets, loadError: '' };
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    return {
      sets: embeddedSets,
      loadError: `โหลด Google Apps Script Web App ไม่สำเร็จ — ใช้ข้อมูลสำรองในเว็บ (${message})`,
    };
  }
}
