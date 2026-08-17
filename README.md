# Yiren Masterworks

หน้าร้านลิสต์ไอเทม SpiritVale — static ล้วน โฮสต์บน GitHub Pages ฟรี
สินค้าแก้ที่ Notion ที่เดียว ทั้งราคา สต็อก และรูป

```
index.html                    หน้าร้าน (ไฟล์เดียวจบ ไม่มี build step)
items.json                    สต็อกปัจจุบัน — Action เขียนให้ ห้ามแก้มือ
icons/                        รูปไอเทมที่ mirror มาจาก Notion — Action จัดการเอง
data/icon-manifest.json       บันทึกว่ารูปไหนโหลดมาแล้ว ใช้กันโหลดซ้ำ
scripts/sync-notion.mjs       Notion -> items.json + icons/
.github/workflows/            ตัวตั้งเวลา
```

---

## ติดตั้งครั้งเดียว

### 1. สร้าง database ใน Notion

หน้าใหม่ → `/database` → ตั้งคอลัมน์ตามนี้ **ชื่อคอลัมน์ต้องตรงเป๊ะ** เพราะสคริปต์อ้างชื่อตรง ๆ

| คอลัมน์ | ชนิด | ใส่อะไร |
|---|---|---|
| `Item` | Title | ชื่อไอเทม |
| `Category` | Select | Equipment / Cards / Artifacts / Grimoires / Consumables / Materials / Cosmetics |
| `Price` | Text | ใส่แบบที่อยากให้แสดงเลย เช่น `1,450,000g` |
| `Stock` | Number | `0` = ขายแล้ว, `99` = รับตามสั่งไม่จำกัด |
| `Tags` | Multi-select | ป้ายสั้น ๆ เช่น weapon, armor, card, boss drop, knight |
| `Note` | Text | ข้อความสั้นต่อท้าย เช่น `Clean substats` |
| `Icon` | Files & media | แปะรูปไอเทม 1 รูป (ครั้งเดียวพอ) |
| `Listed` | Checkbox | ติ๊กเมื่อพร้อมขึ้นเว็บ ที่ไม่ติ๊กจะถูกข้าม |

ตัวเลือกใน `Category` ต้องสะกดตรงกับตัวแปร `ORDER` ใน `index.html`
อยากเพิ่ม/เปลี่ยนหมวด ต้องแก้ทั้งสองที่ให้ตรงกัน ไม่งั้นหมวดนั้นจะไม่ขึ้นบนเว็บ

### 2. ต่อ Notion เข้ากับ integration

1. notion.so/my-integrations → **New integration** → เลือก workspace → Submit
2. ก๊อป **Internal Integration Secret** (ขึ้นต้นด้วย `ntn_`)
3. กลับไปที่ database → เมนู `···` มุมขวาบน → **Connections** → เลือก integration ที่เพิ่งสร้าง
   **ข้ามข้อนี้ไม่ได้** ถ้าไม่กด API จะมองไม่เห็น database แล้วขึ้น error 404 ทั้งที่ token ถูก
4. ก๊อป database id จาก URL: `notion.so/<workspace>/`**`32ตัวอักษรนี้`**`?v=...`

### 3. ตั้ง repo

1. **Settings → Secrets and variables → Actions → New repository secret** เพิ่ม 2 ตัว
   - `NOTION_TOKEN` = secret จากข้อ 2.2
   - `NOTION_DATABASE_ID` = id จากข้อ 2.4
2. **Settings → Actions → General → Workflow permissions** → **Read and write permissions** → Save
3. **Settings → Pages → Source: Deploy from a branch → main / (root)** → Save

### 4. รันครั้งแรก

แท็บ **Actions** → `Sync stock from Notion` → **Run workflow**
เว็บจะขึ้นที่ `https://<ชื่อบัญชี>.github.io/<ชื่อ repo>/`

---

## ใช้งานประจำวัน

แก้ราคา สต็อก เพิ่มไอเทม หรือแปะรูปใน Notion แล้วรอไม่เกิน 30 นาที
อยากให้ขึ้นเดี๋ยวนั้น → Actions → `Sync stock from Notion` → Run workflow

**เรื่องรูป** แปะครั้งเดียวพอ ระบบจะโหลดมาเก็บไว้ใน `icons/` ของ repo เอง
(ลิงก์ไฟล์ที่ Notion คืนมาหมดอายุราว 1 ชั่วโมง เอาไปแปะบนเว็บตรง ๆ ไม่ได้)
เปลี่ยนรูปใหม่ทับใน Notion รอบถัดไปมันจะโหลดตัวใหม่มาแทนให้เอง
ลบไอเทมออกจาก Notion รูปในเว็บก็ถูกเก็บกวาดตาม
ไอเทมที่ยังไม่มีรูปจะขึ้นเป็นกรอบตัวอักษรแรกของชื่อ ไม่มีรูปแตกให้เห็น

**เช็คปัญหา** เปิด log ของ Action ล่าสุด ท้าย log จะบอกว่าตัวไหนยังไม่มีรูป
และตัวไหนยังไม่ได้เลือก Category (พวกที่ไม่ได้เลือกจะไม่ขึ้นบนเว็บ)

---

## ข้อควรรู้

- **GitHub พัก workflow ที่ตั้งเวลาไว้ ถ้า repo ไม่มีความเคลื่อนไหวเกิน 60 วัน** ปกติไม่เกิด
  เพราะตัว sync commit ไฟล์เองอยู่แล้ว แต่ถ้าหยุดขายยาว ๆ แล้วกลับมา ให้กด Run workflow เองสักครั้ง
- รูปที่แปะจะกลายเป็นไฟล์สาธารณะใน repo ใครก็เปิดดูได้ ใช้รูปที่แชร์ได้เท่านั้น
- ถ้าเป็นภาพจากในเกม ควรใส่หมายเหตุว่าไม่ได้สังกัดผู้พัฒนา (มีอยู่ท้ายหน้าแล้ว)
  และเช็คเงื่อนไขการใช้ภาพของ Baikun Interactive ถ้าจะทำเป็นเรื่องเป็นราว
- ทุกอย่างฟรี ไม่ต้องผูกบัตร: GitHub Pages, GitHub Actions (repo สาธารณะไม่จำกัดนาที) และ Notion API
