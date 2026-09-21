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

/**
 * ป้ายเล็กๆ บอกว่ากำลังดึงของใหม่อยู่
 *
 * NOTE: อยู่นอก #equipmentPage เพราะ renderAppShell เขียนทับข้างในทั้งก้อน
 */
function setRefreshing(on) {
  const badge = document.getElementById('refreshBadge');
  if (badge) {
    badge.hidden = !on;
  }
}

/** รอของจริงเท่านี้ก่อน ถ้ายังไม่มาค่อยเอาของใน cache ขึ้นคั่นไว้ */
const CACHE_FALLBACK_MS = 10000;

async function bootstrap() {
  const cached = loadCachedPayload();
  const pending = loadSetsPayload();

  /*
   * รอบแรกให้ค้างที่ spinner ไปก่อน — ของจริงมักมาใน 3-8 วิ ขึ้นของเก่าแวบนึง
   * แล้วเปลี่ยนเป็นของใหม่ทันทีอ่านไม่ทันอยู่ดี เกิน 10 วิ เมื่อไหร่ค่อยเอาของเก่าขึ้นคั่น
   */
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

  // โหลดไม่สำเร็จแต่มีของที่เคยโหลดไว้ — ของเก่าของจริงดีกว่าข้อมูลสำรองที่ฝังในเว็บ
  const fallBackToCache = Boolean(payload.loadError && cached);
  const sets = fallBackToCache ? cached.sets : payload.sets;
  if (!sets.length) {
    throw new Error('No equipment sets found');
  }

  // NOTE: ต้องตั้งก่อน paint — การ์ดอ่าน best stat ตอน render รอบแรกเลย
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

// NOTE: ไม่มีตรงนี้ = error ตอน bootstrap จะเงียบสนิท หน้าเว็บค้างที่ loading
bootstrap().catch((err) => {
  const page = document.getElementById('equipmentPage');
  if (page) {
    page.innerHTML = `<p class="page-load-error" role="status">Could not load the page: ${escapeHtml(
      (err && err.message) || String(err),
    )}</p>`;
  }
  throw err;
});
