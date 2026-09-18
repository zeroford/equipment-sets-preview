# Google Apps Script Web App

Sheet เป็นแหล่งข้อมูลจริง — แก้ในชีตแล้ว refresh เว็บ ไม่ต้อง push ใหม่

หลักคิด: **ชีตเก็บเฉพาะที่เปลี่ยนจริงต่อชิ้น** ส่วนที่ fix ตาม slot/grade อยู่แล้วไป derive ในโค้ด

| ของ | อยู่ที่ไหน | เพราะ |
|---|---|---|
| level, grade, power, ค่า stat | **ชีต** | เปลี่ยนทุกชิ้น |
| substat type | **ชีต** | slot เดียวออกได้หลายแบบ |
| ชื่อของ | `assets/js/catalog.mjs` | fix ตาม (slot, grade) |
| ชนิด base stat | `assets/js/catalog.mjs` | fix ตาม slot |
| **ค่า** base stat | `assets/js/base-stat.mjs` | คำนวณจาก slot + grade + level |
| label / % / คั่นหลักพัน | `assets/js/stats.mjs` | เป็นเรื่องแสดงผล |
| best substat | `assets/js/constants.mjs` | มีแค่ 2 แบบ |

## 1. โครงชีต — 2 แท็บ

ชื่อแท็บต้องตรง (`Sets` / `Items`) ส่วนชื่อ**คอลัมน์**บรรทัดแรกไม่สนตัวพิมพ์/ช่องว่าง/ขีด
(`setKey` = `Set Key` = `set_key`) และสลับลำดับคอลัมน์ได้

### `Sets`

| setKey | title | order |
|--------|-------|-------|
| boss | Set A | 1 |
| pve | Set B | 2 |
| set3 | Set C | 3 |

`setKey` ใช้อ้างจากแท็บ `Items` — `pve`/`boss` ผูกกับ badge และปุ่ม swap ในหน้าเว็บ อย่าเปลี่ยนพร่ำเพรื่อ

### `Items` — 1 แถว = equipment 1 ชิ้น

| setKey | slot | level | grade | power | sub1Type | sub1Value | sub2Type | sub2Value |
|---|---|---|---|---|---|---|---|---|
| boss | 1 | 97 | 10 | 287.59 | skillAmp | 8.53% | critDmg | 14.62% |

- **`slot`** — ตำแหน่งใน grid 3×4 นับ 1–12 ซ้าย→ขวา บน→ล่าง

  |  |  |  |
  |---|---|---|
  | 1 sword | 2 bow | 3 staff |
  | 4 helmet | 5 armor | 6 shield |
  | 7 necklace | 8 ring | 9 brooch |
  | 10 artifact | 11 book | 12 food |

  **ช่องว่าง = ไม่ต้องมีแถว** (ไม่ใช่แถวเปล่า) → เว็บขึ้นเป็น plate เปล่า
- **`grade`** — `10` = eternal (ม่วง), `9` = legendary (ทอง) — พิมพ์ `eternal` / `legendary` ก็ได้
- **`power`** — ใส่ `287.59` เฉยๆ ตัว `M` เว็บเติมให้เอง
- **`subNType`** — stat id ของ substat เช่น `skillAmp` ดูรายการทั้งหมดในแท็บ `Stats` (พิมพ์ `Skill AMP` ก็ได้) รองรับถึง `sub5`
- **`subNValue`** — stat ที่เป็น **%** ให้พิมพ์แบบ `8.53%` ไปเลย (Sheets เก็บเป็น `0.0853` ซึ่งถูกต้อง)
  ที่เหลือพิมพ์เลขตรงๆ `6043`, `475.6`
- **`name`** — ไม่ต้องมี; ใส่คอลัมน์นี้เมื่ออยาก override ชื่อเป็นรายชิ้น

### `Stats` — แท็บอ้างอิง (สคริปต์ไม่ได้อ่าน)

ตาราง id → label → format ไว้เปิดดูว่ามี stat id อะไรให้ใช้บ้าง
เพิ่ม stat ใหม่ต้องไปเพิ่มใน `assets/js/stats.mjs` ด้วย

## 2. ใส่ข้อมูลตั้งต้น (ไม่ต้องพิมพ์เอง)

```bash
./render.sh && node tools/sheet-seed.mjs && python3 tools/sheet-xlsx.py
```

ได้ `google-apps-script/seed/equipment-sets.xlsx` (3 sets / 22 items) แปลงจากข้อมูลที่ฝังอยู่ในเว็บ

ลากลง Google Drive → คลิกขวา → Open with → **Google Sheets**
ช่อง % ตั้ง format มาให้แล้ว เปิดมาจะเห็น `8.53%` ไม่ใช่ `0.0853`

(import เข้าชีตเดิม: File → Import → Upload → **Insert new sheet(s)**)

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

ทดสอบโดยไม่แก้ไฟล์: `index.html?webApp=https://script.google.com/macros/s/....../exec`

โหลดไม่สำเร็จ → เว็บ fallback ไป JSON ที่ฝังไว้ แล้วขึ้น error บนหน้า

## 5. เช็ก / แก้ปัญหา

เปิด URL `/exec` ตรงๆ ควรเห็น `{"sets":[{"setKey":"boss",...}]}`

| อาการ | สาเหตุ |
|---|---|
| `{"error":"ไม่พบแท็บ: Items"}` | ชื่อแท็บไม่ตรง |
| `{"error":"... slot ต้องเป็น 1–12 ..."}` | `slot` ว่าง/เกินช่วง — ช่องว่างให้ลบทั้งแถว |
| stat % โชว์ `853.00%` | พิมพ์ `8.53` ในช่องที่ไม่ได้ format เป็น % — พิมพ์ `8.53%` แทน |
| ชื่อของขึ้นเป็น `staff` / `armor` | (slot, grade) นั้นยังไม่มีในตาราง `catalog.mjs` |
| การ์ดว่าง ทั้งที่ข้อมูลมี | เปิดด้วย `file://` — ES modules โดน CORS ต้อง serve ผ่าน HTTP (`./render.sh`) |
| แก้ชีตแล้วเว็บไม่เปลี่ยน | เว็บใส่ `?t=` กัน cache อยู่แล้ว ลอง hard refresh / ดู `/exec` ตรงๆ |
