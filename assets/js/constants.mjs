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
const BEST_SUBSTAT_PROFILES = {
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

export function defaultModeFor(setKey) {
  return DEFAULT_MODE_BY_SET[setKey] || '';
}

export function bestSubstatFor(mode) {
  return BEST_SUBSTAT_PROFILES[mode] || EMPTY_BEST_SUBSTAT;
}
