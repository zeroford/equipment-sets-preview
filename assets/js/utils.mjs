export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function statBestMatch(statId, bestList) {
  return (bestList || []).includes(statId);
}

export function mainItem(list) {
  return (list || []).find((item) => item.isMain) || (list || [])[0] || null;
}
