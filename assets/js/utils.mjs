export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function statDisplayValue(raw) {
  return String(raw).replace(/^\+/, '');
}

export function normalizeStatLabel(label) {
  return String(label).trim().toUpperCase().replace(/\s+/g, ' ');
}

export function statBestMatch(label, bestList) {
  const key = normalizeStatLabel(label);
  return (bestList || []).some((best) => normalizeStatLabel(best) === key);
}
