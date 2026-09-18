# Equipment sets preview

Static preview สำหรับ equipment set cards (Set A / B / C)

## Local

```bash
./render.sh
```

`render.sh` จะเปิดเซิร์ฟเวอร์ให้เองแล้วเปิด <http://localhost:8765/index.html>

⚠️ เปิด `index.html` ด้วย `file://` ตรงๆ จะได้**หน้าว่าง** — ES modules โดน CORS บล็อก ต้อง serve ผ่าน HTTP เท่านั้น

## โครงสร้าง

| Path | 用途 |
|------|------|
| `index.html.erb` | CSS + shell HTML + JSON สำรอง |
| `index.html` | output หลัง `./render.sh` |
| `assets/js/*.mjs` | render UI, swap, โหลด Web App |
| `assets/equipment/` `assets/plates/` | รูป |
| `google-apps-script/` | Apps Script Web App (API อ่าน Sheet) |
| `tools/sheet-seed.mjs` | JSON ในเว็บ → TSV สำหรับ paste ลงชีต |
| `tools/sheet-xlsx.py` | TSV → .xlsx สำหรับ import เข้า Google Sheets |

### JS modules

- `constants.mjs` — grade / slot / best substat (2 แบบ)
- `stats.mjs` — catalog ของ stat (id, label, format)
- `catalog.mjs` — ชื่อของตาม (slot, grade) + base stat ตาม slot
- `utils.mjs` — escape, stat match
- `summary.mjs` — รวม stat popover
- `data.mjs` — normalize JSON, `fetch` Web App
- `render.mjs` — วาดการ์ด + tab
- `best-substat.mjs` — tab + swap PvE/Boss
- `main.mjs` — entry

## Data

1. **สำรองในเว็บ** — `#equipment-sets-data` จาก Ruby ใน `.erb` (ใช้เมื่อโหลด Web App ไม่สำเร็จ)
2. **Google Sheet** ผ่าน Apps Script Web App — ตั้ง `webAppUrl` ใน `#equipment-sheets-config` หรือ query `?webApp=URL`

ชีตมี 2 แท็บ: `Sets` (setKey/title/order) และ `Items` (1 แถว = 1 ชิ้น, `slot` 1–12)
เก็บแค่ level / grade / power / ค่า stat / substat type — ชื่อของกับ base stat type
derive จาก slot+grade ในโค้ด

ใส่ข้อมูลตั้งต้นลงชีตครั้งแรก:

```bash
./render.sh && node tools/sheet-seed.mjs   # → google-apps-script/seed/*.tsv
python3 tools/sheet-xlsx.py                # → seed/equipment-sets.xlsx (import ทีเดียวจบ)
```

วิธี set ชีต + deploy ละเอียด → `google-apps-script/README.md`

## GitHub Pages

1. Push repo, Settings → Pages → **GitHub Actions**
2. ใส่ Web App URL ใน `equipment-sheets-config` ใน `.erb` แล้ว push (หรือใช้ `?webApp=`)

```bash
git add . && git commit -m "..." && git push -u origin main
```

URL: `https://YOUR_USER.github.io/equipment-sets-preview/`
