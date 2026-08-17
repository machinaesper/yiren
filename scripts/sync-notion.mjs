/**
 * sync-notion.mjs
 * อ่าน database ของ Notion -> เทียบชื่อกับดัชนี GW2 -> เขียน items.json ให้หน้าเว็บ
 *
 * ต้องมี env:
 *   NOTION_TOKEN        โทเคนของ internal integration
 *   NOTION_DATABASE_ID  id ของ database (32 ตัวอักษรใน URL)
 */
import { readFile, writeFile } from "node:fs/promises";

const TOKEN = process.env.NOTION_TOKEN;
const DB = (process.env.NOTION_DATABASE_ID || "").replace(/-/g, "");
if (!TOKEN || !DB) {
  console.error("ขาด NOTION_TOKEN หรือ NOTION_DATABASE_ID");
  process.exit(1);
}

const RENDER = "https://render.guildwars2.com/file/";

function normalize(name) {
  return String(name || "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * ถอด chat link ของไอเทม เช่น "[&AgEdbwAA]" -> 28445
 * รูปแบบ: byte0 = ชนิด (2 = item, 10 = skin), byte1 = จำนวน, byte2-4 = id แบบ little endian
 */
export function decodeChatLink(text) {
  const m = /\[?&?([A-Za-z0-9+/=]{6,})\]?/.exec(String(text || "").trim());
  if (!m) return null;
  let buf;
  try { buf = Buffer.from(m[1], "base64"); } catch { return null; }
  if (buf.length < 5) return null;
  const kind = buf[0] === 2 ? "items" : buf[0] === 10 ? "skins" : null;
  if (!kind) return null;
  return { kind, id: buf[2] | (buf[3] << 8) | (buf[4] << 16) };
}

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

const text = p => (p?.title || p?.rich_text || []).map(t => t.plain_text).join("").trim();

function toItem(page) {
  const p = page.properties;
  return {
    item: text(p["Item"]),
    encounter: p["Encounter"]?.select?.name || "",
    price: text(p["Price"]) || "—",
    stock: typeof p["Stock"]?.number === "number" ? p["Stock"].number : 0,
    tags: (p["Tags"]?.multi_select || []).map(t => t.name),
    note: text(p["Note"]),
    chatLink: text(p["Chat link"]),
    listed: p["Listed"]?.checkbox !== false, // ไม่มีคอลัมน์นี้ = ถือว่าขึ้นเว็บ
  };
}

/* ---------- ประกอบไฟล์ ---------- */

const index = JSON.parse(await readFile("data/gw2-index.json", "utf8"));
const rows = (await fetchRows()).map(toItem).filter(r => r.listed && r.item);

const missing = [];
const items = rows.map(r => {
  let icon = null;

  const chat = decodeChatLink(r.chatLink);
  if (chat) icon = index.byId[`${chat.kind}:${chat.id}`] || null;
  if (!icon) icon = index.byName[normalize(r.item)] || null;
  if (!icon) missing.push(r.item);

  return {
    encounter: r.encounter,
    item: r.item,
    tags: r.tags,
    price: r.price,
    stock: r.stock,
    ...(r.note ? { note: r.note } : {}),
    ...(icon ? { icon: RENDER + icon + ".png" } : {}),
  };
});

// ของที่มีสต็อกขึ้นก่อน แล้วเรียงตามชื่อ
items.sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.item.localeCompare(b.item));

await writeFile(
  "items.json",
  JSON.stringify({ updated: new Date().toISOString().slice(0, 10), items }, null, 2)
);

console.log(`เขียน items.json แล้ว: ${items.length} รายการ`);
if (missing.length) {
  console.log(`\nหาไอคอนไม่เจอ ${missing.length} รายการ — เช็คตัวสะกดใน Notion หรือใส่ chat link:`);
  for (const name of missing) console.log(`  • ${name}`);
}
