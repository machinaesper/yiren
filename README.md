# Yiren Masterworks

หน้าร้านลิสต์ไอเทม Spirit Vale (Guild Wars 2) — static ล้วน โฮสต์บน GitHub Pages ฟรี
ข้อมูลสินค้าแก้ที่ Notion ที่เดียว ไอคอนไอเทมดึงจาก GW2 API ให้อัตโนมัติ

```
index.html              หน้าร้าน (ไฟล์เดียวจบ ไม่มี build step)
items.json              สต็อกปัจจุบัน — GitHub Actions เขียนให้ ห้ามแก้มือ
data/gw2-index.json     ดัชนีชื่อไอเทม -> ไอคอน สร้างจาก GW2 API
scripts/build-index.mjs สร้างดัชนี รันสัปดาห์ละครั้ง
scripts/sync-notion.mjs Notion -> items.json รันทุก 30 นาที
```

---

## ติดตั้งครั้งเดียว

### 1. สร้าง database ใน Notion

หน้าใหม่ → `/database` → ตั้งคอลัมน์ตามนี้ (ชื่อคอลัมน์ต้องตรงเป๊ะ สคริปต์อ้างชื่อตรง ๆ)

| คอลัมน์ | ชนิด | ใส่อะไร |
|---|---|---|
| `Item` | Title | ชื่อไอเทมภาษาอังกฤษ ตรงตามในเกม — ใช้หาไอคอน |
| `Encounter` | Select | Vale Guardian / Spirit Woods / Gorseval the Multifarious / Sabetha the Saboteur |
| `Price` | Text | ใส่แบบที่อยากให้แสดงเลย เช่น `1,450g` |
| `Stock` | Number | `0` = ขายแล้ว, `99` = รับตามสั่งไม่จำกัด |
| `Tags` | Multi-select | mini, skin, weapon, infusion, cosmetic, gear, bundle, currency, service |
| `Note` | Text | ข้อความสั้นต่อท้าย เช่น `Green tint` |
| `Chat link` | Text | ทางเลือก — shift+click ไอเทมในเกมแล้ววาง |
| `Listed` | Checkbox | ติ๊กเมื่อพร้อมขึ้นเว็บ ที่ไม่ติ๊กจะถูกข้าม |

ตัวอักษรใน `Encounter` ต้องตรงกับค่าในตัวแปร `ORDER` ที่ `index.html` ไม่งั้นกลุ่มนั้นจะไม่ขึ้น

### 2. ต่อ Notion เข้ากับ integration

1. ไปที่ notion.so/my-integrations → **New integration** → เลือก workspace → Submit
2. ก๊อป **Internal Integration Secret** (ขึ้นต้นด้วย `ntn_`) เก็บไว้
3. กลับไปที่ database → เมนู `···` มุมขวาบน → **Connections** → เลือก integration ที่เพิ่งสร้าง
   ถ้าข้ามข้อนี้ API จะมองไม่เห็น database เลย
4. ก๊อป database id จาก URL: `notion.so/<workspace>/**32ตัวอักษรนี้**?v=...`

### 3. ตั้ง repo

1. สร้าง repo ใหม่ อัปไฟล์ทั้งหมดขึ้นไป
2. **Settings → Secrets and variables → Actions → New repository secret** เพิ่ม 2 ตัว
   - `NOTION_TOKEN` = secret จากข้อ 2.2
   - `NOTION_DATABASE_ID` = id จากข้อ 2.4
3. **Settings → Actions → General → Workflow permissions** → เลือก **Read and write permissions**
   (ไม่งั้น Action จะ push ไฟล์กลับเข้า repo ไม่ได้)
4. **Settings → Pages → Source: Deploy from a branch → main / (root)** → Save

### 4. รันครั้งแรก

แท็บ **Actions** → `Build GW2 icon index` → **Run workflow** — รอ 5-10 นาที
เสร็จแล้วค่อยรัน `Sync stock from Notion` ตามลำดับนี้เท่านั้น เพราะตัว sync ต้องใช้ดัชนีที่ตัวแรกสร้าง

เว็บจะขึ้นที่ `https://<ชื่อบัญชี>.github.io/<ชื่อ repo>/`

---

## ใช้งานประจำวัน

แก้ราคา สต็อก หรือเพิ่มไอเทมใน Notion แล้วรอไม่เกิน 30 นาที
อยากให้ขึ้นเดี๋ยวนั้น → Actions → `Sync stock from Notion` → Run workflow

**ไอคอนไม่ขึ้น?** เปิด log ของ Action ล่าสุด ท้าย log จะลิสต์ชื่อที่หาไอคอนไม่เจอไว้ให้
ส่วนใหญ่เป็นตัวสะกดหรือช่องว่างเกิน ถ้าชื่อถูกแล้วแต่ยังไม่เจอ (เช่นเป็นชื่อที่มีของหลายชิ้นซ้ำกัน)
ให้ shift+click ไอเทมในเกม แล้ววาง chat link ลงคอลัมน์ `Chat link` — แม่นยำ 100%

---

## ข้อควรรู้

- **GitHub พัก workflow ที่ตั้งเวลาไว้ ถ้า repo ไม่มีความเคลื่อนไหวเกิน 60 วัน** ปกติไม่เกิดเพราะ
  ตัว sync commit ไฟล์เองอยู่แล้ว แต่ถ้าหยุดขายยาว ๆ แล้วกลับมา ให้กด Run workflow เองสักครั้ง
- `data/gw2-index.json` ขนาดราว 4-6 MB และถูกเสิร์ฟออกเว็บด้วย ไม่เป็นปัญหาเพราะเบราว์เซอร์
  ไม่ได้โหลดไฟล์นี้ (หน้าเว็บอ่านแค่ `items.json`) และเนื้อในเป็นข้อมูลสาธารณะจาก API อยู่แล้ว
- ไอคอนถูกลิงก์ตรงจาก `render.guildwars2.com` ซึ่งเป็น render service สาธารณะของ ArenaNet
  ไม่ได้ก๊อปไฟล์มาเก็บเอง ถ้าจะทำร้านเป็นเรื่องเป็นราวควรอ่าน Content Terms ของ ArenaNet
  เรื่องการใช้ทรัพย์สินในเกมประกอบ และใส่หมายเหตุว่าไม่ได้สังกัด ArenaNet (มีอยู่ท้ายหน้าแล้ว)
- ทุกอย่างในนี้ฟรีหมด ไม่ต้องผูกบัตร: GitHub Pages, GitHub Actions (repo สาธารณะไม่จำกัดนาที),
  Notion API และ GW2 API
