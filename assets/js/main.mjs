import { loadSetsPayload } from './data.mjs';
import { renderAppShell } from './render.mjs';
import { createBestSubstatUi } from './best-substat.mjs';
import { createEditUi } from './edit.mjs';
import { escapeHtml } from './utils.mjs';

const bestSubstatUi = createBestSubstatUi();

function paint(sets, loadError) {
  renderAppShell(sets, loadError);
  bestSubstatUi.configure(sets);
  bestSubstatUi.bind();
}

const editUi = createEditUi({ onSaved: (sets) => paint(sets, '') });

async function bootstrap() {
  const payload = await loadSetsPayload();
  if (!payload.sets.length) {
    throw new Error('ไม่มีข้อมูล set เลย');
  }
  paint(payload.sets, payload.loadError);
  editUi.configure(payload);
  editUi.bind();
}

// NOTE: ไม่มีตรงนี้ = error ตอน bootstrap จะเงียบสนิท หน้าเว็บว่างโดยไม่บอกอะไร
bootstrap().catch((err) => {
  const page = document.getElementById('equipmentPage');
  if (page) {
    page.insertAdjacentHTML(
      'afterbegin',
      `<p class="page-load-error" role="status">เปิดหน้าไม่สำเร็จ: ${escapeHtml(
        (err && err.message) || String(err),
      )}</p>`,
    );
  }
  throw err;
});
