"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type StepStatus = "idle" | "running" | "done" | "error";
type RightTab = "raw" | "limits" | "tools";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  limitations?: string[];
  elapsed?: string;
  loading?: boolean;
}

interface StepPill {
  name: string;
  status: StepStatus;
  message?: string;
}

interface QuestionGroup {
  label: string;
  questions: Array<{ text: string }>;
}

// ── Markdown helpers ──────────────────────────────────────────────────────────
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMd(text: string): string {
  if (!text) return "";
  let h = esc(text);
  h = h.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) => `<pre><code>${c}</code></pre>`);
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/\*(.+?)\*/g, "<em>$1</em>");
  h = h.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  h = h.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  h = h.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  h = h.replace(/^---+$/gm, "<hr/>");
  h = h.replace(/((?:\|.+\|\n?)+)/g, (block) => {
    const lines = block.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return block;
    let t = "<table>";
    lines.forEach((line, i) => {
      if (/^\|[-\s|:]+\|$/.test(line.trim())) return;
      const cells = line.split("|").slice(1, -1);
      const tag = i === 0 ? "th" : "td";
      t += "<tr>" + cells.map((c) => `<${tag}>${c.trim()}</${tag}>`).join("") + "</tr>";
    });
    return t + "</table>";
  });
  h = h.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
  h = h.replace(/^[*\-] (.+)$/gm, "<li>$1</li>");
  h = h.replace(/(<li>[\s\S]*?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
  h = h.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  h = h.replace(/\n\n+/g, "</p><p>");
  h = h.replace(/\n/g, "<br/>");
  h = `<p>${h}</p>`;
  h = h.replace(/<p>(<(?:h[123]|ul|ol|table|pre|blockquote|hr))/g, "$1");
  h = h.replace(/(<\/(?:h[123]|ul|ol|table|pre|blockquote|hr)>)<\/p>/g, "$1");
  h = h.replace(/<p><\/p>/g, "").replace(/<p><br\/><\/p>/g, "");
  return h;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATIC_LIMITS = [
  "fact_accident_person ว่างทั้งหมด",
  "light_condition = NULL",
  "road_condition = NULL",
  "road_name ส่วนใหญ่ไม่ระบุ",
  "ปี DB = ค.ศ. (CE+543=พ.ศ.)",
];

const QUICK_BTNS: Array<{ key: string; label: string; purple?: boolean }> = [
  { key: "hotspot_roads",             label: "ถนนเสี่ยง" },
  { key: "kpi_trend",                 label: "KPI ปีละ" },
  { key: "fatal_timeband",            label: "เวลาเสี่ยง" },
  { key: "province_executive_summary",label: "Executive" },
  { key: "late_night_vehicles",       label: "กลางคืน" },
  { key: "monthly_vehicle_pattern",   label: "รายเดือน" },
  { key: "district_summary",          label: "รายอำเภอ", purple: true },
];

const WELCOME: Message = {
  id: "welcome",
  role: "bot",
  content: [
    "**สวัสดีครับ!** ฉันคือ Accident Chat Agent สำหรับเขตสุขภาพที่ 10",
    "คุณสามารถถามคำถามเชิงนโยบายอุบัติเหตุทางถนน เช่น:",
    "- ถนนที่เสี่ยงที่สุดในจังหวัดอุบลราชธานีคือถนนใด?",
    "- แนวโน้มผู้เสียชีวิตของเขตสุขภาพที่ 10 ในช่วง 3 ปีที่ผ่านมา",
    "- เดือนใดที่อุบัติเหตุสูงสุดและมีเทศกาลอะไรบ้าง?",
    "",
    "💡 คลิกคำถามตัวอย่างด้านซ้าย หรือพิมพ์คำถามเองได้เลย",
  ].join("\n"),
};

function agentIcon(name: string) {
  if (name.includes("SQL")) return "🗄️";
  if (name.includes("Answer") || name.includes("Writer")) return "📋";
  return "🤖";
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AccidentChatPage() {
  // messages
  const [messages, setMessages] = useState<Message[]>([WELCOME]);

  // sidebar
  const [provinces, setProvinces]       = useState<string[]>([]);
  const [allDistricts, setAllDistricts] = useState<Record<string, string[]>>({});
  const [questions, setQuestions]       = useState<QuestionGroup[]>([]);
  const [province, setProvince]         = useState("");
  const [district, setDistrict]         = useState("");
  const [yearStart, setYearStart]       = useState(2021);
  const [yearEnd,   setYearEnd]         = useState(2026);

  // input
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // thinking bar
  const [showThinking, setShowThinking] = useState(false);
  const [stepPills, setStepPills]       = useState<StepPill[]>([]);
  const [elapsedStr, setElapsedStr]     = useState("");
  const startTimeRef = useRef(0);

  // right panel
  const [rightTab,     setRightTab]     = useState<RightTab>("raw");
  const [rightVisible, setRightVisible] = useState(true);
  const [rawNode,      setRawNode]      = useState<React.ReactNode>(
    <p className="text-xs text-gray-400 italic">ข้อมูลดิบจาก SQL tools จะแสดงที่นี่หลังจากส่งคำถาม</p>
  );
  const [dynLimits, setDynLimits] = useState<string[]>([]);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);

  // resize
  const [leftWidth, setLeftWidth] = useState(288);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const msgIdRef   = useRef(0);

  const scrollBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollBottom(); }, [messages, scrollBottom]);

  useEffect(() => {
    fetch("/api/accident-chat/provinces")
      .then((r) => r.json())
      .then((d) => setProvinces(d.provinces || []))
      .catch(() => {});

    fetch("/api/accident-chat/districts")
      .then((r) => r.json())
      .then((d) => setAllDistricts(d.grouped || {}))
      .catch(() => {});

    fetch("/api/accident-chat/sample-questions")
      .then((r) => r.json())
      .then((d) => setQuestions(d.groups || []))
      .catch(() => {});
  }, []);

  // ── Send question ───────────────────────────────────────────────────────────
  async function sendQuestion() {
    if (isLoading) return;
    const q = inputText.trim();
    if (!q) return;

    setInputText("");
    const botId = `msg-${++msgIdRef.current}`;

    setMessages((prev) => [
      ...prev,
      { id: `msg-${msgIdRef.current - 1}`, role: "user", content: q },
      { id: botId, role: "bot", content: "", loading: true },
    ]);

    setIsLoading(true);
    setShowThinking(true);
    setElapsedStr("");
    setStepPills([
      { name: "Accident SQL Agent",    status: "idle" },
      { name: "Accident Answer Writer", status: "idle" },
    ]);
    setRawNode(<p className="text-xs text-indigo-500 italic">กำลังดึงข้อมูล...</p>);
    setDynLimits([]);
    setToolsUsed([]);
    startTimeRef.current = Date.now();

    try {
      const resp = await fetch("/api/accident-chat/ask/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, province, district, year_start: yearStart, year_end: yearEnd }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId ? { ...m, loading: false, content: `**เกิดข้อผิดพลาด:** ${err.detail?.error ?? err.error ?? resp.statusText}` } : m
          )
        );
        return;
      }

      const reader  = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let gotResult = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop()!;

        for (const part of parts) {
          if (!part.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(part.slice(5).trim());

            if (ev.type === "start") {
              startTimeRef.current = Date.now();
            } else if (ev.type === "progress") {
              const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
              setElapsedStr(`${elapsed}s`);
              setStepPills((prev) => {
                const exists = prev.some((p) => p.name === ev.agent_name);
                const updated = { name: ev.agent_name, status: ev.status as StepStatus, message: ev.message };
                return exists
                  ? prev.map((p) => (p.name === ev.agent_name ? updated : p))
                  : [...prev, updated];
              });
            } else if (ev.type === "result") {
              gotResult = true;
              const d = ev.data;
              const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
              setStepPills((prev) => prev.map((p) => ({ ...p, status: "done" })));
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botId
                    ? { ...m, loading: false, content: d.answer, limitations: d.data_limitations, elapsed }
                    : m
                )
              );
              setRawNode(
                d.raw_data?.trim() ? (
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words leading-relaxed font-mono">
                    {d.raw_data}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-400 italic">ไม่มีข้อมูลดิบ</p>
                )
              );
              setDynLimits(d.data_limitations || []);
              setToolsUsed(d.tools_used || []);
            } else if (ev.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botId ? { ...m, loading: false, content: `**เกิดข้อผิดพลาด:** ${ev.message}` } : m
                )
              );
            }
          } catch {}
        }
      }

      if (!gotResult) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId ? { ...m, loading: false, content: "ไม่ได้รับผลลัพธ์จาก pipeline" } : m
          )
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId ? { ...m, loading: false, content: `**เกิดข้อผิดพลาด:** ${msg}` } : m
        )
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => setShowThinking(false), 2000);
    }
  }

  // ── Quick preview ───────────────────────────────────────────────────────────
  async function quickPreview(tool: string) {
    setRightTab("raw");
    setRawNode(<p className="text-xs text-indigo-500">กำลังดึงข้อมูล...</p>);
    try {
      const resp = await fetch("/api/accident-chat/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, province, district, year_start: yearStart, year_end: yearEnd, year: yearEnd, top_n: 10 }),
      });
      const d = await resp.json();
      setRawNode(
        resp.ok ? (
          <>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">[{tool}] {province || "Zone 10"}</p>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words leading-relaxed font-mono">
              {d.data || "ไม่มีข้อมูล"}
            </pre>
          </>
        ) : (
          <p className="text-xs text-red-500">Error: {d.detail?.error ?? "unknown"}</p>
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "error";
      setRawNode(<p className="text-xs text-red-500">ไม่สามารถเชื่อมต่อ: {msg}</p>);
    }
  }

  // ── Resize handle ───────────────────────────────────────────────────────────
  function startResize(e: React.MouseEvent) {
    const startX = e.clientX;
    const startW = leftWidth;
    const onMove = (ev: MouseEvent) => {
      setLeftWidth(Math.max(180, Math.min(420, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── District <select> ───────────────────────────────────────────────────────
  const districtSelect = province ? (
    (allDistricts[province] ?? []).map((d) => (
      <option key={d} value={d}>{d}</option>
    ))
  ) : (
    Object.entries(allDistricts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prov, dists]) => (
        <optgroup key={prov} label={prov}>
          {dists.map((d) => <option key={d} value={d}>{d}</option>)}
        </optgroup>
      ))
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }}>

      {/* ── Header ── */}
      <header className="bg-indigo-700 text-white px-5 py-3 shadow-md flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold leading-tight">🚗 Accident Chat — เขตสุขภาพที่ 10</h1>
            <p className="text-indigo-200 text-xs mt-0.5">อุบลราชธานี · ศรีสะเกษ · ยโสธร · อำนาจเจริญ · มุกดาหาร</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-indigo-300">
            <span>สำหรับ สสจ./ศปถ./สสส.</span>
            <a href="/accident-policy" className="hover:text-white underline">Policy Report →</a>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ── */}
        <aside
          className="flex-shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-hidden"
          style={{ width: leftWidth }}
        >
          {/* Filters */}
          <div className="p-4 border-b border-gray-100 flex-shrink-0 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">จังหวัด</label>
              <select
                value={province}
                onChange={(e) => { setProvince(e.target.value); setDistrict(""); }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              >
                <option value="">ทั้งเขต 10 (ทุกจังหวัด)</option>
                {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">อำเภอ</label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              >
                <option value="">ทุกอำเภอ</option>
                {districtSelect}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">ปีเริ่มต้น (ค.ศ.)</label>
                <input
                  type="number" value={yearStart} min={2020} max={2026}
                  onChange={(e) => setYearStart(Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">ปีสิ้นสุด (ค.ศ.)</label>
                <input
                  type="number" value={yearEnd} min={2020} max={2026}
                  onChange={(e) => setYearEnd(Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>
          </div>

          {/* Sample questions */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {questions.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-2">กำลังโหลดคำถาม...</p>
            )}
            {questions.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide px-2 pt-3 pb-1">
                  {group.label}
                </p>
                {group.questions.map((q) => (
                  <button
                    key={q.text}
                    onClick={() => setInputText(q.text)}
                    className="block w-full text-left px-2 py-1.5 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    {q.text}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          className="w-1 bg-gray-200 hover:bg-indigo-300 cursor-col-resize flex-shrink-0 transition-colors"
        />

        {/* ── Centre: chat ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Thinking bar */}
          {showThinking && (
            <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex-shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-indigo-600 mr-1">Agent:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {stepPills.map((pill) => (
                    <PillBadge key={pill.name} pill={pill} />
                  ))}
                </div>
                {elapsedStr && (
                  <span className="text-xs text-indigo-400 ml-auto">{elapsedStr}</span>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-gray-200 bg-white px-4 py-3 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(); }
                }}
                disabled={isLoading}
                placeholder="พิมพ์คำถามเชิงนโยบายอุบัติเหตุ... (Enter = ส่ง, Shift+Enter = ขึ้นบรรทัด)"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 resize-none outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 disabled:opacity-50"
              />
              <button
                onClick={sendQuestion}
                disabled={isLoading || !inputText.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium flex items-center gap-2 flex-shrink-0 transition-colors"
              >
                {isLoading
                  ? <Spinner size={14} />
                  : <span>➤</span>
                }
                <span>{isLoading ? "รอ..." : "ส่ง"}</span>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              ข้อมูล: ค.ศ. 2021-2026 | fact_accident_person ไม่มีข้อมูล | road_name ส่วนใหญ่ไม่ระบุ
            </p>
          </div>
        </div>

        {/* ── Right panel ── */}
        {rightVisible && (
          <aside className="w-80 flex-shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">ข้อมูลดิบ / Debug</span>
                <button
                  onClick={() => setRightVisible(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  ซ่อน
                </button>
              </div>
              <div className="flex gap-1">
                {(["raw", "limits", "tools"] as RightTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setRightTab(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      rightTab === t ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {t === "raw" ? "Raw SQL" : t === "limits" ? "ข้อจำกัด" : "Tools"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {rightTab === "raw" && rawNode}
              {rightTab === "limits" && (
                <div className="space-y-2">
                  {STATIC_LIMITS.map((l) => <LimitTag key={l} text={`⚠️ ${l}`} />)}
                  {dynLimits.map((l) => <LimitTag key={l} text={`⚠️ ${l}`} />)}
                </div>
              )}
              {rightTab === "tools" && (
                toolsUsed.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Tools used:</p>
                    <div className="space-y-1">
                      {toolsUsed.map((t) => (
                        <div key={t} className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-1">
                          ✓ {t}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">เครื่องมือที่ใช้จะแสดงที่นี่หลังจากได้รับคำตอบ</p>
                )
              )}
            </div>

            {/* Quick preview */}
            <div className="border-t border-gray-100 px-3 py-2.5 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-500 mb-2">ดูข้อมูลด่วน (ไม่ใช้ LLM)</p>
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_BTNS.map((btn) => (
                  <button
                    key={btn.key}
                    onClick={() => quickPreview(btn.key)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                      btn.purple
                        ? "bg-purple-50 hover:bg-purple-100 text-purple-700"
                        : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Show right panel button */}
      {!rightVisible && (
        <button
          onClick={() => setRightVisible(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-1.5 py-4 rounded-l-lg text-xs shadow-lg"
          title="แสดง Debug Panel"
        >
          ◀
        </button>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ChatBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end gap-3 animate-[fadeUp_0.3s_ease-in]">
        <div className="bg-indigo-600 text-white rounded-[18px] rounded-br-[4px] px-4 py-2.5 max-w-xl shadow-sm text-sm leading-relaxed">
          {message.content}
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 text-sm">👤</div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-[fadeUp_0.3s_ease-in]">
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white text-sm">🚗</div>
      <div className="bg-white border border-indigo-100 rounded-[18px] rounded-bl-[4px] px-4 py-3 max-w-3xl shadow-sm flex-1 min-w-0">
        {message.loading ? (
          <div className="flex items-center gap-2 text-indigo-400 text-sm">
            <Spinner size={16} />
            <span>กำลังวิเคราะห์...</span>
          </div>
        ) : (
          <>
            <div
              className="prose-ac text-sm"
              dangerouslySetInnerHTML={{ __html: renderMd(message.content) }}
            />
            {!!message.limitations?.length && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {message.limitations.map((l) => <LimitTag key={l} text={`⚠️ ${l}`} />)}
              </div>
            )}
            {message.elapsed && (
              <p className="text-xs text-gray-400 mt-2">⏱ {message.elapsed}s</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PillBadge({ pill }: { pill: StepPill }) {
  const cls: Record<StepStatus, string> = {
    idle:    "bg-gray-100 text-gray-400",
    running: "bg-indigo-100 text-indigo-700",
    done:    "bg-green-100 text-green-700",
    error:   "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cls[pill.status]} ${pill.status === "running" ? "animate-pulse" : ""}`}>
      {pill.status === "running" && <Spinner size={12} />}
      {pill.status === "done"    && "✓"}
      {pill.status === "error"   && "✗"}
      {agentIcon(pill.name)} {pill.name}
      {pill.message && <span className="opacity-70">— {pill.message.substring(0, 30)}</span>}
    </span>
  );
}

function LimitTag({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-xs px-2.5 py-0.5">
      {text}
    </div>
  );
}

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full border-[3px] border-current/20 border-t-current animate-spin flex-shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
