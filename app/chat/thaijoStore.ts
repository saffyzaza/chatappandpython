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

export function setThaijoReport(state: ThaiJoReportState): void {
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
