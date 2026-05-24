type Listener = () => void;

let _draft = "";
const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach((fn) => fn());
}

export function subscribeDraft(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getDraft(): string {
  return _draft;
}

export function setDraft(text: string): void {
  _draft = text;
  notify();
}

export function clearDraft(): void {
  _draft = "";
  notify();
}
