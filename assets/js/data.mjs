import { resolveStatId, toStatNumber } from './stats.mjs';
import { baseStatForSlot, itemNameFor, resolveGrade } from './catalog.mjs';
import { computeBaseStat } from './base-stat.mjs';

/**
 * ชีตส่งมาแค่ { level, grade, subs } — ที่เหลือคำนวณเอาเอง:
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
    isMain: Boolean(item.isMain),
    isNew: Boolean(item.isNew),
    // เลขแถวในชีต — ใช้ชี้เป้าตอนลบ ไม่มีก็ได้ (สคริปต์รุ่นเก่าไม่ได้ส่งมา)
    row: Number(item.row) || 0,
    name: item.name || itemNameFor(slot, grade),
    stats: [[baseStatForSlot(slot), computeBaseStat(slot, grade, level) || 0], ...subs],
  };
}

/**
 * 1 ช่อง = รายการของที่อยู่ในช่องนั้น (ปกติ 0 หรือ 1 ใบ)
 *
 * NOTE: รับได้ทั้งรูปแบบเก่า (object เดี่ยว / null) และใหม่ (array) — ข้อมูลสำรองใน
 * .erb ยังเป็นแบบเก่า และสคริปต์ที่ยังไม่อัปเดตก็ส่งแบบเก่ามา
 */
function normalizeSlot(entry, index) {
  const list = Array.isArray(entry) ? entry : [entry];
  // ลำดับตามที่ชีตส่งมา (ใบที่เพิ่งเพิ่มอยู่บนสุด) — ใบหลักดูจาก isMain ไม่ใช่ตำแหน่ง
  return list.map((item) => normalizeItem(item, index)).filter(Boolean);
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

/*
 * Apps Script ตอบ 3-8 วิเป็นปกติ แต่เคยวัดได้ถึง 22 วิตอนชีตใหญ่/cold start
 * ตั้งไว้กว้างหน่อยดีกว่าตัดทิ้งทั้งที่ของกำลังจะมา — ระหว่างรอมีของใน cache ขึ้นให้ดูอยู่แล้ว
 */
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

/*
 * Apps Script ตอบ 3–8 วินาที ถ้ารอให้เสร็จก่อนค่อยวาด หน้าเว็บจะค้างที่ spinner นานมาก
 * เลยเก็บชุดล่าสุดที่โหลดสำเร็จไว้ วาดจากของเก่าไปก่อน แล้วค่อยวาดทับตอนของจริงมาถึง
 *
 * NOTE: เก็บ payload ดิบ ไม่ใช่ที่ normalize แล้ว — สูตรคำนวณในโค้ดเปลี่ยนเมื่อไหร่
 * ของใน cache จะได้คิดใหม่ตามด้วย ไม่ค้างค่าเก่า
 */
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
    /* โควตาเต็ม/private mode — ไม่มี cache ก็แค่ช้าเหมือนเดิม */
  }
}

/**
 * ชุดล่าสุดที่เคยโหลดสำเร็จ — เอาไว้วาดทันทีระหว่างรอของจริง ไม่มีก็คืน null
 */
export function loadCachedPayload() {
  const configEl = document.getElementById('equipment-sheets-config');
  const sheetsConfig = configEl ? JSON.parse(configEl.textContent) : {};
  if (!resolveWebAppUrl(sheetsConfig)) {
    return null; // ไม่ได้ต่อ Web App ก็ใช้ข้อมูลในเว็บอยู่แล้ว ไม่ต้องมี cache
  }

  const payload = readCachedPayload();
  if (!payload) {
    return null;
  }
  const sets = normalizeSetsPayload(payload);
  return sets.length ? { sets, bestStats: normalizeBestStats(payload.bestStats) } : null;
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
