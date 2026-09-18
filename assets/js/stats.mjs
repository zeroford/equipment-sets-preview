/**
 * Stat catalog — สะพานระหว่าง id ที่เก็บในชีต กับ label + วิธี format ตอนแสดงผล
 *
 * ชีตเก็บ **id + ตัวเลขล้วน** (`skillAmp` / `0.0853`) — ไม่ต้องเก็บ "8.53%" เป็นข้อความ
 *
 * format:
 *   int     → 6,043   (คั่นหลักพัน ปัดเป็นจำนวนเต็ม)
 *   decimal → 475.60  (ทศนิยม 2 ตำแหน่ง)
 *   percent → 8.53%   **เก็บเป็นเศษส่วน 0.0853** (พิมพ์ 8.53% ในชีตแล้ว Sheets เก็บแบบนี้เอง)
 *
 * เพิ่ม stat ใหม่ = เพิ่ม 1 บรรทัดตรงนี้
 */
export const STATS = {
  atk: { label: 'ATK', format: 'int' },
  def: { label: 'DEF', format: 'int' },
  hp: { label: 'HP', format: 'int' },

  skillAmp: { label: 'Skill AMP', format: 'percent' },
  critRate: { label: 'CRIT%', format: 'percent' },
  critDmg: { label: 'CRIT DMG', format: 'percent' },
  critRes: { label: 'CRIT RES', format: 'percent' },
  dmgReduction: { label: 'DMG Reduction', format: 'percent' },

  accuracy: { label: 'Accuracy', format: 'decimal' },
  evasion: { label: 'Evasion', format: 'decimal' },
  focus: { label: 'Focus', format: 'decimal' },
  resistance: { label: 'Resistance', format: 'decimal' },
  skillHaste: { label: 'Skill Haste', format: 'decimal' },
};

function normalizeKey(raw) {
  return String(raw).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// NOTE: รับได้ทั้ง id (`skillAmp`) และ label (`Skill AMP`) — ชีตพิมพ์แบบไหนมาก็ได้
const STAT_ID_BY_KEY = (() => {
  const index = {};
  Object.keys(STATS).forEach((id) => {
    index[normalizeKey(id)] = id;
    index[normalizeKey(STATS[id].label)] = id;
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
