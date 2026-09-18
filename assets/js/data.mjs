import { resolveStatId, toStatNumber } from './stats.mjs';
import { baseStatForSlot, itemNameFor, resolveGrade } from './catalog.mjs';

/**
 * ชีตส่งมาแค่ { level, grade, power, base, subs } — ชื่อของกับ base stat id
 * หาเอาจาก slot + grade (ดู catalog.mjs) ไม่ต้องเก็บซ้ำ
 *
 * @param index ตำแหน่งใน grid (0-based) → slot = index + 1
 */
function normalizeItem(item, index) {
  if (!item) {
    return null;
  }

  const slot = index + 1;
  const grade = resolveGrade(item.grade);
  const subs = (item.subs || []).map(([type, value]) => [
    resolveStatId(type),
    toStatNumber(value),
  ]);

  return {
    level: Number(item.level) || 0,
    grade,
    name: item.name || itemNameFor(slot, grade),
    power: toStatNumber(item.power),
    stats: [[baseStatForSlot(slot), toStatNumber(item.base)], ...subs],
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
    return { sets: embeddedSets, loadError: '', webAppUrl: '' };
  }

  try {
    const payload = await fetchSetsFromWebApp(webAppUrl);
    const sets = normalizeSetsPayload(payload);
    if (!sets.length) {
      throw new Error('Web App returned empty sets');
    }
    return { sets, loadError: '', webAppUrl };
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    return {
      sets: embeddedSets,
      loadError: `โหลด Google Apps Script Web App ไม่สำเร็จ — ใช้ข้อมูลสำรองในเว็บ (${message})`,
    };
  }
}
