/**
 * Global store for files attached to chat via DatabaseExplorer.
 * Follows the same useSyncExternalStore pattern as thaijoStore.ts
 */

export type AttachedFile = {
  id: string
  name: string
  extension: string
  previewUrl?: string   // blob URL สำหรับ thumbnail รูปภาพ
}

let _files: AttachedFile[] = []
const _listeners = new Set<() => void>()

function _notify() {
  _listeners.forEach((fn) => fn())
}

export function subscribeAttachedFiles(listener: () => void): () => void {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

export function getAttachedFiles(): AttachedFile[] {
  return _files
}

export function attachFile(file: AttachedFile): void {
  if (_files.find((f) => f.id === file.id)) return
  _files = [..._files, file]
  _notify()
}

export function detachFile(id: string): void {
  _files = _files.filter((f) => f.id !== id)
  _notify()
}

export function clearAttachedFiles(): void {
  _files = []
  _notify()
}
