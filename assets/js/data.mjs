import { resolveStatId, toStatNumber } from './stats.mjs';
import { baseStatForSlot, itemNameFor, resolveGrade } from './catalog.mjs';
import { computeBaseStat } from './base-stat.mjs';

/**
 * ชีตส่งมาแค่ { level, grade, power, subs } — ที่เหลือคำนวณเอาเอง:
 * ชื่อของกับชนิด base stat มาจาก slot + grade (catalog.mjs)
 * ส่วนค่า base stat คำนวณจาก slot + grade + level (base-stat.mjs)
 *
 * @param index ตำแหน่งใน grid (0-based) → slot = index + 1
 */
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
    isNew: Boolean(item.isNew),
    name: item.name || itemNameFor(slot, grade),
    power: toStatNumber(item.power),
    stats: [[baseStatForSlot(slot), computeBaseStat(slot, grade, level) || 0], ...subs],
  };
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
    items: (set.items || []).map(normalizeItem),
  }));
}

/**
 * ชีตพิมพ์ชื่อ stat มาแบบไหนก็ได้ (id หรือ label) — แปลงเป็น id ให้เหมือนกับ substat
 * NOTE: คืน null ถ้าไม่มีอะไรใช้ได้ ตัวเรียกจะได้รู้ว่าให้ใช้ค่าตั้งต้นต่อ
 */
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

/**
 * เขียนกลับผ่าน doPost
 *
 * NOTE: ต้องเป็น text/plain — application/json ทำให้เบราว์เซอร์ยิง OPTIONS preflight
 * ซึ่ง Apps Script ไม่ตอบ request เลยตายก่อนถึงสคริปต์
 */
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
    return { sets: embeddedSets, loadError: '', webAppUrl: '', bestStats: null };
  }

  try {
    const payload = await fetchSetsFromWebApp(webAppUrl);
    const sets = normalizeSetsPayload(payload);
    if (!sets.length) {
      throw new Error('Web App returned empty sets');
    }
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
