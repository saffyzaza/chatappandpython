import type { ExecutableTool, ToolArgs, ToolResult } from "./types";

type FileMeta = { id: string; name: string; path: string };

const splitLine = (line: string) =>
  line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());

function ceToThai(y: number) { return y + 543; }
function thaiToCE(y: number) { return y - 543; }

function buildYearFilter(filter_years: string): ((row: string) => boolean) | null {
  if (!filter_years) return null;

  const allYears: string[] = [];

  const rangeMatch = filter_years.match(/^(\d{4})-(\d{4})$/);
  if (rangeMatch) {
    const from = parseInt(rangeMatch[1]);
    const to   = parseInt(rangeMatch[2]);
    for (let y = from; y <= to; y++) {
      allYears.push(String(y));
      const other = y > 2100 ? thaiToCE(y) : ceToThai(y);
      allYears.push(String(other));
    }
  } else {
    const list = filter_years.split(",").map((s) => s.trim()).filter(Boolean);
    for (const y of list) {
      allYears.push(y);
      const n = parseInt(y);
      if (!isNaN(n)) {
        const other = n > 2100 ? thaiToCE(n) : ceToThai(n);
        allYears.push(String(other));
      }
    }
  }

  const unique = [...new Set(allYears)];
  return unique.length > 0 ? (row) => unique.some((y) => row.includes(y)) : null;
}

// Province/keyword synonym expansion for row filtering
const KW_SYNONYMS: Record<string, string[]> = {
  มุกดาหาร: ["mukdahan"],
  อุบลราชธานี: ["ubon", "อุบล"],
  อุบล: ["อุบลราชธานี", "ubon"],
  ศรีสะเกษ: ["sisaket"],
  อำนาจเจริญ: ["amnat"],
  ยโสธร: ["yasothon"],
  นครพนม: ["nakhon_phanom", "nakhonphanom"],
  สกลนคร: ["sakon_nakhon"],
  ยโสธร: ["yasothon"],
  "ร้อยเอ็ด": ["roi_et", "roiet"],
  มุกดาหาร: ["mukdahan"],
  "อุบลราชธานี": ["ubon", "อุบล"],
  "ฆ่าตัวตาย": ["suicide", "suicid"],
  "พยายามฆ่าตัวตาย": ["attempt", "suicide_attempt"],
};

function buildKwMatcher(kw: string): (row: string) => boolean {
  if (!kw) return () => false; // empty → no keyword filter
  // Support comma-separated keywords: "ยโสธร,อุบลราชธานี"
  const keywords = kw.split(",").map((k) => k.trim()).filter(Boolean);
  const variants = keywords.flatMap((k) => [
    k.toLowerCase(),
    ...(KW_SYNONYMS[k] ?? []).map((s) => s.toLowerCase()),
    ...(KW_SYNONYMS[k.toLowerCase()] ?? []).map((s) => s.toLowerCase()),
  ]);
  return (row) => {
    const r = row.toLowerCase();
    return variants.some((v) => r.includes(v));
  };
}

// Smart filter: 4-level fallback with synonym expansion
function smartFilter(
  rows: string[],
  yearFilter: ((r: string) => boolean) | null,
  kwLower: string,
): { filtered: string[]; note: string } {
  const kwMatch = buildKwMatcher(kwLower);

  // 1. year + keyword (with synonyms)
  if (yearFilter && kwLower) {
    const r = rows.filter((row) => yearFilter(row) && kwMatch(row));
    if (r.length > 0) return { filtered: r, note: "filter: year + keyword" };
  }
  // 2. year only
  if (yearFilter) {
    const r = rows.filter(yearFilter);
    if (r.length > 0) return { filtered: r, note: "filter: year เท่านั้น" };
  }
  // 3. keyword only (with synonyms) — critical for merged multi-province files
  if (kwLower) {
    const r = rows.filter(kwMatch);
    if (r.length > 0) return { filtered: r, note: `filter: keyword "${kwLower}" เท่านั้น (ดึงแถวจังหวัดนั้น)` };
  }
  // 4. Year filter → sort: keyword-matching rows first (so target province appears early)
  if (yearFilter) {
    const yearRows = rows.filter(yearFilter);
    if (yearRows.length > 0) {
      const kwM = buildKwMatcher(kwLower);
      const priority = yearRows.filter(kwM);
      const rest = yearRows.filter((r) => !kwM(r));
      return {
        filtered: [...priority, ...rest],
        note: `filter: year เท่านั้น, เรียงแถว "${kwLower}" ขึ้นก่อน (${priority.length} แถว province)`,
      };
    }
  }
  // 5. Keyword → sort by keyword match
  if (kwLower) {
    const kwM = buildKwMatcher(kwLower);
    const priority = rows.filter(kwM);
    const rest = rows.filter((r) => !kwM(r));
    return {
      filtered: [...priority, ...rest],
      note: `filter: keyword "${kwLower}" (${priority.length} แถวตรง + ${rest.length} แถวอื่น)`,
    };
  }
  // 6. All rows fallback
  return {
    filtered: rows,
    note: "แสดงทุกแถว (ไม่พบ filter ในเนื้อหาแถว)",
  };
}

const multiCsvReader: ExecutableTool = {
  name: "multi_csv_reader",
  description:
    "อ่านหลายไฟล์ CSV พร้อมกัน (สำหรับข้อมูลหลายปีที่เก็บแยกไฟล์) รองรับ filter_years แบบ range",
  usage:
    '[TOOL_CALL: multi_csv_reader(file_ids="id1,id2,id3", filter_years="2565-2567", filter_keyword="อุบลราชธานี")]',

  async execute(args: ToolArgs, appUrl: string): Promise<ToolResult> {
    const { file_ids, filter_years, filter_keyword } = args;

    if (!file_ids) return { success: false, data: "ต้องระบุ file_ids (comma-separated จาก file_finder)" };

    const ids = file_ids.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return { success: false, data: "ไม่พบ file_ids ที่ถูกต้อง" };

    const yearFilter = buildYearFilter(filter_years ?? "");
    const kwLower = (filter_keyword ?? "").toLowerCase();

    const sections: string[] = [];
    let totalFilesRead = 0;
    let totalRowsFound = 0;

    for (const file_id of ids.slice(0, 10)) {
      // Metadata
      let meta: FileMeta | null = null;
      try {
        const r = await fetch(`${appUrl}/api/files/${file_id}?meta=1`);
        if (r.ok) meta = (await r.json()) as FileMeta;
      } catch { /* skip */ }

      // Content
      let text = "";
      try {
        const r = await fetch(`${appUrl}/api/files/${file_id}`);
        if (!r.ok) { sections.push(`❌ ID ${file_id}: อ่านไม่ได้`); continue; }
        text = await r.text();
      } catch { sections.push(`❌ ID ${file_id}: เกิดข้อผิดพลาด`); continue; }

      const allLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (allLines.length === 0) { sections.push(`⚠️ ID ${file_id}: ไฟล์ว่าง`); continue; }

      const headers = splitLine(allLines[0]);
      const dataLines = allLines.slice(1);

      // Smart filter with fallback
      const { filtered, note } = smartFilter(dataLines, yearFilter, kwLower);

      totalFilesRead++;
      totalRowsFound += filtered.length;

      const sourceName = meta?.name ?? `ID:${file_id}`;
      const fileUrl = `/api/files/${file_id}`;

      // Auto-aggregate: if CSV has province+year columns, sum numeric cols per (province,year)
      const provinceIdx = headers.findIndex((h) => /province|จังหวัด|province/i.test(h));
      const yearIdx     = headers.findIndex((h) => /^year$|^ปี$/i.test(h));
      const totalIdx    = headers.findIndex((h) => /^total$|^รวม$/i.test(h));

      let aggregatedSummary = "";
      if (provinceIdx >= 0 && yearIdx >= 0 && totalIdx >= 0 && filtered.length > 0) {
        const aggMap = new Map<string, number>();
        for (const row of filtered) {
          const cells = splitLine(row);
          const prov = cells[provinceIdx]?.trim() ?? "?";
          const yr   = cells[yearIdx]?.trim() ?? "?";
          const key  = `${prov}|${yr}`;
          const val  = parseFloat(cells[totalIdx] ?? "0") || 0;
          aggMap.set(key, (aggMap.get(key) ?? 0) + val);
        }
        const aggLines = ["จังหวัด,ปี,รวมทั้งหมด (total)"];
        for (const [key, sum] of aggMap) {
          const [prov, yr] = key.split("|");
          aggLines.push(`${prov},${yr},${sum}`);
        }
        aggregatedSummary =
          `\n   📊 สรุปรวมต่อจังหวัด-ปี (AUTO-AGGREGATE จาก ${filtered.length} แถว):\n` +
          aggLines.map((l) => `   ${l}`).join("\n");
      }

      // Show first column unique values to help LLM understand province/data format
      const firstColValues = [...new Set(dataLines.map((l) => splitLine(l)[0]))].slice(0, 15);

      sections.push(
        `📄 ชื่อไฟล์: ${sourceName}\n` +
        `🔗 MARKDOWN_LINK (คัดลอกตรงนี้ลงในแหล่งที่มา): [${sourceName}](${fileUrl})\n` +
        `   คอลัมน์ (${headers.length}): ${headers.join(" | ")}\n` +
        `   ค่าในคอลัมน์แรก: ${firstColValues.join(", ")}\n` +
        `   ${note} → ${filtered.length} แถว (จาก ${dataLines.length} ทั้งหมด)` +
        aggregatedSummary + "\n" +
        `   ข้อมูลดิบ:\n` +
        `   ${headers.join(",")}\n` +
        filtered.slice(0, 100).map((r) => `   ${r}`).join("\n"),
      );
    }

    const lines = [
      `📊 สรุป: อ่าน ${totalFilesRead}/${ids.length} ไฟล์ พบข้อมูล ${totalRowsFound} แถวรวม`,
      `⚠️ ใช้ตัวเลขจาก SOURCE FILE ข้างต้นเท่านั้น ห้ามแต่งข้อมูล`,
      "",
      ...sections,
    ];

    return { success: totalFilesRead > 0, data: lines.join("\n") };
  },
};

export default multiCsvReader;
