import { CURVES, GAME_PERCENT_STATS, RATE_BY_SLOT, SUB_RANGES } from './base-stat-data.mjs';
import { GRADE_KEYS, baseStatForSlot } from './catalog.mjs';

const DEFAULT_BONUS = 1.05;

const DEFAULT_SUB_BONUS = 1.3;

const SUB_BONUS_BY_SLOT = {};

const BONUS_BY_SLOT = {
  11: 1.23,
};

function baseBonusForSlot(slot) {
  return slot in BONUS_BY_SLOT ? BONUS_BY_SLOT[slot] : DEFAULT_BONUS;
}

export function computeBaseStat(slot, grade, level) {
   const code = Number(grade) || GRADE_KEYS.indexOf(String(grade)) + 1;
  const rate = (RATE_BY_SLOT[slot - 1] || {})[code];
  const statId = baseStatForSlot(slot);
  const curve = CURVES[statId];
  if (!rate || !curve || !(level >= 1 && level <= curve.length)) {
    return null;
  }

  const value = curve[level - 1] * (rate / 100) * (1 + baseBonusForSlot(slot));
    return GAME_PERCENT_STATS.includes(statId) ? value / 100 : value;
}

export function subStatRange(slot, grade, statId) {
  const code = Number(grade) || GRADE_KEYS.indexOf(String(grade)) + 1;
  const range = ((SUB_RANGES[slot - 1] || {})[code] || {})[statId];
  if (!range || range[0] === range[1]) {
    return null;
  }
  const bonus = 1 + (slot in SUB_BONUS_BY_SLOT ? SUB_BONUS_BY_SLOT[slot] : DEFAULT_SUB_BONUS);
  return [range[0] * bonus, range[1] * bonus];
}

export const MAX_LEVEL = CURVES.atk.length;

export function subStatIds(slot, grade) {
  const code = Number(grade) || GRADE_KEYS.indexOf(String(grade)) + 1;
  return Object.keys((SUB_RANGES[slot - 1] || {})[code] || {});
}

export function subStatFixed(slot, grade, statId) {
  const code = Number(grade) || GRADE_KEYS.indexOf(String(grade)) + 1;
  const range = ((SUB_RANGES[slot - 1] || {})[code] || {})[statId];
  if (!range || range[0] !== range[1]) {
    return null;
  }
  const bonus = 1 + (slot in SUB_BONUS_BY_SLOT ? SUB_BONUS_BY_SLOT[slot] : DEFAULT_SUB_BONUS);
  return range[0] * bonus;
}

export function subStatRatio(slot, grade, statId, value) {
  const range = subStatRange(slot, grade, statId);
  if (!range) {
    return null;
  }
  const [low, high] = range;
  return (value - low) / (high - low);
}
