import type { ExecutableTool, ToolArgs, ToolResult } from "./types";

type FileMeta = { id: string; name: string; path: string };

const aiCsvAnalyzer: ExecutableTool = {
  name: "ai_csv_analyzer",
  description:
    "ส่งไฟล์ CSV ทั้งไฟล์ให้ AI วิเคราะห์โดยตรง ไม่จำกัดแถว เหมาะสำหรับไฟล์ merged หลายจังหวัด/หลายปี",
  usage:
    '[TOOL_CALL: ai_csv_analyzer(file_id="ID จาก file_finder", question="หาข้อมูลจังหวัดยโสธร ปี 2024 จำนวนรวมทั้งหมด")]',

  async execute(args: ToolArgs, appUrl: string, callAI): Promise<ToolResult> {
    const { file_id, question } = args;

    if (!file_id) return { success: false, data: "ต้องระบุ file_id (ได้จาก file_finder)" };
    if (!question) return { success: false, data: "ต้องระบุ question ว่าต้องการวิเคราะห์อะไร" };
    if (!callAI)   return { success: false, data: "ไม่มี AI helper — ใช้ multi_csv_reader แทน" };

    // ① Fetch metadata
    let meta: FileMeta | null = null;
    try {
      const r = await fetch(`${appUrl}/api/files/${file_id}?meta=1`);
      if (r.ok) meta = (await r.json()) as FileMeta;
    } catch { /* skip */ }

    // ② Fetch full CSV content from MinIO
    let csvText = "";
    try {
      const r = await fetch(`${appUrl}/api/files/${file_id}`);
      if (!r.ok) return { success: false, data: `ไม่สามารถอ่านไฟล์ ID: ${file_id}` };
      csvText = await r.text();
    } catch {
      return { success: false, data: `เกิดข้อผิดพลาดขณะอ่านไฟล์ ${file_id}` };
    }

    if (!csvText.trim()) return { success: false, data: "ไฟล์ว่างเปล่า" };

    const fileName  = meta?.name ?? `file-${file_id}`;
    const fileUrl   = `/api/files/${file_id}`;
    const totalRows = csvText.split(/\r?\n/).filter((l) => l.trim()).length - 1;

    // ③ Send ENTIRE CSV to AI — no row limit
    const aiAnswer = await callAI(
      [
        "คุณเป็น AI วิเคราะห์ข้อมูล CSV",
        "ตอบด้วยตัวเลขจริงจากไฟล์เท่านั้น ห้ามประดิษฐ์หรือคาดเดา",
        "ถ้าไม่พบข้อมูลที่ถามให้บอกตรงๆ",
        "ถ้ามีหลายแถวที่เกี่ยวข้อง ให้ SUM รวมด้วย",
      ].join("\n"),
      [
        `ไฟล์: ${fileName} (${totalRows} แถว)`,
        "",
        "ข้อมูลทั้งหมดในไฟล์:",
        csvText,
        "",
        `คำถาม: ${question}`,
        "",
        "ตอบในรูปแบบ Markdown ที่อ่านง่าย ระบุตัวเลขรวมรายจังหวัด/รายปี ถ้ามีหลายแถวให้ sum ก่อน",
      ].join("\n"),
    );

    return {
      success: true,
      data: [
        `📄 ชื่อไฟล์: ${fileName} (${totalRows} แถว, ส่งทั้งไฟล์ให้ AI)`,
        `🔗 MARKDOWN_LINK (คัดลอกลงแหล่งที่มา): [${fileName}](${fileUrl})`,
        "",
        "📊 ผลการวิเคราะห์จาก AI:",
        aiAnswer,
      ].join("\n"),
    };
  },
};

export default aiCsvAnalyzer;
