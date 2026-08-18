/**
 * sync-notion.mjs
 * อ่าน database ของ Notion -> เขียน items.json + ดึงรูปไอเทมมาเก็บไว้ใน icons/
 *
 * ทำไมต้องโหลดรูปมาเก็บเอง: ลิงก์ไฟล์ที่ Notion คืนมาเป็น URL แบบมีลายเซ็น หมดอายุราว 1 ชั่วโมง
 * ถ้าเอาไปแปะบนเว็บตรง ๆ พรุ่งนี้รูปแตกหมด จึงต้อง mirror ลง repo ให้เป็นของเราเอง
 *
 * ต้องมี env:
 *   NOTION_TOKEN        โทเคนของ internal integration
 *   NOTION_DATABASE_ID  id ของ database (32 ตัวอักษรใน URL)
 */
import { readFile, writeFile, mkdir, readdir, unlink, access } from "node:fs/promises";
import path from "node:path";

const TOKEN = process.env.NOTION_TOKEN;
const DB = (process.env.NOTION_DATABASE_ID || "").replace(/-/g, "");
if (!TOKEN || !DB) {
  console.error("ขาด NOTION_TOKEN หรือ NOTION_DATABASE_ID");
  process.exit(1);
}

const ICON_DIR = "icons";
const MANIFEST = "data/icon-manifest.json";
const MAX_ICON_BYTES = 3 * 1024 * 1024;

const exists = p => access(p).then(() => true, () => false);

/* ---------- Notion ---------- */

async function fetchRows() {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${DB}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
    const data = await res.json();
    rows.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}

/* อ่านค่าออกมาเป็นข้อความ ไม่ว่าคอลัมน์จะถูกตั้งเป็นชนิดไหนก็ตาม */
const text = p => {
  if (!p) return "";
  if (typeof p.number === "number") return String(p.number);
  if (p.select?.name) return p.select.name;
  if (p.formula) return String(p.formula.string ?? p.formula.number ?? "").trim();
  if (p.rollup?.number != null) return String(p.rollup.number);
  return (p.title || p.rich_text || []).map(t => t.plain_text).join("").trim();
};

function firstFile(prop) {
  const f = (prop?.files || [])[0];
  if (!f) return null;
  return { url: f.file?.url || f.external?.url || null, name: f.name || "" };
}

function toRow(page) {
  const p = page.properties;
  return {
    id: page.id.replace(/-/g, ""),
    edited: page.last_edited_time,
    item: text(p["Item"]),
    category: p["Category"]?.select?.name || "",
    price: text(p["Price"]) || "—",
    stock: typeof p["Stock"]?.number === "number" ? p["Stock"].number : null,
    tags: (p["Tags"]?.multi_select || []).map(t => t.name),
    note: text(p["Note"]),
    seller: p["Seller"]?.select?.name || text(p["Seller"]),
    discord: text(p["Discord"]),
    file: firstFile(p["Icon"]),
    listed: p["Listed"]?.checkbox !== false, // ไม่มีคอลัมน์นี้ = ถือว่าขึ้นเว็บ
  };
}

/* ---------- รูป ---------- */

function extFor(file, contentType) {
  const fromName = path.extname(file.name || "").toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"].includes(fromName)) return fromName;
  const map = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif" };
  return map[(contentType || "").split(";")[0].trim()] || ".png";
}

async function syncIcon(row, manifest) {
  if (!row.file?.url) return null;

  const known = manifest[row.id];
  // แก้อย่างอื่นในแถวก็ทำให้ last_edited_time ขยับ แต่โหลดรูปซ้ำไม่กี่ KB ถือว่าคุ้มกว่าเสี่ยงรูปไม่อัปเดต
  if (known && known.edited === row.edited && await exists(path.join(ICON_DIR, known.file))) {
    return known.file;
  }

  const res = await fetch(row.file.url);
  if (!res.ok) {
    console.warn(`  โหลดรูปไม่สำเร็จ (${res.status}) — ${row.item}`);
    return known?.file ?? null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_ICON_BYTES) {
    console.warn(`  รูปใหญ่เกิน ${(buf.length / 1e6).toFixed(1)}MB ข้ามไว้ก่อน — ${row.item}`);
    return known?.file ?? null;
  }

  const name = row.id + extFor(row.file, res.headers.get("content-type"));
  // ถ้านามสกุลเปลี่ยน ลบไฟล์เดิมทิ้งกันขยะค้าง
  if (known?.file && known.file !== name) await unlink(path.join(ICON_DIR, known.file)).catch(() => {});
  await writeFile(path.join(ICON_DIR, name), buf);
  manifest[row.id] = { file: name, edited: row.edited };
  console.log(`  อัปเดตรูป — ${row.item}`);
  return name;
}

/* ---------- ประกอบไฟล์ ---------- */

await mkdir(ICON_DIR, { recursive: true });
await mkdir("data", { recursive: true });

const manifest = await readFile(MANIFEST, "utf8").then(JSON.parse).catch(() => ({}));
const all = (await fetchRows()).map(toRow);
const rows = all.filter(r => r.listed && r.item);

const skippedUnlisted = all.filter(r => r.item && !r.listed).map(r => r.item);
const skippedNoName = all.filter(r => !r.item).length;
if (skippedUnlisted.length) console.log(`ข้ามเพราะยังไม่ติ๊ก Listed ${skippedUnlisted.length} รายการ: ${skippedUnlisted.join(", ")}`);
if (skippedNoName) console.log(`ข้ามเพราะยังไม่ได้ตั้งชื่อ ${skippedNoName} แถว`);

/* Discord พิมพ์ครั้งเดียวต่อคนพอ แถวอื่นของคนเดียวกันเติมให้เอง */
const discordBySeller = new Map();
for (const r of rows) {
  if (r.seller && r.discord && !discordBySeller.has(r.seller)) discordBySeller.set(r.seller, r.discord);
}

const items = [];
const noIcon = [];
const noCategory = [];
const noDiscord = new Set();

for (const row of rows) {
  const icon = await syncIcon(row, manifest);
  if (!icon) noIcon.push(row.item);
  if (!row.category) noCategory.push(row.item);

  const discord = row.discord || discordBySeller.get(row.seller) || "";
  if (row.seller && !discord) noDiscord.add(row.seller);

  items.push({
    category: row.category,
    item: row.item,
    tags: row.tags,
    price: row.price,
    ...(row.stock === null ? {} : { stock: row.stock }),
    ...(row.seller ? { seller: row.seller } : {}),
    ...(discord ? { discord } : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(icon ? { icon: `${ICON_DIR}/${icon}` } : {}),
  });
}

// เก็บกวาดรูปของแถวที่ถูกลบหรือเอาออกจากเว็บแล้ว
for (const id of Object.keys(manifest)) {
  if (!rows.some(r => r.id === id)) {
    await unlink(path.join(ICON_DIR, manifest[id].file)).catch(() => {});
    delete manifest[id];
  }
}
const live = new Set(Object.values(manifest).map(m => m.file));
for (const f of await readdir(ICON_DIR).catch(() => [])) {
  if (f !== ".gitkeep" && !live.has(f)) await unlink(path.join(ICON_DIR, f)).catch(() => {});
}

// ของที่มีสต็อกขึ้นก่อน แล้วเรียงตามชื่อ
items.sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.item.localeCompare(b.item));

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
const stamp = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short",
}).format(new Date());   // ได้รูปแบบ 2026-08-19 00:41 ตามเวลาไทย

await writeFile(
  "items.json",
  JSON.stringify({ updated: stamp, items }, null, 2)
);

console.log(`\nเขียน items.json แล้ว: ${items.length} รายการ`);
if (noCategory.length) console.log(`ยังไม่ได้เลือก Category ${noCategory.length} รายการ (จะไม่ขึ้นบนเว็บ): ${noCategory.join(", ")}`);
if (noDiscord.size) console.log(`ยังไม่มี Discord: ${[...noDiscord].join(", ")} (เว็บจะขึ้นชื่อคนขายแต่กดก๊อปไม่ได้)`);
if (noIcon.length) console.log(`ยังไม่มีรูป ${noIcon.length} รายการ (ขึ้นกรอบตัวอักษรแทน): ${noIcon.join(", ")}`);
