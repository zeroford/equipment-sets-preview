function parsePower(str) {
  return parseFloat(String(str).trim().replace(/M$/i, '').replace(/,/g, '')) || 0;
}

function formatPower(total) {
  return `${total.toFixed(2)}M`;
}

function parseStatAmount(value) {
  const raw = String(value).trim();
  if (raw.includes('%')) {
    return { kind: 'percent', amount: parseFloat(raw.replace(/%/g, '').replace(/,/g, '')) || 0 };
  }
  return { kind: 'flat', amount: parseFloat(raw.replace(/^\+/, '').replace(/,/g, '')) || 0 };
}

function addWithCommas(integer) {
  const sign = integer < 0 ? '-' : '';
  const digits = String(Math.abs(Math.round(integer)))
    .split('')
    .reverse()
    .join('')
    .replace(/(\d{3})(?=\d)/g, '$1,')
    .split('')
    .reverse()
    .join('');
  return sign + digits;
}

function formatFlatTotal(total) {
  if (Math.abs(total - Math.round(total)) < 0.0001) {
    return addWithCommas(total);
  }
  return total.toFixed(2);
}

function formatPercentTotal(total) {
  return `${total.toFixed(2)}%`;
}

/**
 * Aggregates equipped item stats for the summary popover.
 */
export function buildSetSummary(set) {
  const equipped = (set.items || []).filter(Boolean);
  const sums = {};

  equipped.forEach((item) => {
    (item.stats || []).forEach(([label, value]) => {
      const parsed = parseStatAmount(value);
      if (!sums[label]) {
        sums[label] = { kind: parsed.kind, total: parsed.amount };
      } else {
        sums[label].total += parsed.amount;
      }
    });
  });

  const aggregatedStats = Object.keys(sums)
    .sort()
    .map((label) => {
      const entry = sums[label];
      const display =
        entry.kind === 'percent' ? formatPercentTotal(entry.total) : formatFlatTotal(entry.total);
      return { label, display };
    });

  const totalPower = formatPower(
    equipped.reduce((sum, item) => sum + parsePower(item.power), 0),
  );

  return { setKey: set.setKey, aggregatedStats, totalPower };
}
