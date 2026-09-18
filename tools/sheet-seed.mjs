/**
 * แปลง JSON ที่ฝังใน index.html (#equipment-sets-data) เป็น TSV 3 ไฟล์
 * สำหรับ paste ลง Google Sheet ครั้งแรก — ไม่ต้องพิมพ์ item ทีละตัว
 *
 *   node tools/sheet-seed.mjs
 *   → google-apps-script/seed/{Sets,Items,Stats}.tsv + percent-cells.json
 *
 * แต่ละไฟล์ = 1 แท็บ: copy ทั้งไฟล์ แล้ว paste ลง A1 ของแท็บชื่อเดียวกัน
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATS, resolveStatId } from '../assets/js/stats.mjs';
import { BASE_STAT_BY_SLOT } from '../assets/js/catalog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'google-apps-script', 'seed');
const MAX_SUBS = 2; // substat ต่อชิ้นตามข้อมูลปัจจุบัน

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
  // NOTE: ค่าใน dataset ไม่มี tab/newline อยู่แล้ว กันไว้เฉยๆ ไม่ให้ layout เพี้ยนตอน paste
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
  const header = ['setKey', 'slot', 'level', 'grade', 'power', 'base'];
  for (let i = 1; i <= MAX_SUBS; i += 1) {
    header.push(`sub${i}Type`, `sub${i}Value`);
  }

  // NOTE: เก็บตำแหน่งเซลล์ที่เป็น % ไว้ให้ sheet-xlsx.py ตั้ง format ถูก (ค่าเก็บเป็นเศษส่วน)
  const percentCells = [];
  const rows = [];

  sets.forEach((set) => {
    (set.items || []).forEach((item, index) => {
      if (!item) {
        return; // slot ว่าง = ไม่มีแถวในชีต
      }
      const slot = index + 1;
      const row = [set.setKey, slot, item.level, item.grade, item.power, item.base];
      if (isPercent(BASE_STAT_BY_SLOT[index])) {
        percentCells.push([rows.length + 2, row.length]); // +2 = ข้าม header, เป็น 1-based
      }
      for (let i = 0; i < MAX_SUBS; i += 1) {
        const [code, value] = (item.subs || [])[i] || ['', ''];
        row.push(code, value);
        if (code !== '' && isPercent(resolveStatId(code))) {
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

/** แท็บอ้างอิงเฉยๆ — Code.gs ไม่ได้อ่าน แต่ช่วยให้เปิดชีตแล้วรู้ว่า code ไหนคืออะไร */
function buildStatsLegend() {
  const rows = Object.keys(STATS)
    .map((id) => [STATS[id].code, id, STATS[id].label, STATS[id].format])
    .sort((a, b) => a[0] - b[0]);
  return tsv([['code', 'id', 'label', 'format'], ...rows]);
}

const sets = readEmbeddedSets();
mkdirSync(OUT_DIR, { recursive: true });
const items = buildItems(sets);
const files = {
  'Sets.tsv': buildSets(sets),
  'Items.tsv': items.tsv,
  'Stats.tsv': buildStatsLegend(),
};
Object.entries(files).forEach(([name, content]) => {
  writeFileSync(join(OUT_DIR, name), content);
  console.log(`${name.padEnd(14)} ${content.trim().split('\n').length - 1} rows`);
});
writeFileSync(join(OUT_DIR, 'percent-cells.json'), JSON.stringify(items.percentCells));
console.log(`→ ${OUT_DIR}`);
