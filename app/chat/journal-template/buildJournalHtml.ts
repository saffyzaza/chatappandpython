import { JOURNAL_HTML_STYLES } from "./journalHtmlStyles";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ThaiJoReportJson {
  title: string;
  subtitle?: string;
  journal_name?: string;
  volume_info?: string;
  authors?: string[];
  affiliations?: string[];
  corresponding?: string;
  abstract_th: string;
  abstract_en?: string;
  keywords_th?: string[];
  keywords_en?: string[];
  introduction?: string[];
  methods?: string[];
  results?: { heading: string; paragraphs: string[] }[];
  table_head?: string[];
  table_rows?: string[][];
  discussion?: string[];
  recommendation?: string[];
  fig1_cap?: string;
  fig2_cap?: string;
  references?: string[];
  source_count?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const esc = (s: string) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const paras = (arr: string[] | undefined) =>
  (arr ?? []).map((p) => `<p class="body-para">${esc(p)}</p>`).join("\n");

const twoCol = (left: string, right: string) => `
<div class="two-col">
  <div class="col">${left}</div>
  <div class="col">${right}</div>
</div>`;

// Split an array in half for two-column layout
const splitHalf = <T>(arr: T[]): [T[], T[]] => {
  const mid = Math.ceil(arr.length / 2);
  return [arr.slice(0, mid), arr.slice(mid)];
};

// ── Additional styles (data table) ────────────────────────────────────────────

const EXTRA_STYLES = `
  .data-table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 10px 0; }
  .data-table th { background: #1a3c6e; color: #fff; padding: 5px 8px; text-align: center; font-weight: 600; }
  .data-table td { border: 1px solid #ccc; padding: 4px 8px; text-align: center; }
  .data-table tr:nth-child(even) td { background: #f5f8fc; }
  .section-heading-sub { font-size: 13px; font-weight: 700; margin: 10px 0 4px; color: #1a3c6e; }
  .rec-list { padding-left: 1.4em; font-size: 13px; line-height: 1.75; margin-bottom: 6px; }
  .rec-list li { margin-bottom: 4px; }
  .source-badge { display: inline-block; background: #e8f5ee; color: #1a6b3c; border: 1px solid #aad5b8;
    border-radius: 12px; font-size: 11px; padding: 2px 10px; margin-top: 6px; font-weight: 600; }
`;

// ── Page builders ──────────────────────────────────────────────────────────────

function buildPage1(r: ThaiJoReportJson): string {
  const journalName = r.journal_name || "วารสารวิจัยสาธารณสุข";
  const volumeInfo  = r.volume_info  || "";
  const authors     = (r.authors ?? []).join(", ") || "—";
  const affiliations= (r.affiliations ?? []).map((a) => `<div>${esc(a)}</div>`).join("") || "";
  const corresponding = r.corresponding ? `*Corresponding: ${esc(r.corresponding)}` : "";

  const kwTh = (r.keywords_th ?? []).map((k, i) => `${i + 1}. ${esc(k)}`).join(" &nbsp; ") || "";
  const kwEn = (r.keywords_en ?? []).map((k, i) => `${i + 1}. ${esc(k)}`).join(" &nbsp; ") || "";

  const srcBadge = r.source_count
    ? `<div style="margin-top:8px;"><span class="source-badge">📄 ค้นจาก ThaiJo · ${r.source_count} บทความ</span></div>`
    : "";

  return `
<div class="page" id="page1">
  <div class="journal-header-p1">
    <div class="tag-research">Research Synthesis · AI-Generated</div>
    <div class="journal-logo-box">
      <div class="journal-name">${esc(journalName)}</div>
      <div class="journal-vol">${esc(volumeInfo)}</div>
    </div>
  </div>
  <div class="article-title">${esc(r.title)}</div>
  ${r.subtitle ? `<div class="article-title" style="font-size:13px;font-weight:400;font-style:italic;">${esc(r.subtitle)}</div>` : ""}
  <div class="authors">${esc(authors)}</div>
  ${affiliations ? `<div class="affiliations">${affiliations}</div>` : ""}
  ${corresponding ? `<div class="corresponding">${esc(corresponding)}</div>` : ""}
  ${srcBadge}
  <div class="section-heading">บทคัดย่อ</div>
  <p class="body-para">${esc(r.abstract_th)}</p>
  ${r.abstract_en ? `<p class="body-para" style="font-style:italic;color:#333;">${esc(r.abstract_en)}</p>` : ""}
  ${kwTh ? `<p class="keywords"><span class="kw-label">คำสำคัญ :</span> ${kwTh}</p>` : ""}
  ${kwEn ? `<p class="keywords"><span class="kw-label">Keywords :</span> ${kwEn}</p>` : ""}
  <div class="footer-p1">
    <div class="suj-logo" style="font-size:7px;">TJ</div>
    <div class="footer-text">ThaiJo AI Research Synthesis · Powered by Gemini</div>
  </div>
</div>`;
}

function buildPage2(r: ThaiJoReportJson): string {
  // Build introduction two-col
  const intro = r.introduction ?? [];
  const [introL, introR] = splitHalf(intro);

  // Build methods
  const methods = r.methods ?? [];

  // Build results
  const results = r.results ?? [];
  const resultsHtml = results
    .map((sec) =>
      `<div class="section-heading-sub">${esc(sec.heading)}</div>${paras(sec.paragraphs)}`
    )
    .join("\n");

  // Build table
  let tableHtml = "";
  if ((r.table_head ?? []).length > 0 && (r.table_rows ?? []).length > 0) {
    const ths = (r.table_head ?? []).map((h) => `<th>${esc(h)}</th>`).join("");
    const trs = (r.table_rows ?? [])
      .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("\n");
    tableHtml = `<table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }

  // Figure placeholders
  const fig1 = r.fig1_cap
    ? `<div class="figure-wrap">
        <div class="figure-placeholder">[กราฟ/ภาพ: ${esc(r.fig1_cap)}]</div>
        <p class="figure-caption"><strong>ภาพที่ 1</strong> ${esc(r.fig1_cap)}</p>
       </div>`
    : "";

  const leftCol  = (intro.length > 0 ? `<div class="section-heading">บทนำ</div>${paras(introL)}` : "")
                 + (methods.length > 0 ? `<div class="section-heading">วิธีดำเนินการวิจัย</div>${paras(methods)}` : "")
                 + resultsHtml.slice(0, resultsHtml.length / 2 | 0);

  const rightCol = paras(introR)
                 + resultsHtml.slice(resultsHtml.length / 2 | 0)
                 + (tableHtml ? `<div class="section-heading">ตารางสรุปข้อมูล</div>${tableHtml}` : "")
                 + fig1;

  return `
<div class="page page-body" id="page2">
  <div class="page-header">
    <div class="logo-left">
      <div class="logo-circle">TJ</div>
      <div class="logo-text-stack">ThaiJo<br>Research<br>Synthesis</div>
    </div>
    <div class="vol-right">${esc(r.title.slice(0, 60))}${r.title.length > 60 ? "..." : ""}</div>
  </div>
  ${twoCol(leftCol, rightCol)}
  <div class="page-number">2</div>
</div>`;
}

function buildPage3(r: ThaiJoReportJson): string {
  const discussion = r.discussion ?? [];
  const recommendations = r.recommendation ?? [];
  const refs = r.references ?? [];

  const recHtml = recommendations.length
    ? `<div class="section-heading">ข้อเสนอแนะ</div>
       <ul class="rec-list">${recommendations.map((rc) => `<li>${esc(rc)}</li>`).join("")}</ul>`
    : "";

  const refHtml = refs.length
    ? `<div class="section-heading full-width">เอกสารอ้างอิง</div>
       <ol class="ref-list full-width">${refs.filter(Boolean).map((ref) => `<li>${esc(ref)}</li>`).join("")}</ol>`
    : "";

  const fig2 = r.fig2_cap
    ? `<div class="figure-wrap">
        <div class="figure-placeholder">[กราฟ/ภาพ: ${esc(r.fig2_cap)}]</div>
        <p class="figure-caption"><strong>ภาพที่ 2</strong> ${esc(r.fig2_cap)}</p>
       </div>`
    : "";

  const [discL, discR] = splitHalf(discussion);

  return `
<div class="page page-body" id="page3">
  <div class="page-running-title">
    <span>${esc(r.title.slice(0, 50))}${r.title.length > 50 ? "..." : ""}</span>
    <span>ThaiJo AI Synthesis</span>
  </div>
  ${twoCol(
    `<div class="section-heading">อภิปรายผล</div>${paras(discL)}`,
    `${paras(discR)}${fig2}${recHtml}`
  )}
  <div class="two-col">${refHtml}</div>
  <div class="page-number">3</div>
</div>`;
}

// ── Main Builder ───────────────────────────────────────────────────────────────

export function buildJournalHtml(report: ThaiJoReportJson): string {
  const p1 = buildPage1(report);
  const p2 = buildPage2(report);
  const p3 = buildPage3(report);

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(report.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<style>
${JOURNAL_HTML_STYLES}
${EXTRA_STYLES}
</style>
</head>
<body>
${p1}
${p2}
${p3}
</body>
</html>`;
}
