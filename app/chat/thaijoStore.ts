/**
 * ThaiJo Report Store — global state สำหรับ Journal Report ที่สร้างจาก ThaiJo pipeline
 * ใช้ CustomEvent เพื่อ notify subscribers (เหมือน streamingStore)
 */
import type { ThaiJoReportJson } from "./journal-template/buildJournalHtml";
import type { WizardProgressSaved } from "./chatTypes";

const THAIJO_EVENT = "thaijo-report-updated";
const THAIJO_STREAM_EVENT = "thaijo-html-stream";

export type ThaiJoReportState = {
  reportJson: ThaiJoReportJson;
  reportHtml: string;
  sessionId: string;
  articleCount: number;
};

let _state: ThaiJoReportState | null = null;

// ── Write ──────────────────────────────────────────────────────────────────────

export function setThaijoReport(state: ThaiJoReportState | null): void {
  if (typeof window === "undefined") return;
  _state = state;
  window.dispatchEvent(new CustomEvent(THAIJO_EVENT));
}

// ── Read ───────────────────────────────────────────────────────────────────────

export function getThaijoReport(): ThaiJoReportState | null {
  return _state;
}

export function clearThaijoReport(): void {
  if (typeof window === "undefined") return;
  _state = null;
  window.dispatchEvent(new CustomEvent(THAIJO_EVENT));
}

// ── HTML Streaming helpers ────────────────────────────────────────────────────

export function startThaijoHtmlStream(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(THAIJO_STREAM_EVENT, { detail: { reset: true, chunk: "" } }));
}

export function appendThaijoHtmlChunk(chunk: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(THAIJO_STREAM_EVENT, { detail: { reset: false, chunk } }));
}

// ── Subscribe (useSyncExternalStore compatible) ────────────────────────────────

export function subscribeToThaijoReport(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(THAIJO_EVENT, onChange);
  return () => window.removeEventListener(THAIJO_EVENT, onChange);
}

// ── Search State (query + raw articles — used for report generation) ──────────

export type ThaijoSearchState = {
  query: string;
  articlesText: string;
  articleCount: number;
};

let _searchState: ThaijoSearchState | null = null;

const THAIJO_SEARCH_READY_EVENT = "thaijo-search-ready";

export function setThaijoSearchState(s: ThaijoSearchState): void {
  _searchState = s;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(THAIJO_SEARCH_READY_EVENT));
  }
}

export function getThaijoSearchState(): ThaijoSearchState | null {
  return _searchState;
}

/** ต่อท้ายบทความที่ได้จากปุ่ม "ลองใหม่" ของ badge เข้ากับ search state เดิม —
 * no-op ถ้ายังไม่มี search state (เช่น กดลองใหม่เร็วเกินกว่า final event หลักจะมาถึง) */
export function appendThaijoSearchArticles(articlesText: string, articleCountDelta = 0): void {
  if (!_searchState || !articlesText) return;
  _searchState = {
    ..._searchState,
    articlesText: _searchState.articlesText
      ? `${_searchState.articlesText}\n\n${articlesText}`
      : articlesText,
    articleCount: _searchState.articleCount + articleCountDelta,
  };
}

export function clearThaijoSearchState(): void {
  _searchState = null;
}

export function subscribeToSearchReady(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(THAIJO_SEARCH_READY_EVENT, onChange);
  return () => window.removeEventListener(THAIJO_SEARCH_READY_EVENT, onChange);
}

// ── Direct Wizard Open (from journal-report tool) ────────────────────────────

const THAIJO_WIZARD_EVENT = "thaijo-open-wizard";

export type ThaijoWizardDetail = { query: string };

export function openWizardDirect(query: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ThaijoWizardDetail>(THAIJO_WIZARD_EVENT, { detail: { query } }),
  );
}

export function subscribeToWizardOpen(onChange: (query: string) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (e: Event) => {
    const ev = e as CustomEvent<ThaijoWizardDetail>;
    onChange(ev.detail.query ?? "");
  };
  window.addEventListener(THAIJO_WIZARD_EVENT, handler);
  return () => window.removeEventListener(THAIJO_WIZARD_EVENT, handler);
}

// ── Text Streaming (article summaries) ────────────────────────────────────────

const THAIJO_TEXT_EVENT = "thaijo-text-stream";

export type ThaijoTextStreamDetail = { reset: boolean; chunk: string; done?: boolean; showWizard?: boolean; label?: string; docType?: string };

export function startThaijoTextStream(showWizard = false, label?: string, docType?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ThaijoTextStreamDetail>(THAIJO_TEXT_EVENT, {
      detail: { reset: true, chunk: "", showWizard, label, docType },
    }),
  );
}

export function appendThaijoTextChunk(chunk: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ThaijoTextStreamDetail>(THAIJO_TEXT_EVENT, {
      detail: { reset: false, chunk },
    }),
  );
}

export function finishThaijoTextStream(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ThaijoTextStreamDetail>(THAIJO_TEXT_EVENT, {
      detail: { reset: false, chunk: "", done: true },
    }),
  );
}

// ── Report Base Content (กู้คืนจาก DB หลัง reload) ────────────────────────────
// ต่างจาก text-stream ด้านบน (event-only, ไม่มีที่เก็บถาวร) — อันนี้เป็น pull-based
// store ให้ RightPane อ่านค่าปัจจุบันได้ทุกเมื่อผ่าน useSyncExternalStore ไม่ต้องพึ่ง
// จังหวะ event พอดีกับตอน mount

export type ReportBaseContent = {
  text: string;
  label: string;
  query: string;
  articlesText: string;
  articleCount: number;
  wizardProgress?: WizardProgressSaved;
};

const REPORT_BASE_EVENT = "thaijo-report-base-restored";
let _reportBase: ReportBaseContent | null = null;

export function setReportBaseContent(v: ReportBaseContent | null): void {
  _reportBase = v;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REPORT_BASE_EVENT));
  }
}

export function getReportBaseContent(): ReportBaseContent | null {
  return _reportBase;
}

export function subscribeToReportBaseContent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(REPORT_BASE_EVENT, onChange);
  return () => window.removeEventListener(REPORT_BASE_EVENT, onChange);
}
