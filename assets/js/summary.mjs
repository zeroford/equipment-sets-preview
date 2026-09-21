import { formatStat, statLabel } from './stats.mjs';
import { mainItem } from './utils.mjs';

export function buildSetSummary(set) {
   const equipped = (set.items || []).map(mainItem).filter(Boolean);
  const totals = new Map();

  equipped.forEach((item) => {
    (item.stats || []).forEach(([statId, value]) => {
      totals.set(statId, (totals.get(statId) || 0) + value);
    });
  });

   const aggregatedStats = Array.from(totals, ([statId, total]) => ({
    label: statLabel(statId),
    display: formatStat(statId, total),
  })).sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));

  return { setKey: set.setKey, aggregatedStats };
}
