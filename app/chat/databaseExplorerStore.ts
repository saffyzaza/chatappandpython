/** Global store — sync DatabaseExplorer visibility across ClientLayout & LeftPane */
let _open = false;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

export function getDatabaseExplorerOpen(): boolean {
  return _open;
}

export function toggleDatabaseExplorer(): void {
  _open = !_open;
  notify();
}

export function subscribeDatabaseExplorer(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
