import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATS, resolveStatId } from '../assets/js/stats.mjs';
import { MODES, bestSubstatFor } from '../assets/js/constants.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'google-apps-script', 'seed');
const MAX_SUBS = 2;

function readEmbeddedSets() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const match = html.match(
    /<script type="application\/json" id="equipment-sets-data">([\s\S]*?)<\/script>/,
  );
  if (!match) {
    throw new Error('ไม่พบ #equipment-sets-data ใน index.html — รัน ./render.sh ก่อน');
  }
  const raw = JSON.parse(match[1]);
  return Array.isArray(raw) ? raw : raw.sets;
}

function tsv(rows) {
   return rows
    .map((row) => row.map((cell) => String(cell ?? '').replace(/[\t\n\r]+/g, ' ')).join('\t'))
    .join('\n')
    .concat('\n');
}

function buildSets(sets) {
  return tsv([
    ['setKey', 'title', 'order'],
    ...sets.map((set, index) => [set.setKey, set.title, index + 1]),
  ]);
}

function buildItems(sets) {
  const header = ['setKey', 'slot', 'level', 'grade', 'isMain', 'isNew', 'isActive'];
  for (let i = 1; i <= MAX_SUBS; i += 1) {
    header.push(`sub${i}Type`, `sub${i}Value`);
  }

   const percentCells = [];
  const rows = [];

  sets.forEach((set) => {
    (set.items || []).forEach((item, index) => {
      if (!item) {
        return;
      }
      const slot = index + 1;
           const row = [set.setKey, slot, item.level, item.grade, 'TRUE', 'FALSE', 'TRUE'];
      for (let i = 0; i < MAX_SUBS; i += 1) {
        const [type, value] = (item.subs || [])[i] || ['', ''];
        const statId = type === '' ? '' : resolveStatId(type);
        row.push(statId, value);
        if (isPercent(statId)) {
          percentCells.push([rows.length + 2, row.length]);
        }
      }
      rows.push(row);
    });
  });

  return { tsv: tsv([header, ...rows]), percentCells };
}

function isPercent(statId) {
  return Boolean(STATS[statId]) && STATS[statId].format === 'percent';
}

function buildBestStats() {
  const rows = [];
  MODES.forEach((mode) => {
    bestSubstatFor(mode).rows.forEach((ids, index) => {
      rows.push([mode, index + 1, ids.join(', ')]);
    });
  });
  return tsv([['mode', 'row', 'stats'], ...rows]);
}

function buildStatsLegend() {
  const rows = Object.keys(STATS)
    .map((id) => [id, STATS[id].label, STATS[id].format])
    .sort((a, b) => a[0].localeCompare(b[0]));
  return tsv([['id', 'label', 'format'], ...rows]);
}

const sets = readEmbeddedSets();
mkdirSync(OUT_DIR, { recursive: true });
const items = buildItems(sets);
const files = {
  'Sets.tsv': buildSets(sets),
  'Items.tsv': items.tsv,
  'Stats.tsv': buildStatsLegend(),
  'BestStats.tsv': buildBestStats(),
};
Object.entries(files).forEach(([name, content]) => {
  writeFileSync(join(OUT_DIR, name), content);
  console.log(`${name.padEnd(14)} ${content.trim().split('\n').length - 1} rows`);
});
writeFileSync(join(OUT_DIR, 'percent-cells.json'), JSON.stringify(items.percentCells));
console.log(`→ ${OUT_DIR}`);
