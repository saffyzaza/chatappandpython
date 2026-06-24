/**
 * ThaiJo Report Store — global state สำหรับ Journal Report ที่สร้างจาก ThaiJo pipeline
 * ใช้ CustomEvent เพื่อ notify subscribers (เหมือน streamingStore)
 */
import type { ThaiJoReportJson } from "./journal-template/buildJournalHtml";

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

export type ThaijoTextStreamDetail = { reset: boolean; chunk: string; done?: boolean; showWizard?: boolean; label?: string };

export function startThaijoTextStream(showWizard = false, label?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ThaijoTextStreamDetail>(THAIJO_TEXT_EVENT, {
      detail: { reset: true, chunk: "", showWizard, label },
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
