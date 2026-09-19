import { loadSetsPayload } from './data.mjs';
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

async function bootstrap() {
  const payload = await loadSetsPayload();
  if (!payload.sets.length) {
    throw new Error('No equipment sets found');
  }
  // NOTE: ต้องตั้งก่อน paint — การ์ดอ่าน best stat ตอน render รอบแรกเลย
  configureBestSubstats(payload.bestStats);
  paint(payload.sets, payload.loadError);
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
