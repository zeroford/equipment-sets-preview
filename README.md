# Equipment sets preview

Static preview สำหรับ equipment set cards (Set A / B / C)

## Local

```bash
./render.sh
```

เปิด **`index.html`** — ใช้ ES modules ควร serve ผ่าน HTTP (ไม่ใช่ `file://` เปล่าๆ):

```bash
cd ~/equipment-sets-preview && python3 -m http.server 8765
# http://localhost:8765/index.html
```

## โครงสร้าง

| Path | 用途 |
|------|------|
| `index.html.erb` | CSS + shell HTML + JSON สำรอง |
| `index.html` | output หลัง `./render.sh` |
| `assets/js/*.mjs` | render UI, swap, โหลด Web App |
| `assets/equipment/` `assets/plates/` | รูป |
| `google-apps-script/` | Apps Script Web App (API อ่าน Sheet) |
| `tools/sheet-seed.mjs` | JSON ในเว็บ → TSV สำหรับ paste ลงชีต |

### JS modules

- `constants.mjs` — grade / slot
- `utils.mjs` — escape, stat match
- `summary.mjs` — รวม stat popover
- `data.mjs` — normalize JSON, `fetch` Web App
- `render.mjs` — วาดการ์ด + tab
- `best-substat.mjs` — tab + swap PvE/Boss
- `main.mjs` — entry

## Data

1. **สำรองในเว็บ** — `#equipment-sets-data` จาก Ruby ใน `.erb` (ใช้เมื่อโหลด Web App ไม่สำเร็จ)
2. **Google Sheet** ผ่าน Apps Script Web App — ตั้ง `webAppUrl` ใน `#equipment-sheets-config` หรือ query `?webApp=URL`

ชีตมี 3 แท็บ: `Sets` (setKey/title/order), `Items` (1 แถว = 1 ชิ้น, `slot` 1–12),
`BestStats` (substat ที่ highlight ของแต่ละแถว)

ใส่ข้อมูลตั้งต้นลงชีตครั้งแรก:

```bash
./render.sh && node tools/sheet-seed.mjs   # → google-apps-script/seed/*.tsv
```

วิธี set ชีต + deploy ละเอียด → `google-apps-script/README.md`

## GitHub Pages

1. Push repo, Settings → Pages → **GitHub Actions**
2. ใส่ Web App URL ใน `equipment-sheets-config` ใน `.erb` แล้ว push (หรือใช้ `?webApp=`)

```bash
git add . && git commit -m "..." && git push -u origin main
```

URL: `https://YOUR_USER.github.io/equipment-sets-preview/`
