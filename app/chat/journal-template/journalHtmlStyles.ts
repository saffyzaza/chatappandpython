export const JOURNAL_HTML_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun','TH Sarabun New',sans-serif; font-size: 14px; line-height: 1.65; color: #111; background: #d0d0d0; }
  .page { width: 760px; min-height: 1040px; margin: 20px auto; background: #fff; padding: 36px 36px 48px 36px; box-shadow: 0 2px 16px rgba(0,0,0,0.18); position: relative; }
  .tag-research { font-size: 13px; font-weight: 600; color: #c0392b; font-style: italic; margin-bottom: 6px; }
  .journal-header-p1 { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
  .journal-logo-box { border: 1.5px solid #1a3c6e; padding: 6px 10px; font-size: 11px; font-weight: 700; color: #1a3c6e; text-align: right; line-height: 1.4; min-width: 170px; }
  .journal-logo-box .journal-name { font-size: 11px; font-weight: 700; font-style: italic; }
  .journal-logo-box .journal-vol { font-size: 10px; font-weight: 400; }
  .article-title { font-size: 15px; font-weight: 700; text-align: center; margin: 12px 0 8px; line-height: 1.5; color: #111; }
  .authors { text-align: center; font-size: 13px; font-style: italic; margin-bottom: 4px; color: #222; }
  .affiliations { text-align: center; font-size: 12px; color: #333; line-height: 1.6; margin-bottom: 4px; }
  .corresponding { text-align: center; font-size: 12px; color: #333; margin-bottom: 14px; }
  .section-heading { font-size: 14px; font-weight: 700; margin: 12px 0 6px; color: #111; }
  .body-para { font-size: 13px; line-height: 1.75; margin-bottom: 6px; text-indent: 2em; text-align: justify; }
  .keywords { font-size: 12px; margin-top: 10px; }
  .keywords span.kw-label { font-weight: 700; }
  .footer-p1 { position: absolute; bottom: 14px; left: 36px; right: 36px; border-top: 1px solid #555; padding-top: 6px; display: flex; align-items: center; gap: 12px; }
  .footer-p1 .suj-logo { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 2px solid #1a3c6e; border-radius: 50%; font-size: 9px; font-weight: 700; color: #1a3c6e; flex-shrink: 0; }
  .footer-p1 .footer-text { font-size: 10px; color: #333; line-height: 1.5; }
  .page-body .page-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #999; padding-bottom: 5px; margin-bottom: 12px; font-size: 11px; }
  .page-header .logo-left { display: flex; align-items: center; gap: 6px; }
  .logo-circle { width: 28px; height: 28px; border: 2px solid #1a3c6e; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; color: #1a3c6e; flex-shrink: 0; }
  .logo-text-stack { font-size: 9px; font-weight: 700; color: #1a3c6e; line-height: 1.3; }
  .page-header .vol-right { font-size: 10px; color: #333; text-align: right; }
  .page-running-title { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-bottom: 10px; border-bottom: 0.5px solid #ccc; padding-bottom: 4px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .figure-wrap { margin: 12px 0; }
  .figure-placeholder { background: #eee; height: 130px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #888; border: 1px solid #ccc; }
  .figure-caption { font-size: 11px; margin-top: 4px; text-align: justify; line-height: 1.5; }
  .figure-caption strong { font-weight: 700; }
  .page-number { position: absolute; bottom: 10px; right: 36px; font-size: 11px; color: #444; }
  .full-width { grid-column: 1 / -1; }
  .ref-list { list-style: decimal; padding-left: 1.4em; font-size: 12px; line-height: 1.7; color: #111; }
  .ref-list li { margin-bottom: 8px; text-align: justify; word-break: break-all; }
  .ref-list a { color: #1a55a0; text-decoration: underline; word-break: break-all; }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; margin: 0; width: 100%; min-height: auto; page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    @page { size: A4; margin: 12mm 14mm; }
  }
`;
