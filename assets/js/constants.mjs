export const GRADES = {
  eternal: { frame: '#a855f7', glow: '#f0abfc' },
  legendary: { frame: '#ca8a04', glow: '#fde047' },
};

export const SLOT_TYPES = [
  'sword', 'bow', 'staff',
  'helmet', 'armor', 'shield',
  'necklace', 'ring', 'brooch',
  'artifact', 'book', 'food',
];

// NOTE: grade → tier ในชื่อไฟล์ไอคอน ย้ายไป catalog.mjs แล้ว (gradeTier)
// ที่นี่เหลือแค่สีของกรอบการ์ด — มีรูปเฉพาะ legendary/eternal

/**
 * Best substat ต่อแถว (grid 4 แถว) — มีแค่ 2 โหมด เลยฝังไว้แทนที่จะอ่านจาก Sheet
 *
 * key = โหมด (ตรงกับที่โชว์บนปุ่ม toggle) ไม่ใช่ setKey
 * rows = stat id (ดู stats.mjs) — ใช้ทั้ง highlight และ tag เหนือแถว
 */
/**
 * ค่าตั้งต้นของ best substat — ใช้เมื่อชีตไม่ได้กำหนดมา
 *
 * rows[i] = แถวที่ i ของกริด (0 = slot 1-3, 1 = slot 4-6, 2 = 7-9, 3 = 10-12)
 */
const BUILT_IN_BEST_SUBSTATS = {
  pve: {
    rows: [
      ['skillAmp', 'accuracy'],
      ['dmgReduction', 'critRes'],
      ['skillAmp', 'critDmg', 'accuracy', 'focus', 'skillHaste'],
      ['focus', 'skillHaste'],
    ],
  },
  boss: {
    rows: [
      ['skillAmp', 'critDmg'],
      ['dmgReduction', 'critRes'],
      ['skillAmp', 'critDmg', 'skillHaste'],
      ['dmgReduction', 'skillHaste'],
    ],
  },
};

export const MODES = ['pve', 'boss'];
export const MODE_LABELS = { pve: 'PvE', boss: 'Boss' };

/** ชื่อ icon ของ lucide (โหลดจาก CDN ใน .erb) */
export const MODE_ICONS = { pve: 'flame', boss: 'swords' };

/**
 * โหมดตั้งต้นของแต่ละ set — set ที่ไม่มีในนี้ = ไม่มีโหมด (ไม่ highlight, ไม่มี toggle)
 *
 * NOTE: setKey 'boss' ตั้งต้นเป็นโหมด pve เพราะ .erb สลับชุด equipment ระหว่าง
 * pve/boss ไว้ตั้งแต่แรก — ชื่อ setKey เลยไม่ตรงกับโหมด
 */
const DEFAULT_MODE_BY_SET = { boss: 'pve', pve: 'boss' };

const EMPTY_BEST_SUBSTAT = { rows: [] };

/**
 * ชุดที่ใช้อยู่จริง — ชีตเขียนทับได้ ไม่งั้นใช้ค่าตั้งต้นในไฟล์นี้
 *
 * NOTE: เก็บเป็นตัวแปรเดียวแทนที่จะส่ง profile ไปตามทาง เพราะมีคนเรียก
 * bestSubstatFor หลายที่ (การ์ด, Compare, ฟอร์ม) และทุกที่ต้องเห็นชุดเดียวกัน
 */
let bestSubstats = BUILT_IN_BEST_SUBSTATS;

/**
 * รับชุดจากชีต — โหมดไหนไม่มีข้อมูลก็ใช้ค่าตั้งต้นของโหมดนั้นต่อ
 * ส่ง falsy หรือของว่างมา = กลับไปใช้ค่าตั้งต้นทั้งหมด
 */
export function configureBestSubstats(profiles) {
  if (!profiles || !Object.keys(profiles).length) {
    bestSubstats = BUILT_IN_BEST_SUBSTATS;
    return;
  }
  const merged = {};
  MODES.forEach((mode) => {
    const rows = profiles[mode] && profiles[mode].rows;
    merged[mode] = rows && rows.length ? { rows } : BUILT_IN_BEST_SUBSTATS[mode];
  });
  bestSubstats = merged;
}

export function defaultModeFor(setKey) {
  return DEFAULT_MODE_BY_SET[setKey] || '';
}

export function bestSubstatFor(mode) {
  return bestSubstats[mode] || EMPTY_BEST_SUBSTAT;
}
