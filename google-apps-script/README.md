# Google Apps Script Web App

Sheet เป็นแหล่งข้อมูลจริง — แก้ item ในชีตแล้ว refresh เว็บ ไม่ต้อง push ใหม่

## 1. โครงชีต — 3 แท็บ

ชื่อแท็บต้องตรงเป๊ะ (`Sets` / `Items` / `BestStats`) ส่วนชื่อ**คอลัมน์**ในบรรทัดแรก
ไม่สนตัวพิมพ์เล็กใหญ่ ช่องว่าง หรือขีด (`setKey` = `Set Key` = `set_key`) และสลับลำดับคอลัมน์ได้

### แท็บ `Sets` — มีกี่ set, ชื่ออะไร, เรียงยังไง

| setKey | title | order |
|--------|-------|-------|
| boss | Set A | 1 |
| pve | Set B | 2 |
| set3 | Set C | 3 |

- `setKey` — คีย์ภายใน ใช้อ้างจากอีก 2 แท็บ อย่าเปลี่ยนพร่ำเพรื่อ (`pve`/`boss` ผูกกับ badge PvE/Boss ในหน้าเว็บ)
- `order` — ลำดับ tab น้อยไปมาก

### แท็บ `Items` — 1 แถว = equipment 1 ชิ้น

| setKey | slot | level | grade | name | power | stat1Label | stat1Value | stat2Label | stat2Value | stat3Label | stat3Value |
|---|---|---|---|---|---|---|---|---|---|---|---|
| boss | 1 | 97 | eternal | Axe-Spear of Blind Destruction | 287.59M | ATK | +6,043 | Skill AMP | 8.53% | CRIT DMG | 14.62% |

- `slot` — ตำแหน่งใน grid 3×4 **นับ 1–12 ซ้ายไปขวา บนลงล่าง**

  |  |  |  |
  |---|---|---|
  | 1 sword | 2 bow | 3 staff |
  | 4 helmet | 5 armor | 6 shield |
  | 7 necklace | 8 ring | 9 brooch |
  | 10 artifact | 11 book | 12 food |

  **ช่องว่าง = ไม่ต้องมีแถว** (ไม่ใช่แถวเปล่า) — slot ที่ไม่มีใน `Items` จะขึ้นเป็น plate เปล่า
- `grade` — `eternal` (ม่วง) หรือ `legendary` (ทอง) เท่านั้น
- `stat1` = base stat (โชว์ตัวใหญ่), `stat2` เป็นต้นไป = substat (โชว์เป็น list) — เพิ่มได้ถึง `stat6`
- `power`, `stat*Value` เป็น **ข้อความล้วน** ใส่ยังไงโชว์อย่างนั้น (`+` นำหน้าจะถูกตัดตอนแสดงผล)

### แท็บ `BestStats` — เน้น substat ที่ดีของแต่ละแถว (row 1–4)

| setKey | row | bestStats | label |
|---|---|---|---|
| boss | 1 | Skill AMP, Accuracy | Skill AMP / Accuracy |
| boss | 2 | DMG Reduction, CRIT RES | DMG Reduction / CRIT RES |

- `bestStats` — คั่นด้วย `,` `·` `/` หรือ `|` ก็ได้; substat ที่ตรงจะถูก highlight (เทียบแบบไม่สนตัวพิมพ์)
- `label` — ข้อความ caption เหนือแถวนั้น ใส่อะไรก็ได้
- set ที่ไม่ต้องการ highlight ข้ามได้เลย (ไม่มีแถว = ไม่ highlight)

## 2. ใส่ข้อมูลตั้งต้น (ไม่ต้องพิมพ์เอง)

```bash
./render.sh && node tools/sheet-seed.mjs   # → google-apps-script/seed/*.tsv
python3 tools/sheet-xlsx.py                # → seed/equipment-sets.xlsx
```

แปลงจาก JSON ที่ฝังอยู่ในเว็บตอนนี้ (3 sets / 22 items)

### วิธี A — import .xlsx (แนะนำ, ได้ครบ 3 แท็บทีเดียว)

ลาก `equipment-sets.xlsx` ลง Google Drive → คลิกขวา → Open with → Google Sheets  
ทุกเซลล์ตั้งเป็น text มาแล้ว ค่าอย่าง `8.53%` / `+6,043` จะไม่โดนแปลง

(ถ้าจะ import เข้าชีตเดิม: File → Import → Upload → **Insert new sheet(s)**)

### วิธี B — paste TSV ทีละแท็บ

1. สร้างแท็บชื่อตรงกับไฟล์
2. เลือกทั้งชีต → Format → Number → **Plain text**
   ⚠️ **ต้องทำก่อน paste** ไม่งั้น Sheets จะแปลง `8.53%` เป็น `0.0853` และ `+6,043` เป็น `6043`
3. เปิดไฟล์ `.tsv` → copy ทั้งหมด → paste ที่ **A1**

## 3. Deploy Script

1. Extensions → Apps Script
2. วางทับด้วย `Code.gs`
3. Deploy → New deployment → **Web app**
4. Execute as: **Me** / Who has access: **Anyone**
5. Copy URL (ลงท้าย `/exec`)

แก้ชีตทีหลังไม่ต้อง deploy ใหม่ — แต่ถ้าแก้ `Code.gs` ต้อง Deploy → **Manage deployments** → edit → New version

## 4. ต่อกับเว็บ

ใน `index.html.erb`:

```ruby
sheets_config_json = { 'webAppUrl' => 'https://script.google.com/macros/s/....../exec' }.to_json
```

ทดสอบโดยไม่แก้ไฟล์:

```
index.html?webApp=https://script.google.com/macros/s/....../exec
```

โหลด Web App ไม่สำเร็จ → เว็บ fallback ไป JSON ที่ฝังไว้ แล้วขึ้นข้อความ error บนหน้า

## 5. เช็ก / แก้ปัญหา

เปิด URL `/exec` ตรงๆ ในเบราว์เซอร์ ควรเห็น `{"sets":[...]}`

| อาการ | สาเหตุ |
|---|---|
| `{"error":"ไม่พบแท็บ: Items"}` | ชื่อแท็บไม่ตรง |
| `{"error":"... slot ต้องเป็น 1–12 ..."}` | `slot` ว่าง/เกินช่วง — ช่องว่างให้ลบทั้งแถว |
| stat โชว์ `0.0853` | ไม่ได้ตั้ง Plain text ก่อน paste |
| หน้าเว็บขึ้น error แต่ยังเห็นการ์ด | fallback ไป JSON ในหน้าเว็บ — ดูข้อความ error |
| แก้ชีตแล้วเว็บไม่เปลี่ยน | เว็บใส่ `?t=` กัน cache อยู่แล้ว ลอง hard refresh / ดู `/exec` ตรงๆ |
