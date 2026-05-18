"use client";
import { useState } from "react";

type MarkdownContentProps = {
  text: string;
  className?: string;
};

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`\n]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|~~[^~]+~~)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    const m = match[0];
    if (m.startsWith("`")) {
      parts.push(
        <code key={key++} className="bg-gray-100 text-[#d63384] px-1.5 py-0.5 rounded font-mono text-[0.82em]">
          {m.slice(1, -1)}
        </code>,
      );
    } else if (m.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-gray-900">
          {m.slice(2, -2)}
        </strong>,
      );
    } else if (m.startsWith("*")) {
      parts.push(
        <em key={key++} className="italic">
          {m.slice(1, -1)}
        </em>,
      );
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

function BarChart({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const numericColIndex = headers.slice(1).findIndex((_, i) =>
    rows.every((row) => isNumericCell(row[i + 1] || "")),
  );

  if (numericColIndex === -1) return null;

  const colIndex = numericColIndex + 1;
  const values = rows.map((row) => parseNumber(row[colIndex] || "0"));
  const maxVal = Math.max(...values, 1);
  const labels = rows.map((row) => row[0] || "");
  const colors = ["#eb6f45", "#f0a882", "#d4845a", "#c4623a", "#b34f2a", "#a03d1f"];

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        {headers[colIndex]}
      </div>
      <div className="space-y-2">
        {labels.map((label, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-24 text-right text-gray-500 truncate shrink-0 text-[11px]">{label}</div>
            <div className="flex-1 bg-gray-200 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center px-2 text-white text-[10px] font-medium"
                style={{
                  width: `${Math.max((values[i] / maxVal) * 100, 5)}%`,
                  backgroundColor: colors[i % colors.length],
                  transition: "width 0.6s ease",
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

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const [showChart, setShowChart] = useState(false);

  const hasNumeric =
    headers.length > 1 &&
    headers.slice(1).some((_, i) => rows.every((row) => isNumericCell(row[i + 1] || "")));

  return (
    <div className="my-3">
      {hasNumeric && (
        <div className="flex justify-end mb-1">
          <button
            onClick={() => setShowChart((v) => !v)}
            className="text-[10px] px-2 py-0.5 rounded-full border border-[#eb6f45]/30 text-[#eb6f45] hover:bg-[#fff4ef] transition-colors flex items-center gap-1"
          >
            {showChart ? "📋 ตาราง" : "📊 กราฟ"}
          </button>
        </div>
      )}
      {showChart ? (
        <BarChart headers={headers} rows={rows} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap text-xs">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-gray-600 text-xs border-b border-gray-100">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                <pre className="bg-gray-900 text-gray-100 p-3 overflow-x-auto text-xs font-mono leading-relaxed whitespace-pre">
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
