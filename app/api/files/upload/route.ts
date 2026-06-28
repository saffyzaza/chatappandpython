import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import os from 'os'
import path from 'path'

function generateFileId(): string {
  const min = 100000
  const max = 999999
  return Math.floor(Math.random() * (max - min + 1) + min).toString()
}

function getTmpDir(): string {
  const dir = process.env.CHAT_UPLOAD_TMP_DIR || path.join(os.tmpdir(), 'chat_uploads')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getPreviewKind(fileName: string, mimeType: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  if (
    mimeType.startsWith('text/') ||
    ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css'].includes(ext)
  )
    return 'text'
  return 'unsupported'
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const fileId = generateFileId()
    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    const mimeType = file.type || 'application/octet-stream'
    const previewKind = getPreviewKind(file.name, mimeType)
    const uploadedAt = Date.now()

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // บันทึกไฟล์ลง local temp dir (ไม่ผ่าน MinIO)
    const tmpDir = getTmpDir()
    fs.writeFileSync(path.join(tmpDir, fileId), buffer)

    return NextResponse.json({
      id: fileId,
      name: file.name,
      extension,
      size: file.size,
      previewKind,
      uploadedAt,
    })
  } catch (error) {
    console.error('Upload error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
