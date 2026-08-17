/**
 * build-index.mjs
 * ไล่ดึงชื่อ + ไอคอนของ items / minis / skins ทั้งหมดจาก GW2 API
 * แล้วเก็บเป็นดัชนีไว้ที่ data/gw2-index.json
 *
 * รันสัปดาห์ละครั้งก็พอ ข้อมูลชุดนี้แทบไม่เปลี่ยนนอกจากมีของใหม่เข้าเกม
 * ไม่ต้องใช้ API key
 */
import { writeFile, mkdir } from "node:fs/promises";

const API = "https://api.guildwars2.com/v2";
const SOURCES = ["items", "minis", "skins"];
const BATCH = 200;        // จำนวน id ต่อ 1 request (เพดานของ API)
const GAP_MS = 150;       // เว้นจังหวะกันโดน rate limit (เพดานราว 600 req/นาที)

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** ตัดให้เหลือแค่ signature/fileId เพื่อลดขนาดไฟล์ ประกอบกลับเป็น URL ตอนใช้ */
function compactIcon(url) {
  const m = /\/file\/([^/]+)\/(\d+)\.(?:png|jpg)$/.exec(url || "");
  return m ? `${m[1]}/${m[2]}` : null;
}

/** ชื่อที่ใช้เทียบ: ตัดช่องว่างหัวท้าย ยุบช่องว่างซ้ำ ทำเป็นตัวเล็ก และแปลงอัญประกาศโค้ง */
export function normalize(name) {
  return String(name || "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function getJSON(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "yiren-masterworks-index" } });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 5) throw err;
    const wait = 1000 * 2 ** attempt;
    console.warn(`  retry ${attempt} in ${wait}ms — ${url.slice(0, 80)} (${err.message})`);
    await sleep(wait);
    return getJSON(url, attempt + 1);
  }
}

async function collect(source) {
  console.log(`\n${source}: ขอรายการ id ทั้งหมด`);
  const ids = await getJSON(`${API}/${source}`);
  console.log(`${source}: ${ids.length} รายการ, ${Math.ceil(ids.length / BATCH)} รอบ`);

  const rows = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const data = await getJSON(`${API}/${source}?lang=en&ids=${chunk.join(",")}`);
    rows.push(...data);
    if ((i / BATCH) % 25 === 0) {
      process.stdout.write(`  ${Math.min(i + BATCH, ids.length)}/${ids.length}\n`);
    }
    await sleep(GAP_MS);
  }
  return rows;
}

const byName = {};   // "mini vale guardian" -> "SIGNATURE/65015"
const byId = {};     // "items:28445"        -> "SIGNATURE/65015"
const collisions = new Set();

for (const source of SOURCES) {
  const rows = await collect(source);
  let kept = 0;
  for (const row of rows) {
    const icon = compactIcon(row.icon);
    if (!icon) continue;
    kept++;
    byId[`${source}:${row.id}`] = icon;

    const key = normalize(row.name);
    if (!key) continue;
    if (byName[key] && byName[key] !== icon) collisions.add(key);
    // ชื่อซ้ำ: เก็บตัวแรกที่เจอไว้ ถ้าอยากได้ตัวเป๊ะ ๆ ให้ใช้ chat link แทน
    if (!byName[key]) byName[key] = icon;
  }
  console.log(`${source}: เก็บได้ ${kept} ไอคอน`);
}

await mkdir("data", { recursive: true });
await writeFile(
  "data/gw2-index.json",
  JSON.stringify({ built: new Date().toISOString().slice(0, 10), byName, byId })
);

console.log(`\nเสร็จ — ชื่อไม่ซ้ำ ${Object.keys(byName).length} รายการ, id ${Object.keys(byId).length} รายการ`);
console.log(`ชื่อที่ชนกัน ${collisions.size} รายการ (ใช้ chat link ถ้าเจอปัญหา)`);
