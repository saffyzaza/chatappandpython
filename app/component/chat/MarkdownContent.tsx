"use client";
import { useState } from "react";

type MarkdownContentProps = {
  text: string;
  className?: string;
};

const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 shrink-0 inline-block">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

function urlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 20);
  }
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // จับ: markdown link | code | bold | italic | strikethrough | bare URL
  const regex = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\)|`[^`\n]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|~~[^~]+~~|https?:\/\/[^\s)]+)/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }

    const m = match[0];

    if (m.startsWith("[")) {
      // [label](url)
      const label = match[2] ?? "";
      const url   = match[3] ?? "";
      const short = label.length > 40 ? label.slice(0, 38) + "…" : label;
      parts.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-0.5 text-[#eb6f45] hover:text-[#c85f35] hover:underline transition-colors">
          <span>{short}</span><ExternalLinkIcon />
        </a>,
      );
    } else if (m.startsWith("http")) {
      // bare URL → แสดงแค่ domain
      parts.push(
        <a key={key++} href={m} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-0.5 text-[#eb6f45] hover:text-[#c85f35] hover:underline transition-colors">
          <span>{urlDomain(m)}</span><ExternalLinkIcon />
        </a>,
      );
    } else if (m.startsWith("`")) {
      parts.push(
        <code key={key++} className="bg-gray-100 text-[#d63384] px-1.5 py-0.5 rounded font-mono text-[0.82em]">
          {m.slice(1, -1)}
        </code>,
      );
    } else if (m.startsWith("**")) {
      parts.push(<strong key={key++} className="font-semibold text-gray-900">{m.slice(2, -2)}</strong>);
    } else if (m.startsWith("*")) {
      parts.push(<em key={key++} className="italic">{m.slice(1, -1)}</em>);
    } else if (m.startsWith("~~")) {
      parts.push(<del key={key++}>{m.slice(2, -2)}</del>);
    }

    lastIndex = match.index + m.length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

function isNumericCell(str: string): boolean {
  return /^-?[\d,]+\.?\d*%?$/.test(str.trim()) && str.trim() !== "";
}

function parseNumber(str: string): number {
  return parseFloat(str.replace(/[,%]/g, "")) || 0;
}

const CHART_COLORS = [
  "#eb6f45", "#4f8ef7", "#22c55e", "#f59e0b", "#a855f7",
  "#06b6d4", "#ef4444", "#84cc16", "#ec4899", "#14b8a6",
];

function BarChart({ headers, rows, colIndex }: { headers: string[]; rows: string[][]; colIndex: number }) {
  const values = rows.map((row) => parseNumber(row[colIndex] || "0"));
  const maxVal = Math.max(...values, 1);
  // Use first non-numeric column (skip rank numbers)
  const labelColIdx = headers.findIndex((_, i) =>
    i !== colIndex && rows.length > 0 && !rows.every((r) => isNumericCell(r[i] || ""))
  );
  const labelCol = labelColIdx >= 0 ? labelColIdx : 0;
  const labels = rows.map((row) => row[labelCol] || "");

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        {headers[colIndex]}
      </div>
      <div className="space-y-2">
        {labels.map((label, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-24 text-right text-gray-500 truncate shrink-0 text-[11px]">{label}</div>
            <div className="flex-1 bg-gray-200 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center px-2 text-white text-[10px] font-medium transition-all duration-700"
                style={{
                  width: `${Math.max((values[i] / maxVal) * 100, 5)}%`,
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                }}
              >
                {rows[i][colIndex]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieChart({ headers, rows, colIndex }: { headers: string[]; rows: string[][]; colIndex: number }) {
  const values = rows.map((row) => parseNumber(row[colIndex] || "0"));
  const total = values.reduce((s, v) => s + v, 0) || 1;
  // Use first non-numeric column (skip rank numbers)
  const labelColIdx = headers.findIndex((_, i) =>
    i !== colIndex && rows.length > 0 && !rows.every((r) => isNumericCell(r[i] || ""))
  );
  const labelCol = labelColIdx >= 0 ? labelColIdx : 0;
  const labels = rows.map((row) => row[labelCol] || "");

  // Build SVG pie slices
  const cx = 80, cy = 80, r = 72;
  let cumAngle = -Math.PI / 2; // start at top

  const slices = values.map((val, i) => {
    const angle = (val / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
    // label position (middle of arc)
    const midAngle = cumAngle - angle / 2;
    const lx = cx + (r * 0.62) * Math.cos(midAngle);
    const ly = cy + (r * 0.62) * Math.sin(midAngle);
    return { x1, y1, x2, y2, largeArc, pct, lx, ly, angle, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
        {headers[colIndex]}
      </div>
      <div className="flex flex-wrap gap-4 items-start justify-center">
        {/* SVG Pie */}
        <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
          {slices.map((s, i) =>
            s.angle < 0.001 ? null : (
              <g key={i}>
                <path
                  d={`M ${cx} ${cy} L ${s.x1} ${s.y1} A ${r} ${r} 0 ${s.largeArc} 1 ${s.x2} ${s.y2} Z`}
                  fill={s.color}
                  stroke="white"
                  strokeWidth="1.5"
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                />
                {s.angle > 0.25 && (
                  <text
                    x={s.lx}
                    y={s.ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill="white"
                  >
                    {s.pct}%
                  </text>
                )}
              </g>
            ),
          )}
        </svg>
        {/* Legend */}
        <div className="flex flex-col gap-1.5 min-w-0 max-w-45">
          {labels.map((label, i) => {
            const pct = total > 0 ? ((values[i] / total) * 100).toFixed(1) : "0";
            return (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="text-gray-600 truncate">{label}</span>
                <span className="text-gray-400 shrink-0 ml-auto pl-1">
                  {rows[i][colIndex]} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type ChartView = "table" | "bar" | "pie";

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const [view, setView] = useState<ChartView>("table");

  // Find first fully-numeric column (skip col 0 = labels)
  const numericColIndex = headers.slice(1).findIndex((_, i) =>
    rows.every((row) => isNumericCell(row[i + 1] || "")),
  );
  const hasNumeric = headers.length > 1 && numericColIndex !== -1;
  const colIndex = numericColIndex + 1;

  return (
    <div className="my-3 w-fit">
      {hasNumeric && (
        <div className="flex justify-end mb-1 gap-1">
          {(["table", "bar", "pie"] as ChartView[]).map((v) => {
            const icons: Record<ChartView, string> = { table: "📋", bar: "📊", pie: "🥧" };
            const labels: Record<ChartView, string> = { table: "ตาราง", bar: "แท่ง", pie: "วงกลม" };
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors flex items-center gap-0.5 ${
                  view === v
                    ? "bg-[#eb6f45] border-[#eb6f45] text-white"
                    : "border-[#eb6f45]/30 text-[#eb6f45] hover:bg-[#fff4ef]"
                }`}
              >
                {icons[v]} {labels[v]}
              </button>
            );
          })}
        </div>
      )}

      {view === "table" && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 max-w-full">
          <table className="w-auto text-[11px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {headers.map((h, i) => (
                  <th key={i} className="px-2 py-1.5 text-left font-semibold text-gray-700 max-w-[100px] break-words leading-tight">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1.5 text-gray-600 border-b border-gray-100 whitespace-nowrap">
                      {cell.split(/<br\s*\/?>/i).map((part, pi, arr) => (
                        <span key={pi}>{renderInline(part)}{pi < arr.length - 1 && <br />}</span>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "bar" && hasNumeric && (
        <BarChart headers={headers} rows={rows} colIndex={colIndex} />
      )}

      {view === "pie" && hasNumeric && (
        <PieChart headers={headers} rows={rows} colIndex={colIndex} />
      )}
    </div>
  );
}

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code_block"; lang: string; code: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "hr" };

function parseMarkdown(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code_block", lang, code: codeLines.join("\n") });
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4) });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3) });
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2) });
      i++;
      continue;
    }

    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [line.slice(2)];
      i++;
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join("\n") });
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && /^\|?[-: |]+\|?$/.test(lines[i + 1])) {
      const headers = line
        .split("|")
        .map((h) => h.trim())
        .filter(Boolean);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const row = lines[i]
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean);
        if (row.length > 0) rows.push(row);
        i++;
      }
      if (rows.length > 0) blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^[-*+] /.test(line)) {
      const items: string[] = [line.replace(/^[-*+] /, "")];
      i++;
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+] /, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = [line.replace(/^\d+\. /, "")];
      i++;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !lines[i].startsWith("```") &&
      !lines[i].includes("|") &&
      !/^[-*+] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !/^[-*_]{3,}$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join(" ") });
  }

  return blocks;
}

export function MarkdownContent({ text, className = "" }: MarkdownContentProps) {
  const blocks = parseMarkdown(text);

  return (
    <div className={`text-sm leading-relaxed text-gray-700 ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "h1":
            return (
              <h1 key={idx} className="text-base font-bold text-gray-900 mt-3 mb-1.5 first:mt-0">
                {renderInline(block.text)}
              </h1>
            );
          case "h2":
            return (
              <h2
                key={idx}
                className="text-sm font-bold text-gray-900 mt-3 mb-1.5 first:mt-0 border-b border-gray-100 pb-1"
              >
                {renderInline(block.text)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={idx} className="text-sm font-semibold text-gray-800 mt-2 mb-1 first:mt-0">
                {renderInline(block.text)}
              </h3>
            );
          case "paragraph":
            return (
              <p key={idx} className="mb-2 last:mb-0">
                {renderInline(block.text)}
              </p>
            );
          case "code_block":
            return (
              <div key={idx} className="my-2 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                {block.lang && (
                  <div className="bg-gray-800 text-gray-300 text-[10px] px-3 py-1.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="ml-2 font-mono opacity-70">{block.lang}</span>
                  </div>
                )}
                <pre className="bg-gray-900 text-gray-100 p-2 overflow-x-auto overflow-y-auto max-h-44 text-[11px] font-mono leading-relaxed whitespace-pre w-full max-w-160">
                  <code>{block.code}</code>
                </pre>
              </div>
            );
          case "table":
            return <TableBlock key={idx} headers={block.headers} rows={block.rows} />;
          case "ul":
            return (
              <ul key={idx} className="mb-2 space-y-1">
                {block.items.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[#eb6f45] mt-0.5 shrink-0 font-bold">•</span>
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={idx} className="mb-2 space-y-1">
                {block.items.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[#eb6f45] font-semibold shrink-0 w-4 text-right">{i + 1}.</span>
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case "blockquote":
            return (
              <blockquote key={idx} className="my-2 pl-3 border-l-2 border-[#eb6f45]/40 text-gray-500 italic">
                {renderInline(block.text)}
              </blockquote>
            );
          case "hr":
            return <hr key={idx} className="my-3 border-gray-200" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
