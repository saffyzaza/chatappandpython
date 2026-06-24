import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { minioClient, BUCKET_NAME, ensureBucket } from '@/lib/minio'

function getTmpDir(): string {
  return process.env.CHAT_UPLOAD_TMP_DIR || path.join(os.tmpdir(), 'chat_uploads')
}

function generateFileId(): string {
  return Math.floor(Math.random() * 900000 + 100000).toString()
}

function getPreviewKind(ext: string): string {
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  return 'unsupported'
}

async function uploadToMinio(
  fileId: string,
  buffer: Buffer,
  meta: { name: string; path: string; extension: string; contentType: string; size: number },
) {
  await ensureBucket()
  const stream = Readable.from(buffer)
  await minioClient.putObject(BUCKET_NAME, fileId, stream, buffer.length, {
    'Content-Type': meta.contentType,
    'x-amz-meta-name': encodeURIComponent(meta.name.slice(0, 150)),
    'x-amz-meta-path': encodeURIComponent(meta.path.slice(0, 200)),
    'x-amz-meta-extension': meta.extension,
    'x-amz-meta-previewkind': getPreviewKind(meta.extension),
    'x-amz-meta-size': meta.size.toString(),
    'x-amz-meta-uploadedat': Date.now().toString(),
  })
}

// POST /api/files/merge/save
// Body (merge):  { mode: 'merge', existingFileId, mergedTempKey, fileName, suggestedOutputName? }
// Body (new):    { mode: 'new',   tempFileId, fileName, domain, subfolder }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      mode: 'merge' | 'new'
      existingFileId?: string
      mergedTempKey?: string
      tempFileId?: string
      fileName: string
      suggestedOutputName?: string   // new computed filename with updated year range
      domain?: string
      subfolder?: string
    }

    const tmpDir = getTmpDir()

    if (body.mode === 'merge') {
      const { existingFileId, mergedTempKey, fileName, suggestedOutputName } = body
      if (!existingFileId || !mergedTempKey || !fileName) {
        return NextResponse.json({ error: 'existingFileId, mergedTempKey, fileName required' }, { status: 400 })
      }

      const mergedPath = path.join(tmpDir, mergedTempKey)
      if (!fs.existsSync(mergedPath)) {
        return NextResponse.json({ error: 'Merged temp file not found — please re-run merge' }, { status: 404 })
      }

      // Get existing file metadata to preserve path structure
      const stat = await minioClient.statObject(BUCKET_NAME, existingFileId).catch(() => null)
      const oldMeta = stat?.metaData || {}
      const oldPath = decodeURIComponent((oldMeta['path'] as string) || fileName)
      const ext = ((oldMeta['extension'] as string) || 'csv')

      // Use suggested name (with updated year range) if provided
      const outputName = suggestedOutputName || fileName

      // Update path: replace filename segment with new output name
      const lastSlash = oldPath.lastIndexOf('/')
      const newPath = lastSlash !== -1
        ? oldPath.slice(0, lastSlash + 1) + outputName
        : outputName

      const buffer = fs.readFileSync(mergedPath)

      await uploadToMinio(existingFileId, buffer, {
        name: outputName,
        path: newPath,
        extension: ext,
        contentType: 'text/csv',
        size: buffer.length,
      })

      // Clean up temp files
      fs.rmSync(mergedPath, { force: true })

      return NextResponse.json({ savedPath: newPath, fileId: existingFileId, outputName })

    } else {
      // New file
      const { tempFileId, fileName, domain, subfolder } = body
      if (!tempFileId || !fileName) {
        return NextResponse.json({ error: 'tempFileId, fileName required' }, { status: 400 })
      }

      const tmpPath = path.join(tmpDir, tempFileId)
      if (!fs.existsSync(tmpPath)) {
        return NextResponse.json({ error: 'Temp file not found — please re-upload' }, { status: 404 })
      }

      const buffer = fs.readFileSync(tmpPath)
      const ext = fileName.split('.').pop()?.toLowerCase() || 'csv'
      const savePath = domain && subfolder
        ? `${domain}${subfolder}/${fileName}`
        : fileName

      const newFileId = generateFileId()

      await uploadToMinio(newFileId, buffer, {
        name: fileName,
        path: savePath,
        extension: ext,
        contentType: ext === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
      })

      // Clean up temp file
      fs.rmSync(tmpPath, { force: true })

      return NextResponse.json({ savedPath: savePath, fileId: newFileId })
    }
  } catch (error) {
    console.error('Merge save error:', error)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
}
