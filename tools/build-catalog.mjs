/**
 * สร้าง assets/js/catalog.mjs จาก game data (data/oven-tool-v1.json)
 *
 *   node tools/build-catalog.mjs
 *
 * อัปเดต data: curl -s https://crumblehub.co/data/oven-tool-v1.json -o data/oven-tool-v1.json
 *
 * ที่ดึงออกมา:
 *   rarity.order → grade code (9 = Legendary, 10 = Eternal)
 *   type.order   → slot 1–12
 *   ชื่อของ       ผูกกับ (slot, grade)
 *   base stat    ผูกกับ slot อย่างเดียว (ตรวจแล้วว่าไม่ขึ้นกับ grade)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveStatId, STATS } from '../assets/js/stats.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(ROOT, 'data', 'oven-tool-v1.json'), 'utf8'));

const slotByType = new Map(data.types.map((t) => [t.key, t.order]));
const gradeByRarity = new Map(data.rarities.map((r) => [r.key, r.order]));
const gradeKeys = data.rarities
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((r) => r.key.toLowerCase());

const SLOT_COUNT = data.types.length;
const baseStat = new Array(SLOT_COUNT).fill('');
const names = Array.from({ length: SLOT_COUNT }, () => ({}));

data.equipments.forEach((item) => {
  const slot = slotByType.get(item.type);
  const grade = gradeByRarity.get(item.rarity);
  if (!slot || !grade) {
    throw new Error(`unknown type/rarity: ${item.type}/${item.rarity}`);
  }

  names[slot - 1][gradeKeys[grade - 1]] = item.names.en;

  const statId = resolveStatId(data.stats[item.mainOptions[0].statId].names.en);
  if (!STATS[statId]) {
    throw new Error(`stat ที่ยังไม่มีใน stats.mjs: ${data.stats[item.mainOptions[0].statId].names.en}`);
  }
  if (baseStat[slot - 1] && baseStat[slot - 1] !== statId) {
    throw new Error(`slot ${slot} base stat ไม่คงที่: ${baseStat[slot - 1]} vs ${statId}`);
  }
  baseStat[slot - 1] = statId;
});

const q = (s) => (s.includes("'") ? `"${s.replace(/"/g, '\\"')}"` : `'${s}'`);

const out = `/**
 * ของที่ "fix ตาม slot / grade" อยู่แล้ว — ไม่ต้องเก็บซ้ำในชีต
 *
 * - ชื่อของ ผูกกับ (slot, grade)
 * - base stat ผูกกับ slot
 *
 * NOTE: substat ไม่ได้ผูกกับ slot (slot เดียวออกได้หลายแบบ) เลยยังต้องเก็บในชีต
 *
 * ‼️ ไฟล์นี้ generate จาก data/oven-tool-v1.json — อย่าแก้มือ
 *    แก้แล้วรัน: node tools/build-catalog.mjs
 *    source: ${data.source} ${data.sourceVersion}
 */
import { SLOT_TYPES } from './constants.mjs';

/** grade code (1–${gradeKeys.length}) → key; ${gradeKeys.length - 1} = legendary, ${gradeKeys.length} = eternal */
export const GRADE_KEYS = [
${gradeKeys.map((k) => `  ${q(k)},`).join('\n')}
];

/** slot (1–${SLOT_COUNT}) → stat id ของ base stat */
export const BASE_STAT_BY_SLOT = [
${baseStat.map((id, i) => `  ${q(id)}, // ${i + 1} ${data.types[i].key.toLowerCase()}`).join('\n')}
];

/** slot (1–${SLOT_COUNT}) → { grade key: ชื่อของ } */
export const ITEM_NAMES = [
${names
  .map(
    (entry, i) =>
      `  // ${i + 1} ${data.types[i].key.toLowerCase()}\n  {\n${gradeKeys
        .filter((g) => entry[g])
        .map((g) => `    ${g}: ${q(entry[g])},`)
        .join('\n')}\n  },`,
  )
  .join('\n')}
];

/** ชีตเก็บ grade เป็นเลข (9/10) — รับ key ตรงๆ ก็ได้ */
export function resolveGrade(raw) {
  const key = String(raw).trim().toLowerCase();
  const code = Number(key);
  if (code >= 1 && code <= GRADE_KEYS.length) {
    return GRADE_KEYS[code - 1];
  }
  return GRADE_KEYS.includes(key) ? key : GRADE_KEYS[GRADE_KEYS.length - 2];
}

/** grade → เลข tier ในชื่อไฟล์ไอคอน (legendary → '09') */
export function gradeTier(grade) {
  const index = GRADE_KEYS.indexOf(grade);
  return String(index < 0 ? GRADE_KEYS.length : index + 1).padStart(2, '0');
}

export function baseStatForSlot(slot) {
  return BASE_STAT_BY_SLOT[slot - 1] || '';
}

/** ไม่มีในตาราง (ของใหม่) → คืนชื่อ slot ไว้ก่อน ไม่ให้การ์ดว่าง */
export function itemNameFor(slot, grade) {
  const entry = ITEM_NAMES[slot - 1] || {};
  return entry[grade] || SLOT_TYPES[slot - 1] || '';
}
`;

writeFileSync(join(ROOT, 'assets', 'js', 'catalog.mjs'), out);
console.log(
  `catalog.mjs ← ${data.equipments.length} ชิ้น (${gradeKeys.length} grade × ${SLOT_COUNT} slot)`,
);
