export const GRADES = {
  eternal: { frame: '#8b5cf6', glow: '#c4b5fd' },
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
 * Best substat ต่อแถว (grid 4 แถว) — มีแค่ 2 แบบ เลยฝังไว้แทนที่จะอ่านจาก Sheet
 *
 * key = setKey; set ที่ไม่มีในนี้ (เช่น set3) = ไม่ highlight
 * rows = stat id (ดู stats.mjs), labels = caption เหนือแถว (ข้อความอิสระ)
 * NOTE: ค่าเป็นแบบ "หลังสลับ" ที่ .erb ทำไว้ — `boss` จึงเป็นชุดสาย Accuracy
 * ปุ่ม swap ใน UI สลับระหว่าง 2 profile นี้
 */
const BEST_SUBSTAT_PROFILES = {
  boss: {
    rows: [
      ['skillAmp', 'accuracy'],
      ['dmgReduction', 'critRes'],
      ['skillAmp', 'critDmg', 'accuracy', 'focus', 'skillHaste'],
      ['focus', 'skillHaste'],
    ],
    labels: [
      'Skill AMP / Accuracy',
      'DMG Reduction / CRIT RES',
      'Skill AMP · Crit DMG · Accuracy · Focus / Skill Haste',
      'Focus / Skill Haste',
    ],
  },
  pve: {
    rows: [
      ['skillAmp', 'critDmg'],
      ['dmgReduction', 'critRes'],
      ['skillAmp', 'critDmg', 'skillHaste'],
      ['dmgReduction', 'skillHaste'],
    ],
    labels: [
      'Skill AMP / Crit DMG',
      'DMG Reduction / CRIT RES',
      'Skill AMP · Crit DMG / Skill Haste',
      'DMG Reduction / Skill Haste',
    ],
  },
};

const EMPTY_BEST_SUBSTAT = { rows: [], labels: [] };

export function bestSubstatFor(setKey) {
  return BEST_SUBSTAT_PROFILES[setKey] || EMPTY_BEST_SUBSTAT;
}
