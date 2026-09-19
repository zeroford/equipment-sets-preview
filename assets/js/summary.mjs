import { formatStat, statLabel } from './stats.mjs';

/**
 * Aggregates equipped item stats for the summary popover.
 *
 * NOTE: รวมตาม stat id แล้วค่อย format ทีเดียวตอนท้าย — ไม่ต้อง parse ข้อความอย่าง "8.53%" อีก
 */
export function buildSetSummary(set) {
  /*
   * NOTE: ช่องละหลายใบได้ แต่ยอดรวมนับใบเดียวต่อช่อง (ใบบนสุด = แถวล่าสุดในชีต)
   * ใส่ของซ้ำช่องไว้เทียบกัน ไม่ได้แปลว่าสวมพร้อมกัน
   */
  const equipped = (set.items || []).map((list) => (list || [])[0]).filter(Boolean);
  const totals = new Map();

  equipped.forEach((item) => {
    (item.stats || []).forEach(([statId, value]) => {
      totals.set(statId, (totals.get(statId) || 0) + value);
    });
  });

  // NOTE: เรียงด้วย < > ดิบๆ ไม่ใช่ localeCompare — ให้ลำดับตรงกับของเดิม
  const aggregatedStats = Array.from(totals, ([statId, total]) => ({
    label: statLabel(statId),
    display: formatStat(statId, total),
  })).sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));

  return { setKey: set.setKey, aggregatedStats };
}
