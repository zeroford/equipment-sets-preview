import { CURVES, GAME_PERCENT_STATS, RATE_BY_SLOT, SUB_RANGES } from './base-stat-data.mjs';
import { GRADE_KEYS, baseStatForSlot } from './catalog.mjs';

/**
 * โบนัสที่บวกทับค่าจากตารางเกม
 *
 * ค่าในไฟล์เกมเป็นค่าดิบ ของจริงในเกมโดนบวกอีกชั้น ซึ่งไม่ได้อยู่ในไฟล์
 * ตัวเลขชุดนี้มาจากการเทียบกับของจริง — slot ไหนไม่ตรง แก้ตรงนี้ที่เดียว
 *
 * base = ค่าตาราง × rate × (1 + baseBonus)
 */
const DEFAULT_BONUS = 1.05;

const DEFAULT_SUB_BONUS = 1.3;

const SUB_BONUS_BY_SLOT = {
  4: 0.7, // helmet
  5: 0.7, // armor
};

const BONUS_BY_SLOT = {
  4: 0.57, // helmet
  5: 0.69, // armor
  11: 1.23, // book — วัดจากของจริงได้ +123% ไม่ใช่ +105%
};

function baseBonusForSlot(slot) {
  return slot in BONUS_BY_SLOT ? BONUS_BY_SLOT[slot] : DEFAULT_BONUS;
}

/**
 * ค่า base stat ที่ควรได้ จาก slot + grade + level
 *
 * คืนค่าในหน่วยที่เก็บจริง (stat แบบ % เป็นเศษส่วน) — ไม่รู้ก็คืน null
 */
export function computeBaseStat(slot, grade, level) {
  // รับได้ทั้งเลข (10) และชื่อ ('eternal')
  const code = Number(grade) || GRADE_KEYS.indexOf(String(grade)) + 1;
  const rate = (RATE_BY_SLOT[slot - 1] || {})[code];
  const statId = baseStatForSlot(slot);
  const curve = CURVES[statId];
  if (!rate || !curve || !(level >= 1 && level <= curve.length)) {
    return null;
  }

  const value = curve[level - 1] * (rate / 100) * (1 + baseBonusForSlot(slot));
  // NOTE: หาร 100 ตาม format ของ "ไฟล์เกม" ไม่ใช่ format ที่เราใช้โชว์
  // เช่น Accuracy เกมบอก percent (11600) แต่เราเก็บ/โชว์เป็นเลขธรรมดา (475.60)
  return GAME_PERCENT_STATS.includes(statId) ? value / 100 : value;
}

/**
 * ช่วงค่าที่ substat ตัวนั้นออกได้ [min, max] — ไม่รู้ก็คืน null
 *
 * NOTE: ตารางเก็บค่าดิบ ของจริงโดนบวกอีกชั้นเหมือน base stat (คนละตัวเลขกัน)
 * stat ที่ min = max (ตอนนี้มีแค่ Skill Haste) ถือว่าไม่มีช่วง คืน null ไปเลย
 */
export function subStatRange(slot, grade, statId) {
  const code = Number(grade) || GRADE_KEYS.indexOf(String(grade)) + 1;
  const range = ((SUB_RANGES[slot - 1] || {})[code] || {})[statId];
  if (!range || range[0] === range[1]) {
    return null;
  }
  const bonus = 1 + (slot in SUB_BONUS_BY_SLOT ? SUB_BONUS_BY_SLOT[slot] : DEFAULT_SUB_BONUS);
  return [range[0] * bonus, range[1] * bonus];
}

/** เลเวลสูงสุดที่ตารางของเกมมีข้อมูล — เกินนี้คำนวณ base stat ไม่ได้ */
export const MAX_LEVEL = CURVES.atk.length;

/**
 * substat ที่ slot + เกรดนี้โรลออกได้จริง — ตารางของเกมบอกไว้ไม่เท่ากันทุกช่อง
 * เช่น ATK/CRIT DMG ไม่มีทางออกใน helmet/armor/shield
 */
export function subStatIds(slot, grade) {
  const code = Number(grade) || GRADE_KEYS.indexOf(String(grade)) + 1;
  return Object.keys((SUB_RANGES[slot - 1] || {})[code] || {});
}

/**
 * substat ที่โรลไม่ได้ (min = max) คืนค่าเดียวที่เป็นไปได้ — ตัวที่โรลได้คืน null
 *
 * NOTE: คู่กับ subStatRange ที่คืน null ให้ stat แบบนี้ — ฟอร์มจะได้เติมค่าให้เลย
 * ไม่ต้องให้คนกรอกเองทั้งที่มีทางเลือกเดียว
 */
export function subStatFixed(slot, grade, statId) {
  const code = Number(grade) || GRADE_KEYS.indexOf(String(grade)) + 1;
  const range = ((SUB_RANGES[slot - 1] || {})[code] || {})[statId];
  if (!range || range[0] !== range[1]) {
    return null;
  }
  const bonus = 1 + (slot in SUB_BONUS_BY_SLOT ? SUB_BONUS_BY_SLOT[slot] : DEFAULT_SUB_BONUS);
  return range[0] * bonus;
}

/**
 * ค่าที่ได้อยู่ตรงไหนของช่วง — 0 = ต่ำสุด, 1 = สูงสุด, ไม่รู้ช่วงคืน null
 */
export function subStatRatio(slot, grade, statId, value) {
  const range = subStatRange(slot, grade, statId);
  if (!range) {
    return null;
  }
  const [low, high] = range;
  return (value - low) / (high - low);
}
