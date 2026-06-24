"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "search" | "ask" | "status" | "manage";

interface NoteResult {
  note_id: string; title?: string; note_type?: string;
  province?: string; district?: string; year?: number;
  tags?: string[]; snippet?: string;
}
interface PdfAsset {
  filename: string; content_type: string;
  file_size?: number; minio_url: string; province?: string; synced_at?: string;
}
interface VaultInfo {
  name: string; vault_id: string; description?: string;
  note_count: number; vault_path: string; indexed_at?: string;
}
interface AskResultData {
  content: string;
  notes_referenced: NoteResult[];
  metadata: { elapsed_seconds?: number; notes_found?: number };
  follow_ups?: string[];
}
interface PdfPair {
  note_id: string; title?: string; note_type?: string; province?: string;
  source_file?: string; match_type: "direct" | "none"; direct_pdfs?: PdfAsset[];
}
type BrowseNote = NoteResult;

// ── Constants ─────────────────────────────────────────────────────────────────
// ⚠️ ห้าม hardcode "http://localhost:8000" — บนโดเมนจริง (เช่น musyaai.thaihealth.or.th)
// browser ของผู้ใช้จะพยายามต่อ localhost:8000 ของ "เครื่องผู้ใช้เอง" แล้วเจอ
// net::ERR_CONNECTION_REFUSED ทันที (ตรงกับปัญหาที่เจอใน DevTools console)
// ให้ใช้ path สัมพัทธ์ (relative) แทน แล้วปล่อยให้ Next.js rewrite
// ("/api/obsidian/:path*" → "/api/python/obsidian/:path*" ใน next.config.ts)
// proxy ไปยัง PYTHON_API_URL ฝั่ง server แทน — รูปแบบเดียวกับหน้า db-explorer
// ที่เรียก "/api/db/tables" ตรง ๆ โดยไม่ต้องรู้ที่อยู่จริงของ backend เลย
const API = "";
const PROVINCES = ["อุบลราชธานี", "ศรีสะเกษ", "ยโสธร", "อำนาจเจริญ", "มุกดาหาร"];
const VAULT_ID = "health_region_10";

const TYPE_CLS: Record<string, string> = {
  MOC:      "bg-sky-100 text-sky-700",
  report:   "bg-amber-100 text-amber-700",
  district: "bg-gray-100 text-gray-600",
  policy:   "bg-violet-100 text-violet-700",
  research: "bg-pink-100 text-pink-700",
};

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderMd(text: string): string {
  if (!text) return "";
  const esc = (s: string) =>
    s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  let h = esc(text);
  h = h.replace(/```[\w]*\n?([\s\S]*?)```/g, (_,c) => `<pre><code>${c}</code></pre>`);
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/\*(.+?)\*/g, "<em>$1</em>");
  h = h.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  h = h.replace(/^## (.+)$/gm,  "<h2>$1</h2>");
  h = h.replace(/^# (.+)$/gm,   "<h1>$1</h1>");
  h = h.replace(/^---+$/gm, "<hr/>");
  h = h.replace(/((?:\|.+\|\n?)+)/g, block => {
    const lines = block.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return block;
    let t = "<table>";
    lines.forEach((line, i) => {
      if (/^\|[-\s|:]+\|$/.test(line.trim())) return;
      const cells = line.split("|").slice(1,-1);
      const tag = i === 0 ? "th" : "td";
      t += "<tr>" + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join("") + "</tr>";
    });
    return t + "</table>";
  });
  h = h.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
  h = h.replace(/^[*\-] (.+)$/gm, "<li>$1</li>");
  h = h.replace(/(<li>[\s\S]*?<\/li>)+/g, m => `<ul>${m}</ul>`);
  h = h.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  h = h.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br/>");
  h = `<p>${h}</p>`;
  h = h.replace(/<p>(<(?:h[123]|ul|ol|table|pre|blockquote|hr))/g, "$1");
  h = h.replace(/(<\/(?:h[123]|ul|ol|table|pre|blockquote|hr)>)<\/p>/g, "$1");
  h = h.replace(/<p><\/p>/g,"").replace(/<p><br\/><\/p>/g,"");
  return h;
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function TypeBadge({ type }: { type?: string }) {
  const t = type || "district";
  return <span className={`px-2 py-0.5 rounded text-[0.65rem] font-bold uppercase ${TYPE_CLS[t] ?? TYPE_CLS.district}`}>{t}</span>;
}

function TagChip({ text }: { text: string }) {
  return <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[0.7rem] font-semibold">{text}</span>;
}

function Spinner({ size = 16 }: { size?: number }) {
  return <span className="inline-block rounded-full border-2 border-current/20 border-t-current animate-spin flex-shrink-0" style={{ width: size, height: size }} />;
}

function PdfChip({ asset }: { asset: PdfAsset }) {
  const icon = asset.content_type?.includes("pdf") ? "📄" : "📎";
  return (
    <a href={asset.minio_url} target="_blank" rel="noopener" title={asset.filename}
      className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border text-emerald-700 bg-white border-emerald-300 hover:bg-emerald-50 hover:border-emerald-500 transition-colors max-w-[220px] group">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{asset.filename}</span>
      <span className="shrink-0 text-[10px] opacity-40 group-hover:opacity-80 ml-0.5">↗</span>
    </a>
  );
}

function SelectProvince({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} value={value} onChange={e => onChange(e.target.value)}
      className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
      <option value="">ทุกจังหวัด</option>
      {PROVINCES.map(p => <option key={p}>{p}</option>)}
    </select>
  );
}

// ── Note Modal ────────────────────────────────────────────────────────────────
interface NoteModal { noteId: string; title: string }

function NoteDetailModal({
  modal, onClose, provincesWithPdfs,
}: {
  modal: NoteModal; onClose: () => void; provincesWithPdfs: Set<string>;
}) {
  const [content, setContent]   = useState<string | null>(null);
  const [pdfs, setPdfs]         = useState<PdfAsset[] | null>(null);
  const [pdfOpen, setPdfOpen]   = useState(true);

  useEffect(() => {
    setContent(null); setPdfs(null); setPdfOpen(true);

    Promise.allSettled([
      fetch(`${API}/api/obsidian/notes/${encodeURIComponent(modal.noteId)}`).then(r => r.json()),
      fetch(`${API}/api/obsidian/pdfs/note/${encodeURIComponent(modal.noteId)}`).then(r => r.json()),
    ]).then(([nr, pr]) => {
      if (nr.status === "fulfilled") {
        const d = nr.value as { content?: string; error?: string };
        setContent(d.error ? `**Error:** ${d.error}` : (d.content || "(ไม่มีเนื้อหา)"));
      }
      if (pr.status === "fulfilled") {
        const pd = pr.value as { assets?: PdfAsset[] };
        if (pd.assets?.length) setPdfs(pd.assets);
      }
    });
  }, [modal.noteId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-800 text-lg">{modal.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 prose-ac">
          {content === null
            ? <div className="text-gray-400 text-sm py-8 text-center">กำลังโหลด...</div>
            : <div dangerouslySetInnerHTML={{ __html: renderMd(content) }} />}
        </div>
        {pdfs && pdfs.length > 0 && (
          <div className="border-t bg-gray-50 rounded-b-xl">
            <div className="px-4 py-2 flex items-center gap-2 cursor-pointer" onClick={() => setPdfOpen(o => !o)}>
              <span className="text-sm font-semibold text-gray-700">📎 เอกสารต้นฉบับ</span>
              <span className="text-xs text-gray-400">({pdfs.length} ไฟล์)</span>
              <span className="ml-auto text-gray-400 text-xs">{pdfOpen ? "▼" : "▶"}</span>
            </div>
            {pdfOpen && (
              <div className="px-4 pb-3 space-y-1 max-h-40 overflow-y-auto">
                {pdfs.map(a => (
                  <div key={a.filename} className="flex items-center gap-2 py-1 text-sm border-l-2 border-emerald-200 pl-2">
                    <span>{a.content_type === "application/pdf" ? "📄" : "📎"}</span>
                    <span className="flex-1 text-gray-700 truncate text-xs">
                      {a.filename}{a.file_size ? ` · ${Math.round(a.file_size / 1024)} KB` : ""}
                    </span>
                    <a href={a.minio_url} download={a.filename} className="text-xs text-blue-600 hover:underline px-1">📥</a>
                    <a href={a.minio_url} target="_blank" rel="noopener" className="text-xs text-emerald-600 hover:underline px-1">👁</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Search Panel ──────────────────────────────────────────────────────────────
function SearchPanel({ provincesWithPdfs, onOpenNote }: { provincesWithPdfs: Set<string>; onOpenNote: (id: string, title: string) => void }) {
  const [query, setQuery]   = useState("");
  const [province, setProv] = useState("");
  const [noteType, setType] = useState("");
  const [tag, setTag]       = useState("");
  const [topK, setTopK]     = useState("5");
  const [results, setResults] = useState<NoteResult[] | null>(null);
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const doSearch = useCallback(async (q?: string) => {
    const qry = q ?? query;
    if (!qry.trim()) return;
    setLoading(true); setError(""); setResults(null);
    try {
      const r = await fetch(`${API}/api/obsidian/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: qry, province: province || null, note_type: noteType || null, tag: tag || null, top_k: parseInt(topK) }),
      });
      const d = await r.json();
      setResults(d.results || []);
      setCount(d.count || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, [query, province, noteType, tag, topK]);

  const QUICK = ["อัตราฆ่าตัวตาย","NCD remission","วัณโรค TB","ตรวจราชการ 2568","แผนปฏิบัติการ","พัฒนาการเด็ก"];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">🔍 ค้นหาข้อมูลใน Knowledge Vault</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">คำค้นหา *</label>
            <input value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="เช่น อัตราฆ่าตัวตาย มุกดาหาร, NCD remission"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จังหวัด</label>
            <SelectProvince value={province} onChange={setProv} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท Note</label>
            <select value={noteType} onChange={e => setType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="">ทุกประเภท</option>
              {["MOC","report","district","policy","research"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
            <input value={tag} onChange={e => setTag(e.target.value)}
              placeholder="เช่น คปสอ, ตรวจราชการ, PDF"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => doSearch()} className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
            ค้นหา
          </button>
          <label className="text-sm text-gray-600">แสดง</label>
          <select value={topK} onChange={e => setTopK(e.target.value)} className="border rounded px-2 py-1 text-sm">
            {["5","10","20"].map(n => <option key={n}>{n}</option>)}
          </select>
          <label className="text-sm text-gray-600">ผลลัพธ์</label>
          <button onClick={() => { setQuery(""); setProv(""); setType(""); setTag(""); setResults(null); }} className="ml-auto text-sm text-gray-500 hover:text-gray-700">ล้าง</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 font-medium">ค้นหาด่วน:</span>
        {QUICK.map(q => (
          <button key={q} onClick={() => { setQuery(q); doSearch(q); }}
            className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full hover:bg-emerald-100 transition-colors">
            {q}
          </button>
        ))}
      </div>

      {loading && <div className="text-center text-gray-500 py-8 flex items-center justify-center gap-2"><Spinner />กำลังค้นหา...</div>}
      {error && <div className="text-red-600 bg-red-50 p-4 rounded-xl">เกิดข้อผิดพลาด: {error}</div>}
      {results !== null && !loading && (
        results.length === 0
          ? <div className="bg-white rounded-xl border p-8 text-center text-gray-500">ไม่พบข้อมูล<br/><span className="text-sm">ลองเปลี่ยนคำค้นหา</span></div>
          : (
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">พบ {count} ผลลัพธ์ สำหรับ "{query}"</h3>
              <div className="space-y-4">
                {results.map(n => (
                  <NoteCard key={n.note_id} note={n} hasPdf={!!(n.province && provincesWithPdfs.has(n.province))} onClick={() => onOpenNote(n.note_id, n.title || n.note_id)} />
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}

function NoteCard({ note: n, hasPdf, onClick }: { note: NoteResult; hasPdf: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} className="bg-white rounded-xl border p-5 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-semibold text-gray-800 text-sm leading-snug flex-1">
          {n.title || n.note_id}
          {hasPdf && <span className="ml-1 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[0.65rem] font-bold">📄 PDF</span>}
        </h4>
        <TypeBadge type={n.note_type} />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {n.province && <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">📍 {n.province}</span>}
        {n.district && <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{n.district}</span>}
        {n.year && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">ปี {n.year + 543}</span>}
        {(n.tags || []).map(t => <TagChip key={t} text={t} />)}
      </div>
      <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{n.snippet}</p>
      <div className="mt-2 text-xs text-gray-400">ID: {n.note_id}</div>
    </div>
  );
}

// ── Ask Panel ─────────────────────────────────────────────────────────────────
function AskPanel({ onOpenNote }: { onOpenNote: (id: string, title: string) => void }) {
  const [question, setQuestion] = useState("");
  const [province, setProv]     = useState("");
  const [sseLoading, setSseLoading]   = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState<Array<{ name: string; status: string; message: string }>>([]);
  const [showProgress, setShowProgress]   = useState(false);
  const [result, setResult]     = useState<AskResultData | null>(null);
  const [pdfPairMap, setPdfPairMap] = useState<Record<string, PdfPair>>({});
  const [pdfStatus, setPdfStatus]   = useState<"loading"|"done"|"error"|null>(null);

  const QUICK_Q = [
    { label: "NCD มุกดาหาร", q: "สรุปผลงาน NCD remission ของอำเภอเมืองมุกดาหารปีงบประมาณ 2568" },
    { label: "ตรวจราชการ อุบล 2568", q: "ผลการตรวจราชการรอบ 2 ปี 2568 ของจังหวัดอุบลราชธานี มีประเด็นใดที่ต้องปรับปรุง?" },
    { label: "อัตราฆ่าตัวตาย", q: "อัตราฆ่าตัวตายสำเร็จในเขตสุขภาพที่ 10 เป็นอย่างไรในปี 2568 และมีแผนแก้ไขอย่างไร?" },
    { label: "วิจัยปลาดิบ", q: "สรุปผลงานวิจัยเรื่องการบริโภคปลาดิบและความเสี่ยงมะเร็งท่อน้ำดีในเขต 10" },
  ];

  async function doAskSync() {
    if (!question.trim()) return;
    setSyncLoading(true); setShowProgress(false); setResult(null);
    try {
      const r = await fetch(`${API}/api/obsidian/ask`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, province: province || null, vault_id: VAULT_ID }),
      });
      const d = await r.json();
      setResult(d); loadPdfPairs(d.notes_referenced || []);
    } catch (e: unknown) {
      setResult({ content: `**เกิดข้อผิดพลาด:** ${e instanceof Error ? e.message : "error"}`, notes_referenced: [], metadata: {} });
    } finally { setSyncLoading(false); }
  }

  async function doAsk() {
    if (!question.trim()) return;
    setSseLoading(true); setShowProgress(true); setResult(null);
    setProgressSteps([]);

    try {
      const resp = await fetch(`${API}/api/obsidian/ask/stream`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, province: province || null, vault_id: VAULT_ID }),
      });
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "start") {
              setProgressSteps((ev.agents || []).map((a: string) => ({ name: a, status: "idle", message: "" })));
            } else if (ev.type === "progress") {
              setProgressSteps(prev => {
                const exists = prev.some(p => p.name === ev.agent_name);
                const updated = { name: ev.agent_name, status: ev.status, message: ev.message };
                return exists ? prev.map(p => p.name === ev.agent_name ? updated : p) : [...prev, updated];
              });
            } else if (ev.type === "result") {
              setShowProgress(false); setResult(ev.data);
              loadPdfPairs(ev.data.notes_referenced || []);
            } else if (ev.type === "error") {
              setResult({ content: `**เกิดข้อผิดพลาด:** ${ev.message}`, notes_referenced: [], metadata: {} });
              setShowProgress(false);
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      setResult({ content: `**เกิดข้อผิดพลาด:** ${e instanceof Error ? e.message : "error"}`, notes_referenced: [], metadata: {} });
      setShowProgress(false);
    } finally { setSseLoading(false); }
  }

  async function loadPdfPairs(notes: NoteResult[]) {
    const provinces = [...new Set(notes.map(n => n.province).filter(Boolean))] as string[];
    if (!provinces.length) return;
    setPdfStatus("loading"); setPdfPairMap({});

    try {
      const results = await Promise.allSettled(
        provinces.map(p => fetch(`${API}/api/obsidian/pdfs/pairs?province=${encodeURIComponent(p)}&vault_id=${VAULT_ID}`).then(r => r.json()))
      );
      const map: Record<string, PdfPair> = {};
      results.forEach(res => {
        if (res.status === "fulfilled" && Array.isArray(res.value.pairs)) {
          res.value.pairs.forEach((pair: PdfPair) => { map[pair.note_id] = pair; });
        }
      });
      setPdfPairMap(map); setPdfStatus("done");
    } catch { setPdfStatus("error"); }
  }

  function clear() {
    setQuestion(""); setResult(null); setShowProgress(false); setProgressSteps([]);
  }

  const isLoading = sseLoading || syncLoading;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">🤖 ถามตอบด้วย AI Agent</h2>
        <p className="text-sm text-gray-500 mb-4">ตั้งคำถามภาษาไทย — AI จะค้นหาข้อมูลจาก Vault และเขียนคำตอบให้</p>
        <textarea rows={3} value={question} onChange={e => setQuestion(e.target.value)}
          placeholder="เช่น อัตราฆ่าตัวตายของอำเภอเมืองมุกดาหารปี 2568 เป็นอย่างไร?"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none mb-3" />
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <SelectProvince value={province} onChange={setProv} />
          <button onClick={doAsk} disabled={isLoading || !question.trim()}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            {sseLoading && <Spinner size={14} />} ถามตอบ (SSE)
          </button>
          <button onClick={doAskSync} disabled={isLoading || !question.trim()}
            className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            {syncLoading && <Spinner size={14} />} ถาม (Sync)
          </button>
          <button onClick={clear} className="text-sm text-gray-500 hover:text-gray-700 ml-auto">ล้าง</button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <span className="text-xs text-gray-500 font-medium w-full mb-1">คำถามตัวอย่าง:</span>
          {QUICK_Q.map(({ label, q }) => (
            <button key={label} onClick={() => setQuestion(q)}
              className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors">
              {label}
            </button>
          ))}
        </div>
      </div>

      {showProgress && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            กำลังประมวลผล...
          </h3>
          <div className="space-y-2">
            {progressSteps.map(step => {
              const cls = step.status === "running" ? "border-emerald-500 text-emerald-700" : step.status === "done" ? "border-emerald-700 text-gray-700" : "border-red-400 text-red-600";
              const icon = step.status === "running" ? "🔄" : step.status === "done" ? "✅" : step.status === "error" ? "❌" : "⏳";
              return (
                <div key={step.name} className={`border-l-4 pl-3 py-1 text-sm ${cls}`}>
                  {icon} {step.name}: {step.message}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result && (
        <AskResultCard result={result} pdfPairMap={pdfPairMap} pdfStatus={pdfStatus} onOpenNote={onOpenNote} onSetQuestion={setQuestion} />
      )}
    </div>
  );
}

function AskResultCard({ result, pdfPairMap, pdfStatus, onOpenNote, onSetQuestion }: {
  result: AskResultData; pdfPairMap: Record<string, PdfPair>;
  pdfStatus: "loading"|"done"|"error"|null;
  onOpenNote: (id: string, title: string) => void;
  onSetQuestion: (q: string) => void;
}) {
  const notes = result.notes_referenced || [];
  const meta  = result.metadata || {};

  return (
    <div className="bg-white rounded-xl border shadow-sm">
      <div className="px-5 py-3 border-b flex items-center gap-2 flex-wrap text-xs text-gray-400">
        <span>⏱ {meta.elapsed_seconds ?? "?"} วินาที</span>
        <span>·</span>
        <span>📋 อ้างอิง {meta.notes_found ?? notes.length} notes</span>
      </div>

      <div className="p-5 prose-ac" dangerouslySetInnerHTML={{ __html: renderMd(result.content) }} />

      {notes.length > 0 && (
        <div className="mx-4 mb-5 rounded-xl bg-blue-50 border border-blue-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-blue-200 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-blue-800">📂 เอกสารต้นฉบับ PDF</span>
            {pdfStatus === "loading" && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-500"><Spinner size={12} />กำลังโหลดเอกสาร...</span>
            )}
            {pdfStatus === "done" && (() => {
              const totalDirect = notes.reduce((s, n) => s + (pdfPairMap[n.note_id]?.direct_pdfs?.length ?? 0), 0);
              return totalDirect > 0
                ? <span className="text-xs text-emerald-600 font-medium">✅ พบ {totalDirect} ไฟล์ต้นฉบับ</span>
                : <span className="text-xs text-gray-400">ไม่พบเอกสารต้นฉบับ</span>;
            })()}
            {pdfStatus === "error" && <span className="text-xs text-red-400">โหลดไม่ได้</span>}
          </div>
          <ul className="divide-y divide-blue-100 px-4 py-1">
            {notes.map(n => {
              const pair = pdfPairMap[n.note_id];
              const directs = pair?.direct_pdfs ?? [];
              return (
                <li key={n.note_id} className="py-2.5 border-b border-blue-100 last:border-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <button onClick={() => onOpenNote(n.note_id, n.title || n.note_id)}
                      className="font-medium text-xs text-gray-800 hover:text-indigo-700 hover:underline text-left">
                      {n.title || n.note_id}
                    </button>
                    {n.province && (
                      <span className="text-xs text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full">
                        {n.province}{n.district ? ` / ${n.district}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pdfStatus === "loading" && n.province
                      ? <span className="text-xs text-blue-400">กำลังโหลด...</span>
                      : directs.length > 0
                        ? directs.slice(0, 4).map(a => <PdfChip key={a.filename} asset={a} />)
                        : pair?.source_file
                          ? <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠️ ไม่พบ: {pair.source_file.split("/").pop()}</span>
                          : <span className="text-xs text-gray-300">—</span>
                    }
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(result.follow_ups ?? []).length > 0 && (
        <div className="p-5 border-t">
          <p className="text-xs font-semibold text-gray-600 mb-2">💡 คำถามติดตาม:</p>
          <div className="flex flex-wrap gap-2">
            {result.follow_ups!.map(q => (
              <button key={q} onClick={() => onSetQuestion(q)}
                className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors text-left">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Status Panel ──────────────────────────────────────────────────────────────
function StatusPanel() {
  const [data, setData]       = useState<{ total_notes: number; vaults: VaultInfo[]; enabled: boolean } | null>(null);
  const [pdfCount, setPdfCount] = useState(0);
  const [pdfSync, setPdfSync]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [sr, pr] = await Promise.allSettled([
          fetch(`${API}/api/obsidian/status`).then(r => r.json()),
          fetch(`${API}/api/obsidian/pdfs`).then(r => r.json()),
        ]);
        if (sr.status === "fulfilled") setData(sr.value);
        if (pr.status === "fulfilled") {
          const pd = pr.value as { count?: number; assets?: PdfAsset[] };
          setPdfCount(pd.count || 0);
          const dates = (pd.assets || []).map(a => a.synced_at).filter(Boolean).sort();
          if (dates.length) setPdfSync(new Date(dates[dates.length - 1]!).toLocaleString("th-TH"));
        }
      } catch (e: unknown) { setError(e instanceof Error ? e.message : "error"); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="text-center text-gray-500 py-12 flex justify-center gap-2"><Spinner />กำลังโหลด...</div>;
  if (error) return <div className="text-red-600 bg-red-50 p-6 rounded-xl">ไม่สามารถโหลดสถานะ: {error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { val: data.total_notes, label: "Notes ทั้งหมด", cls: "text-emerald-600" },
          { val: data.vaults.length, label: "Vaults", cls: "text-teal-600" },
          { val: `📄 ${pdfCount}`, label: "PDF Assets", cls: "text-blue-600", sub: pdfSync ? `Sync: ${pdfSync}` : undefined },
          { val: data.enabled ? "✅ Active" : "❌ Disabled", label: "สถานะระบบ", cls: data.enabled ? "text-green-600" : "text-red-500" },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border p-5 text-center">
            <div className={`text-3xl font-bold mb-1 ${card.cls}`}>{card.val}</div>
            <div className="text-sm text-gray-500">{card.label}</div>
            {card.sub && <div className="text-xs text-gray-400 mt-1">{card.sub}</div>}
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {data.vaults.map(v => (
          <div key={v.vault_id} className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-800">{v.name}</h3>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">{v.vault_id}</span>
            </div>
            <p className="text-sm text-gray-500 mb-3">{v.description}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-emerald-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-700">{v.note_count}</div>
                <div className="text-xs text-gray-500">Notes</div>
              </div>
              <div className="text-center p-3 bg-teal-50 rounded-lg col-span-2">
                <div className="text-sm font-medium text-teal-700">{v.vault_path}</div>
                <div className="text-xs text-gray-500">Vault Path</div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Indexed: {v.indexed_at ? new Date(v.indexed_at).toLocaleString("th-TH") : "ยังไม่ได้ Index"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Manage Panel ──────────────────────────────────────────────────────────────
function ManagePanel({ provincesWithPdfs, onOpenNote, onRefreshPdfs, onRefreshHealth }: {
  provincesWithPdfs: Set<string>; onOpenNote: (id: string, t: string) => void;
  onRefreshPdfs: () => void; onRefreshHealth: () => void;
}) {
  // Index
  const [idxVault, setIdxVault]   = useState(VAULT_ID);
  const [idxLoading, setIdxLoad]  = useState(false);
  const [idxResult, setIdxResult] = useState<React.ReactNode>(null);

  // Sync PDF
  const [syncLoading, setSyncLoad]  = useState(false);
  const [syncResult, setSyncResult] = useState<React.ReactNode>(null);

  // Browse
  const [brProv, setBrProv]   = useState("");
  const [brType, setBrType]   = useState("");
  const [brTag, setBrTag]     = useState("");
  const [browseData, setBrowseData] = useState<{ notes: Record<string, BrowseNote[]>; count: number } | null>(null);
  const [browseLoading, setBrowseLoad] = useState(false);
  const [collapsedProvs, setCollapsedProvs] = useState<Set<string>>(new Set());

  // Pairs
  const [pairProv, setPairProv]   = useState("");
  const [pairLoading, setPairLoad] = useState(false);
  const [pairData, setPairData]   = useState<{ pairs: PdfPair[]; count: number; matched: number; unmatched: number } | null>(null);

  useEffect(() => { doBrowse(); }, []);

  async function doIndex() {
    if (!confirm(`เริ่ม Index vault "${idxVault}"? อาจใช้เวลาหลายนาที`)) return;
    setIdxLoad(true);
    setIdxResult(<div className="text-gray-500 text-sm">กำลังสแกนไฟล์...</div>);
    try {
      const r = await fetch(`${API}/api/obsidian/index`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vault_id: idxVault }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setIdxResult(
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
          <p className="font-semibold text-green-800 mb-2">✅ Index เสร็จสมบูรณ์</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[["ใหม่",d.inserted,"text-green-700"],["อัปเดต",d.updated,"text-blue-700"],["ไม่เปลี่ยน",d.unchanged,"text-gray-600"]].map(([l,v,c])=>(
              <div key={String(l)}><div className={`font-bold text-lg ${c}`}>{v}</div><div className="text-xs text-gray-500">{l}</div></div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">ไฟล์ทั้งหมด: {d.total_files} · ใช้เวลา: {d.elapsed_seconds}s · ข้อผิดพลาด: {d.errors}</p>
        </div>
      );
      onRefreshHealth();
    } catch (e: unknown) {
      setIdxResult(<div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">เกิดข้อผิดพลาด: {e instanceof Error ? e.message : "error"}</div>);
    } finally { setIdxLoad(false); }
  }

  async function doSyncPdfs() {
    if (!confirm("เริ่ม Sync PDFs ไปยัง MinIO?")) return;
    setSyncLoad(true);
    setSyncResult(<div className="text-gray-500 text-sm">กำลังอัพโหลด...</div>);
    try {
      const r = await fetch(`${API}/api/obsidian/pdfs/sync`, { method: "POST" });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setSyncResult(
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p className="font-semibold text-blue-800 mb-2">✅ Sync เสร็จสมบูรณ์</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[["อัพโหลดใหม่",d.uploaded,"text-blue-700"],["ข้ามแล้ว",d.skipped,"text-gray-600"],["ข้อผิดพลาด",d.errors,"text-red-600"],["ไฟล์ทั้งหมด",d.total_files,"text-teal-700"]].map(([l,v,c])=>(
              <div key={String(l)}><div className={`font-bold text-lg ${c}`}>{v}</div><div className="text-xs text-gray-500">{l}</div></div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">ใช้เวลา: {d.elapsed_seconds}s</p>
        </div>
      );
      onRefreshPdfs();
    } catch (e: unknown) {
      setSyncResult(<div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">เกิดข้อผิดพลาด: {e instanceof Error ? e.message : "error"}</div>);
    } finally { setSyncLoad(false); }
  }

  async function doBrowse() {
    setBrowseLoad(true);
    const params = new URLSearchParams({ vault_id: VAULT_ID });
    if (brProv) params.set("province", brProv);
    if (brType) params.set("note_type", brType);
    if (brTag)  params.set("tag", brTag);
    try {
      const d = await fetch(`${API}/api/obsidian/notes?${params}`).then(r => r.json());
      const grouped: Record<string, BrowseNote[]> = {};
      for (const n of (d.notes || []) as BrowseNote[]) {
        const p = n.province || "(ไม่ระบุจังหวัด)";
        if (!grouped[p]) grouped[p] = [];
        grouped[p].push(n);
      }
      setBrowseData({ notes: grouped, count: d.count || 0 });
    } catch {}
    finally { setBrowseLoad(false); }
  }

  async function loadPairs() {
    setPairLoad(true); setPairData(null);
    const params = new URLSearchParams({ vault_id: VAULT_ID });
    if (pairProv) params.set("province", pairProv);
    try {
      const d = await fetch(`${API}/api/obsidian/pdfs/pairs?${params}`).then(r => r.json());
      if (d.error) throw new Error(d.error);
      setPairData(d);
    } catch {}
    finally { setPairLoad(false); }
  }

  function toggleProv(p: string) {
    setCollapsedProvs(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });
  }

  return (
    <div className="space-y-6">
      {/* Index */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">🔄 Index Vault</h2>
        <p className="text-sm text-gray-500 mb-4">สแกนไฟล์ .md ทั้งหมดและ UPSERT เข้าฐานข้อมูล</p>
        <div className="flex gap-3 items-center">
          <select value={idxVault} onChange={e => setIdxVault(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value={VAULT_ID}>{VAULT_ID}</option>
          </select>
          <button onClick={doIndex} disabled={idxLoading}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2">
            {idxLoading && <Spinner size={14} />} เริ่ม Index
          </button>
        </div>
        {idxResult && <div className="mt-4">{idxResult}</div>}
      </div>

      {/* Sync PDFs */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">📄 Sync PDFs to MinIO</h2>
        <p className="text-sm text-gray-500 mb-4">อัพโหลดไฟล์ PDF/DOCX ต้นฉบับทั้งหมดไปยัง MinIO</p>
        <button onClick={doSyncPdfs} disabled={syncLoading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
          {syncLoading ? <><Spinner size={14} />กำลัง Sync...</> : "🔄 Sync PDFs to MinIO"}
        </button>
        {syncResult && <div className="mt-4">{syncResult}</div>}
      </div>

      {/* Browse */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">📂 Vault Browser</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <SelectProvince value={brProv} onChange={v => { setBrProv(v); }} />
          <select value={brType} onChange={e => setBrType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value="">ทุกประเภท</option>
            {["MOC","report","district","policy","research"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={brTag} onChange={e => setBrTag(e.target.value)} onKeyDown={e => e.key === "Enter" && doBrowse()}
            placeholder="กรอง tag..." className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-40" />
          <button onClick={doBrowse} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">แสดง</button>
        </div>
        {browseLoading && <div className="text-gray-400 text-sm py-4 flex gap-2"><Spinner />กำลังโหลด...</div>}
        {browseData && !browseLoading && (
          <div>
            <p className="text-xs text-gray-500 mb-3">พบ {browseData.count} notes ใน {Object.keys(browseData.notes).length} จังหวัด</p>
            <div className="space-y-2">
              {Object.entries(browseData.notes).sort(([a],[b]) => a.localeCompare(b,"th")).map(([prov, notes]) => {
                const collapsed = collapsedProvs.has(prov);
                const hasPdf = provincesWithPdfs.has(prov);
                return (
                  <div key={prov} className="mb-2">
                    <div className="flex items-center gap-2 py-2 px-3 bg-emerald-50 rounded-lg cursor-pointer hover:bg-emerald-100" onClick={() => toggleProv(prov)}>
                      <span>📂</span>
                      <span className="font-semibold text-emerald-800 text-sm">{prov}</span>
                      {hasPdf && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[0.65rem] font-bold">📄 PDF</span>}
                      <span className="text-xs text-gray-400 ml-1">({notes.length} notes)</span>
                      <span className="ml-auto text-gray-400 text-xs">{collapsed ? "▶" : "▼"}</span>
                    </div>
                    {!collapsed && (
                      <div className="mt-1 space-y-0.5">
                        {notes.map(n => (
                          <div key={n.note_id} onClick={() => onOpenNote(n.note_id, n.title || n.note_id)}
                            className="flex items-center gap-2 py-1 pl-4 hover:bg-emerald-50 cursor-pointer rounded border-l-2 border-green-200 hover:border-emerald-500 transition-all">
                            <span className="text-xs text-gray-400">📄</span>
                            <span className="text-sm text-gray-700 flex-1 truncate">{n.title || n.note_id}</span>
                            <TypeBadge type={n.note_type} />
                            {n.year && <span className="text-xs text-gray-400">{n.year + 543}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* PDF Pairs */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">📎 จับคู่ Note ↔ PDF (MinIO)</h2>
        <p className="text-sm text-gray-500 mb-4">แสดงความสัมพันธ์ระหว่างไฟล์ .md ใน Vault กับเอกสาร PDF ต้นฉบับใน MinIO</p>
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <select value={pairProv} onChange={e => setPairProv(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value="">เลือกจังหวัด</option>
            {PROVINCES.map(p => <option key={p}>{p}</option>)}
          </select>
          <button onClick={loadPairs} disabled={pairLoading}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            {pairLoading ? <><Spinner size={14} />กำลังโหลด...</> : "📋 โหลดตาราง"}
          </button>
          {pairData && (
            <span className="text-xs text-gray-500">
              <span className="text-emerald-700 font-medium">✅ {pairData.matched} linked</span>
              {" · "}⬜ {pairData.unmatched} no PDF
              {" · "}{pairData.count} notes
            </span>
          )}
        </div>

        {pairData && (
          <>
            <div className="flex gap-4 text-xs mb-3 p-3 bg-slate-50 rounded-lg border">
              {[
                ["bg-emerald-400","✅ ลิงก์ตรง",pairData.matched],
                ["bg-amber-400","⚠️ source_file ไม่พบ",pairData.pairs.filter(p=>p.match_type==="none"&&p.source_file).length],
                ["bg-gray-300","— ไม่มี source_file",pairData.pairs.filter(p=>p.match_type==="none"&&!p.source_file).length],
              ].map(([dot,label,count]) => (
                <span key={String(label)} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${dot} inline-block`}/>
                  {label}: <strong>{count}</strong>
                </span>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-[65vh] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b text-xs text-gray-600 font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left w-64">ชื่อ Note (.md)</th>
                    <th className="px-3 py-2 text-left w-28">จังหวัด</th>
                    <th className="px-3 py-2 text-left w-20">ประเภท</th>
                    <th className="px-3 py-2 text-left">เอกสารต้นฉบับ PDF ใน MinIO ↗</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {pairData.pairs.map(p => {
                    const directs = p.direct_pdfs ?? [];
                    let pdfCell: React.ReactNode;
                    if (p.match_type === "direct") {
                      pdfCell = <div className="flex flex-wrap gap-1 items-center">{directs.slice(0,4).map(a => <PdfChip key={a.filename} asset={a} />)}</div>;
                    } else if (p.source_file) {
                      pdfCell = <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠️ ไม่พบ: {p.source_file.split("/").pop()}</span>;
                    } else {
                      pdfCell = <span className="text-xs text-gray-300">—</span>;
                    }
                    return (
                      <tr key={p.note_id} className="border-b border-gray-100 hover:bg-slate-50 align-top">
                        <td className="px-3 py-2 w-64">
                          <button onClick={() => onOpenNote(p.note_id, p.title || p.note_id)}
                            className="text-left text-xs font-medium text-gray-800 hover:text-indigo-700 hover:underline leading-snug">
                            {p.title || p.note_id}
                            {p.match_type === "direct" && <span className="ml-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 rounded">✅</span>}
                          </button>
                          {p.source_file && (
                            <div className="text-xs text-gray-400 truncate max-w-60 mt-0.5">📄 {p.source_file.split("/").pop()}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-xs text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full">{p.province || "—"}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap"><TypeBadge type={p.note_type} /></td>
                        <td className="px-3 py-2">{pdfCell}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ObsidianPage() {
  const [tab, setTab]   = useState<Tab>("search");
  const [dotCls, setDotCls]   = useState("bg-gray-400");
  const [statusText, setStatusText] = useState("กำลังตรวจสอบ...");
  const [provincesWithPdfs, setProvincesWithPdfs] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<NoteModal | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const d = await fetch(`${API}/api/obsidian/status`).then(r => r.json());
      setDotCls(d.enabled ? "bg-green-400" : "bg-yellow-400");
      setStatusText(d.enabled ? `${d.total_notes} notes · ${d.vaults.length} vault` : "Disabled");
    } catch { setDotCls("bg-red-400"); setStatusText("ไม่สามารถเชื่อมต่อ"); }
  }, []);

  const loadPdfProvinces = useCallback(async () => {
    try {
      const d = await fetch(`${API}/api/obsidian/pdfs`).then(r => r.json());
      setProvincesWithPdfs(new Set((d.assets || []).map((a: PdfAsset) => a.province).filter(Boolean)));
    } catch {}
  }, []);

  useEffect(() => { checkHealth(); loadPdfProvinces(); }, [checkHealth, loadPdfProvinces]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function openNote(noteId: string, title: string) { setModal({ noteId, title }); }

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: "search", label: "🔍 ค้นหา" },
    { key: "ask",    label: "🤖 ถามตอบ AI" },
    { key: "status", label: "📊 สถานะ" },
    { key: "manage", label: "⚙️ จัดการ" },
  ];

  return (
    <div className="bg-gray-50 min-h-screen" style={{ fontFamily: "var(--font-ibm-plex-thai), sans-serif" }}>
      <header className="sticky top-0 z-20 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🌿</div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Obsidian Knowledge Vault</h1>
              <p className="text-xs text-emerald-100">คลังความรู้สุขภาพ — เขตสุขภาพที่ 10 (5 จังหวัด)</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs">
            <span className={`w-2 h-2 rounded-full animate-pulse ${dotCls}`} />
            <span>{statusText}</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-2">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? "bg-white text-emerald-700 shadow-md" : "text-white/70 hover:text-white"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {tab === "search" && <SearchPanel provincesWithPdfs={provincesWithPdfs} onOpenNote={openNote} />}
        {tab === "ask"    && <AskPanel onOpenNote={openNote} />}
        {tab === "status" && <StatusPanel />}
        {tab === "manage" && <ManagePanel provincesWithPdfs={provincesWithPdfs} onOpenNote={openNote} onRefreshPdfs={loadPdfProvinces} onRefreshHealth={checkHealth} />}
      </main>

      {modal && <NoteDetailModal modal={modal} onClose={() => setModal(null)} provincesWithPdfs={provincesWithPdfs} />}
    </div>
  );
}
