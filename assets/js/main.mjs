import { loadSetsPayload } from './data.mjs';
import { renderAppShell } from './render.mjs';
import { createBestSubstatUi } from './best-substat.mjs';

const bestSubstatUi = createBestSubstatUi();

async function bootstrap() {
  const { sets, loadError } = await loadSetsPayload();
  if (!sets.length) {
    return;
  }
  renderAppShell(sets, loadError);
  bestSubstatUi.configure(sets);
  bestSubstatUi.bind();
}

bootstrap();
