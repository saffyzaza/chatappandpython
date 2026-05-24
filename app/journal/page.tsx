"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type ReportMeta = {
  id: string;
  title: string;
  query: string;
  doc_type: "policy" | "plan" | "workplan";
  article_count: number;
  topic_plan: string;
  created_at: string;
};

const DOC_TYPE_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  policy:   { label: "Policy Brief",   emoji: "📋", color: "bg-blue-50 text-blue-700 border-blue-200" },
  plan:     { label: "แผนยุทธศาสตร์",  emoji: "📜", color: "bg-purple-50 text-purple-700 border-purple-200" },
  workplan: { label: "แผนปฏิบัติงาน", emoji: "📅", color: "bg-green-50 text-green-700 border-green-200" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function JournalLibraryPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/journal-reports");
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json() as { reports: ReportMeta[] };
      setReports(data.reports ?? []);
    } catch {
      setError("ไม่สามารถโหลดรายงานได้");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void fetchReports(); }, [fetchReports]);

  const handleOpen = useCallback(async (id: string) => {
    setOpeningId(id);
    try {
      const res = await fetch(`/api/journal-reports/${id}`);
      const data = await res.json() as { report: { html_content: string } };
      const blob = new Blob([data.report.html_content], { type: "text/html; charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      alert("ไม่สามารถเปิดรายงานได้");
    } finally {
      setOpeningId(null);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("ต้องการลบรายงานนี้?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/journal-reports/${id}`, { method: "DELETE" });
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("ลบไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f7f6]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#1a6b3c] flex items-center gap-2">
              <span className="text-2xl">📚</span>
              คลังรายงาน Journal
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">รายงานที่สร้างจาก ThaiJo Pipeline ทั้งหมด</p>
          </div>
          <button
            onClick={() => router.push("/chat")}
            className="flex items-center gap-1.5 text-sm text-[#1a6b3c] hover:underline"
          >
            ← กลับหน้า Chat
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-[#1a6b3c] gap-2">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-sm">กำลังโหลด...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && reports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
            <span className="text-5xl">📄</span>
            <p className="text-sm font-medium">ยังไม่มีรายงานที่บันทึก</p>
            <p className="text-xs">สร้างรายงานจาก Journal Report ในหน้า Chat แล้วจะปรากฏที่นี่</p>
            <button
              onClick={() => router.push("/chat")}
              className="mt-2 px-4 py-2 rounded-full bg-[#1a6b3c] text-white text-sm font-semibold hover:bg-[#155c32] transition"
            >
              ไปหน้า Chat
            </button>
          </div>
        )}

        {/* Report grid */}
        {!loading && reports.length > 0 && (
          <>
            <p className="text-xs text-gray-500 mb-4">{reports.length} รายงาน</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {reports.map((r) => {
                const dt = DOC_TYPE_LABEL[r.doc_type] ?? DOC_TYPE_LABEL.policy;
                return (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition"
                  >
                    {/* Type badge + date */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${dt.color}`}>
                        {dt.emoji} {dt.label}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{formatDate(r.created_at)}</span>
                    </div>

                    {/* Title */}
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 leading-snug line-clamp-2">{r.title}</h3>
                      {r.query !== r.title && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">หัวข้อ: {r.query}</p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        {r.article_count} บทความ
                      </span>
                      {r.topic_plan && (
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                          </svg>
                          กำหนดหัวข้อเอง
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => void handleOpen(r.id)}
                        disabled={openingId === r.id}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#1a6b3c] hover:bg-[#155c32] text-white text-xs font-semibold py-2 rounded-xl transition disabled:opacity-50"
                      >
                        {openingId === r.id ? (
                          <>
                            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            กำลังเปิด...
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                            </svg>
                            เปิดรายงาน
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => void handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        className="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold px-3 py-2 rounded-xl border border-red-200 transition disabled:opacity-50"
                        title="ลบรายงาน"
                      >
                        {deletingId === r.id ? (
                          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        )}
                        ลบ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
