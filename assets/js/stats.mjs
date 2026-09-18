/**
 * Stat catalog — สะพานระหว่าง id ที่เก็บในชีต กับ label + วิธี format ตอนแสดงผล
 *
 * ชีตเก็บ **code หรือ id + ตัวเลขล้วน** — ไม่ต้องเก็บ "8.53%" / "+6,043" เป็นข้อความ
 *
 * format:
 *   int     → 6,043   (คั่นหลักพัน ปัดเป็นจำนวนเต็ม)
 *   decimal → 475.60  (ทศนิยม 2 ตำแหน่ง)
 *   percent → 8.53%   **เก็บเป็นเศษส่วน 0.0853** (พิมพ์ 8.53% ในชีตแล้ว Sheets เก็บแบบนี้เอง)
 *
 * code = เลขที่ใช้ในชีต, id = ชื่อที่ใช้ในโค้ด — เพิ่ม stat ใหม่ = เพิ่ม 1 บรรทัดตรงนี้
 */
export const STATS = {
  atk: { code: 1, label: 'ATK', format: 'int' },
  def: { code: 6, label: 'DEF', format: 'int' },
  hp: { code: 9, label: 'HP', format: 'int' },

  skillAmp: { code: 2, label: 'Skill AMP', format: 'percent' },
  critRate: { code: 5, label: 'CRIT%', format: 'percent' },
  critDmg: { code: 3, label: 'CRIT DMG', format: 'percent' },
  critRes: { code: 8, label: 'CRIT RES', format: 'percent' },
  dmgReduction: { code: 7, label: 'DMG Reduction', format: 'percent' },

  accuracy: { code: 4, label: 'Accuracy', format: 'decimal' },
  evasion: { code: 10, label: 'Evasion', format: 'decimal' },
  focus: { code: 11, label: 'Focus', format: 'decimal' },
  resistance: { code: 12, label: 'Resistance', format: 'decimal' },
  skillHaste: { code: 13, label: 'Skill Haste', format: 'decimal' },
};

function normalizeKey(raw) {
  return String(raw).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// NOTE: รับได้ทั้ง code (`2`), id (`skillAmp`) และ label (`Skill AMP`) — ชีตพิมพ์แบบไหนมาก็ได้
const STAT_ID_BY_KEY = (() => {
  const index = {};
  Object.keys(STATS).forEach((id) => {
    index[normalizeKey(id)] = id;
    index[normalizeKey(STATS[id].label)] = id;
    index[normalizeKey(STATS[id].code)] = id;
  });
  return index;
})();

/** คืน id ที่รู้จัก, ไม่รู้จักคืนค่าที่ส่งมาตามเดิม (แสดงผลได้ แต่ไม่รู้ format) */
export function resolveStatId(raw) {
  const key = normalizeKey(raw);
  return STAT_ID_BY_KEY[key] || String(raw).trim();
}

export function statLabel(statId) {
  return STATS[statId] ? STATS[statId].label : String(statId);
}

/**
 * 0.0853 → 0.0853, "+6,043" → 6043, "8.53%" → 0.0853
 * NOTE: ข้อความที่มี % แปลงกลับเป็นเศษส่วน ให้ตรงกับที่เก็บในชีต
 */
export function toStatNumber(raw) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  const text = String(raw);
  const num = parseFloat(text.replace(/[,%+\s]/g, ''));
  if (!Number.isFinite(num)) {
    return 0;
  }
  return text.includes('%') ? num / 100 : num;
}

function withThousands(value) {
  const rounded = Math.round(Math.abs(value));
  const digits = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (value < 0 ? '-' : '') + digits;
}

export function formatStat(statId, value) {
  const amount = toStatNumber(value);
  switch (STATS[statId] ? STATS[statId].format : '') {
    case 'int':
      return withThousands(amount);
    case 'percent':
      // เก็บเป็นเศษส่วน (0.0853) → แสดง 8.53%
      return `${(amount * 100).toFixed(2)}%`;
    case 'decimal':
      return amount.toFixed(2);
    default:
      // stat ที่ไม่มีใน catalog — โชว์เลขดิบ ตัด .00 ที่ไม่จำเป็นออก
      return String(Number(amount.toFixed(2)));
  }
}

/** 287.59 → "287.59M" */
export function formatPower(value) {
  return `${toStatNumber(value).toFixed(2)}M`;
}

export function isPercentStat(statId) {
  return Boolean(STATS[statId]) && STATS[statId].format === 'percent';
}
