/**
 * แปลง JSON ที่ฝังใน index.html (#equipment-sets-data) เป็น TSV 3 ไฟล์
 * สำหรับ paste ลง Google Sheet ครั้งแรก — ไม่ต้องพิมพ์ item ทีละตัว
 *
 *   node tools/sheet-seed.mjs
 *   → google-apps-script/seed/{Sets,Items,BestStats}.tsv
 *
 * แต่ละไฟล์ = 1 แท็บ: copy ทั้งไฟล์ แล้ว paste ลง A1 ของแท็บชื่อเดียวกัน
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'google-apps-script', 'seed');
const MAX_STATS = 3; // base stat + 2 substat ตามข้อมูลปัจจุบัน

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
  const header = ['setKey', 'slot', 'level', 'grade', 'name', 'power'];
  for (let i = 1; i <= MAX_STATS; i += 1) {
    header.push(`stat${i}Label`, `stat${i}Value`);
  }

  const rows = [];
  sets.forEach((set) => {
    (set.items || []).forEach((item, index) => {
      if (!item) {
        return; // slot ว่าง = ไม่มีแถวในชีต
      }
      const row = [set.setKey, index + 1, item.level, item.grade, item.name, item.power];
      for (let i = 0; i < MAX_STATS; i += 1) {
        const [label, value] = (item.stats || [])[i] || ['', ''];
        row.push(label, value);
      }
      rows.push(row);
    });
  });

  return tsv([header, ...rows]);
}

function buildBestStats(sets) {
  const rows = [];
  sets.forEach((set) => {
    for (let i = 0; i < 4; i += 1) {
      rows.push([
        set.setKey,
        i + 1,
        ((set.bestStatsByRow || [])[i] || []).join(', '),
        (set.bestSubstatLabels || [])[i] || '',
      ]);
    }
  });
  return tsv([['setKey', 'row', 'bestStats', 'label'], ...rows]);
}

const sets = readEmbeddedSets();
mkdirSync(OUT_DIR, { recursive: true });
const files = {
  'Sets.tsv': buildSets(sets),
  'Items.tsv': buildItems(sets),
  'BestStats.tsv': buildBestStats(sets),
};
Object.entries(files).forEach(([name, content]) => {
  writeFileSync(join(OUT_DIR, name), content);
  console.log(`${name.padEnd(14)} ${content.trim().split('\n').length - 1} rows`);
});
console.log(`→ ${OUT_DIR}`);
