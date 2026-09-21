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

export const MODE_ICONS = { pve: 'flame', boss: 'swords' };

const DEFAULT_MODE_BY_SET = { boss: 'pve', pve: 'boss' };

const EMPTY_BEST_SUBSTAT = { rows: [] };

let bestSubstats = BUILT_IN_BEST_SUBSTATS;

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
