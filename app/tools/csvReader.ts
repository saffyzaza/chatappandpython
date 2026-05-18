import type { ExecutableTool, ToolArgs, ToolResult } from "./types";

type FileMeta = { id: string; name: string; path: string };

const splitLine = (line: string) =>
  line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());

const csvReader: ExecutableTool = {
  name: "csv_reader",
  description:
    "อ่านไฟล์ CSV จาก MinIO โดยใช้ file_id สแกน columns ก่อน แล้ว filter ข้อมูลตาม year และ keyword",
  usage:
    '[TOOL_CALL: csv_reader(file_id="ใส่ ID จาก file_finder", filter_year="2565", filter_keyword="อุบลราชธานี")]',

  async execute(args: ToolArgs, appUrl: string): Promise<ToolResult> {
    const { file_id, filter_year, filter_keyword } = args;

    if (!file_id) return { success: false, data: "ต้องระบุ file_id (ได้จาก file_finder)" };

    // ① Fetch file metadata to show the real source
    let fileMeta: FileMeta | null = null;
    try {
      const metaRes = await fetch(`${appUrl}/api/files/${file_id}?meta=1`);
      if (metaRes.ok) {
        fileMeta = (await metaRes.json()) as FileMeta;
      }
    } catch { /* skip, metadata is best-effort */ }

    // ② Fetch CSV content
    let text = "";
    try {
      const res = await fetch(`${appUrl}/api/files/${file_id}`);
      if (!res.ok) return { success: false, data: `ไม่สามารถอ่านไฟล์ ID: ${file_id}` };
      text = await res.text();
    } catch {
      return { success: false, data: `เกิดข้อผิดพลาดขณะอ่านไฟล์ ${file_id}` };
    }

    const allLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (allLines.length === 0) return { success: false, data: "ไฟล์ว่างเปล่า" };

    // ③ Scan columns
    const headers = splitLine(allLines[0]);
    const dataLines = allLines.slice(1);
    const totalRows = dataLines.length;

    // ④ Filter rows
    let filtered = dataLines;
    if (filter_year) filtered = filtered.filter((row) => row.includes(filter_year));
    if (filter_keyword) {
      const kw = filter_keyword.toLowerCase();
      filtered = filtered.filter((row) => row.toLowerCase().includes(kw));
    }

    const preview = filtered.slice(0, 50);

    // ⑤ Source header — shown to LLM and user so data can be verified
    const fileUrl = `/api/files/${file_id}`;
    const displayName = fileMeta?.name ?? `file-${file_id}`;
    const sourceLine =
      `📄 ชื่อไฟล์: ${displayName}\n` +
      `🔗 MARKDOWN_LINK (คัดลอกตรงนี้ลงในแหล่งที่มา): [${displayName}](${fileUrl})`;

    const filterNote =
      filtered.length === 0
        ? `⚠️ ไม่พบข้อมูลที่ตรงกับ filter_year="${filter_year}" filter_keyword="${filter_keyword}"\nข้อมูลในไฟล์นี้ (3 แถวแรก):\n${dataLines.slice(0, 3).join("\n")}`
        : `📊 ทั้งหมด ${totalRows} แถว → กรองแล้ว ${filtered.length} แถว (แสดง ${preview.length}):`;

    const lines = [
      sourceLine,
      `📋 คอลัมน์ (${headers.length} คอลัมน์): ${headers.join(" | ")}`,
      filterNote,
    ];

    if (filtered.length > 0) {
      lines.push("", headers.join(","), ...preview);
      lines.push("", `⚠️ ข้อมูลข้างต้นมาจากไฟล์ "${fileMeta?.name ?? file_id}" เท่านั้น ใช้ตัวเลขจากนี้เท่านั้น ห้ามคาดเดาหรือแต่งเพิ่ม`);
    }

    return { success: filtered.length > 0, data: lines.join("\n") };
  },
};

export default csvReader;
