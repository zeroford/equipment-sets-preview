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

/**
 * ใบหลักของช่อง — ตัวที่ปักหมุดไว้ ไม่มีก็เอาใบบนสุด
 *
 * NOTE: ลำดับที่แสดงเรียงตามความใหม่ (ใบที่เพิ่งเพิ่มอยู่บนสุด) ไม่ได้เรียงตามหมุด
 * เพราะงั้นใบแรกกับใบหลักเป็นคนละใบได้
 */
export function mainItem(list) {
  return (list || []).find((item) => item.isMain) || (list || [])[0] || null;
}
