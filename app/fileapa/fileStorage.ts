/**
 * File Storage using MinIO (via API routes)
 * Files are stored server-side in MinIO object storage
 */

import type { ApaResult } from './apaTypes'

export type StoredFile = {
  id: string
  name: string
  path: string
  extension: string
  size: number
  previewKind: 'pdf' | 'csv' | 'xlsx' | 'text' | 'unsupported'
  uploadedAt: number
  apa: ApaResult | null
}

export async function saveFile(file: File, path: string): Promise<StoredFile> {
  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}&filename=${encodeURIComponent(file.name)}&mime=${encodeURIComponent(file.type)}&size=${file.size}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Length': file.size.toString()
    },
    body: file,
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || 'Upload failed')
  }

  return res.json() as Promise<StoredFile>
}

/**
 * Get metadata for a single file
 */
export async function getFile(id: string): Promise<StoredFile | null> {
  const res = await fetch(`/api/files/${id}?meta=1`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch file')
  return res.json() as Promise<StoredFile>
}

/**
 * Get all files
 */
export async function getAllFiles(): Promise<StoredFile[]> {
  const res = await fetch('/api/files')
  if (!res.ok) throw new Error('Failed to list files')
  return res.json() as Promise<StoredFile[]>
}

/**
 * Delete a file by ID
 */
export async function deleteFile(id: string): Promise<void> {
  const res = await fetch(`/api/files/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}

/**
 * Update file metadata (e.g., rename)
 */
export async function updateFile(
  id: string,
  updates: Partial<Pick<StoredFile, 'name' | 'path' | 'extension' | 'previewKind'>>,
): Promise<void> {
  const res = await fetch(`/api/files/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Update failed')
}
