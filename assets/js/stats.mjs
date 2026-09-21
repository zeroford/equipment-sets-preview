export const STATS = {
  atk: { label: 'ATK', format: 'int' },
  def: { label: 'DEF', format: 'int' },
  hp: { label: 'HP', format: 'int' },

  skillAmp: { label: 'Skill AMP', format: 'percent' },
  critRate: { label: 'CRIT%', format: 'percent' },
  critDmg: { label: 'CRIT DMG', format: 'percent' },
  critRes: { label: 'CRIT RES', format: 'percent' },
  dmgReduction: { label: 'DMG RDN', format: 'percent' },

  accuracy: { label: 'Accuracy', format: 'decimal' },
  evasion: { label: 'Evasion', format: 'decimal' },
  focus: { label: 'Focus', format: 'decimal' },
  resistance: { label: 'Resistance', format: 'decimal' },
  skillHaste: { label: 'Skill Haste', format: 'decimal' },
};

function normalizeKey(raw) {
  return String(raw).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ALIASES = {
  dmgReduction: ['DMG Reduction'],
};

const STAT_ID_BY_KEY = (() => {
  const index = {};
  Object.keys(STATS).forEach((id) => {
    index[normalizeKey(id)] = id;
    index[normalizeKey(STATS[id].label)] = id;
    (ALIASES[id] || []).forEach((alias) => {
      index[normalizeKey(alias)] = id;
    });
  });
  return index;
})();

export function resolveStatId(raw) {
  const key = normalizeKey(raw);
  return STAT_ID_BY_KEY[key] || String(raw).trim();
}

export function statLabel(statId) {
  return STATS[statId] ? STATS[statId].label : String(statId);
}

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
           return `${(amount * 100).toFixed(2)}%`;
    case 'decimal':
      return amount.toFixed(2);
    default:
           return String(Number(amount.toFixed(2)));
  }
}

export function formatStatRange(statId, low, high) {
  const from = formatStat(statId, low);
  const to = formatStat(statId, high);
  const shared = from.endsWith('%') && to.endsWith('%');
  return `${shared ? from.slice(0, -1) : from}~${to}`;
}
