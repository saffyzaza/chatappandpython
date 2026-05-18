import type { ExecutableTool, ToolArgs, ToolResult } from "./types";

type StoredFile = { id: string; name: string; path: string; extension: string; previewKind: string };

// ─── Simple file lister — return all CSV files, let the domain agent decide ───

const fileFinder: ExecutableTool = {
  name: "file_finder",
  description:
    "แสดงรายการไฟล์ CSV ทั้งหมดใน MinIO กรองเฉพาะ domain ที่เกี่ยวข้อง",
  usage:
    '[TOOL_CALL: file_finder(query="พยายามฆ่าตัวตาย ยโสธร 2024")]',

  async execute(args: ToolArgs, appUrl: string): Promise<ToolResult> {
    const query = (args.query || [args.disease, args.province, args.year, args.domain].filter(Boolean).join(" ")).toLowerCase();

    let files: StoredFile[] = [];
    try {
      const res = await fetch(`${appUrl}/api/files`);
      if (!res.ok) return { success: false, data: "ไม่สามารถเข้าถึงรายการไฟล์ได้" };
      const all = (await res.json()) as StoredFile[];
      files = all.filter((f) => f.previewKind === "csv" || f.extension?.toLowerCase() === "csv");
    } catch {
      return { success: false, data: "เกิดข้อผิดพลาดในการดึงรายการไฟล์" };
    }

    if (files.length === 0) return { success: false, data: "ไม่พบไฟล์ CSV ในระบบ" };

    // Simple keyword pre-filter (just domain/disease, not province/year)
    // to reduce list size for the agent — but keep all if nothing matches
    const keywords = query.split(/\s+/).filter((w) => w.length > 3);
    let filtered = files.filter((f) => {
      const p = `${f.path ?? ""}/${f.name}`.toLowerCase();
      return keywords.some((k) => p.includes(k));
    });
    if (filtered.length === 0) filtered = files; // fallback: show all

    const lines = filtered.map(
      (f) => `- ID: ${f.id} | path: ${f.path}/${f.name}`,
    );

    return {
      success: true,
      data:
        `พบ ${filtered.length} ไฟล์ CSV ที่เกี่ยวข้อง:\n` +
        lines.join("\n") +
        `\n\n→ เลือก file_id ที่เหมาะสมแล้วใช้ ai_csv_analyzer(file_id="...", question="...")`,
    };
  },
};

export default fileFinder;
