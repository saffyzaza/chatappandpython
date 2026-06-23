import { NextResponse } from 'next/server'
import { isApaMetadataObject, readApaMetadata } from '@/lib/fileApaMetadata'
import { minioClient, BUCKET_NAME, ensureBucket } from '@/lib/minio'
import { CopySourceOptions, CopyDestinationOptions } from 'minio'
import { buildApaString, buildFallbackApaResult, canGenerateApa, extractYear } from '@/lib/apa'

function decodeApaMeta(meta: Record<string, unknown>) {
  const author = decodeURIComponent((meta['apaauthor'] as string) || '')
  const researchersRaw = decodeURIComponent((meta['aparesearchers'] as string) || '[]')
  const title = decodeURIComponent((meta['apatitle'] as string) || '')
  const abstract = decodeURIComponent((meta['apaabstract'] as string) || '')
  const researchers = (() => {
    try {
      const parsed = JSON.parse(researchersRaw) as unknown
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : []
    } catch {
      return []
    }
  })()

  if (!author && !researchers.length && !title && !abstract) {
    return null
  }

  return {
    Author: author,
    Researchers: researchers,
    Title: title,
    Abstract: abstract,
  }
}

function getApaFromMeta(meta: Record<string, unknown>, objectName: string) {
  const decoded = decodeApaMeta(meta)

  if (decoded) {
    return decoded
  }

  const name = decodeURIComponent((meta['name'] as string) || objectName)

  if (!canGenerateApa(name)) {
    return null
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const fallback = buildFallbackApaResult({
    fileName: name,
    fileUrl: `${appUrl}/api/files/${objectName}?download=1`,
    projectInfo: `Uploaded: ${name} | Bucket: ${BUCKET_NAME} | ID: ${objectName}`,
  })

  const base = decoded || fallback

  return {
    ...base,
    ProjectInfo: `Uploaded: ${name} | Bucket: ${BUCKET_NAME} | ID: ${objectName}`,
    APA_String: buildApaString({
      author: base.Author,
      year: extractYear(name),
      title: base.Title || name,
      fileUrl: `${appUrl}/api/files/${objectName}?download=1`,
    }),
  }
}

export async function GET() {
  try {
    await ensureBucket()

    // Collect all object names first (stream callbacks must stay synchronous)
    const objectNames: string[] = []
    await new Promise<void>((resolve, reject) => {
      const stream = minioClient.listObjectsV2(BUCKET_NAME, '', true)
      stream.on('data', (obj) => {
        if (obj.name && !isApaMetadataObject(obj.name)) {
          objectNames.push(obj.name)
        }
      })
      stream.on('end', resolve)
      stream.on('error', reject)
    })

    // Fetch metadata for each object after the stream is done
    const results = await Promise.all(
      objectNames.map(async (objectName) => {
        try {
          const stat = await minioClient.statObject(BUCKET_NAME, objectName)
          const meta = stat.metaData || {}
          const sidecarApa = await readApaMetadata(objectName)
          return {
            id: objectName,
            name: decodeURIComponent((meta['name'] as string) || objectName),
            path: decodeURIComponent((meta['path'] as string) || objectName),
            extension: (meta['extension'] as string) || '',
            size: parseInt((meta['size'] as string) || '0', 10),
            previewKind: (meta['previewkind'] as string) || 'unsupported',
            uploadedAt: parseInt((meta['uploadedat'] as string) || '0', 10),
            apa: sidecarApa || getApaFromMeta(meta, objectName),
          }
        } catch {
          return null
        }
      })
    )

    const files = results.filter(Boolean)
    files.sort((a, b) => b!.uploadedAt - a!.uploadedAt)

    return NextResponse.json(files)
  } catch (error) {
    console.error('List files error:', error)
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}

import { Readable } from 'stream'
import { writeApaMetadata, writeFilePathData } from '@/lib/fileApaMetadata'
import { generateApaResult, trimMetadataValue, trimResearchers } from '@/lib/apa'

function generateFileId(): string {
  const min = 100000
  const max = 999999
  return Math.floor(Math.random() * (max - min + 1) + min).toString()
}

async function fileIdExists(id: string): Promise<boolean> {
  try {
    await minioClient.statObject(BUCKET_NAME, id)
    return true
  } catch {
    return false
  }
}

async function generateUniqueId(): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const id = generateFileId()
    if (!(await fileIdExists(id))) return id
  }
  throw new Error('Could not generate unique file ID')
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

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const path = url.searchParams.get('path') || ''
    const fileName = url.searchParams.get('filename') || 'document.pdf'
    const mimeType = url.searchParams.get('mime') || 'application/octet-stream'
    const sizeStr = url.searchParams.get('size') || request.headers.get('content-length') || '0'
    const size = parseInt(sizeStr, 10)

    if (!request.body) {
      return NextResponse.json({ error: 'No request body' }, { status: 400 })
    }

    await ensureBucket()

    const fileId = await generateUniqueId()
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    const previewKind = getPreviewKind(fileName, mimeType)
    const uploadedAt = Date.now()
    const filePath = path || fileName
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const fileUrl = `${appUrl}/api/files/${fileId}?download=1`

    // Convert Web ReadableStream to Node.js Readable stream
    // @ts-ignore
    const stream = Readable.fromWeb(request.body)

    let apa = null

    // We must put the object to MinIO first to stream it without memory limits
    const metaData = {
      'Content-Type': mimeType,
      'x-amz-meta-name': encodeURIComponent(fileName.slice(0, 150)),
      'x-amz-meta-path': encodeURIComponent(filePath.slice(0, 150)),
      'x-amz-meta-extension': extension,
      'x-amz-meta-previewkind': previewKind,
      'x-amz-meta-size': size.toString(),
      'x-amz-meta-uploadedat': uploadedAt.toString(),
    }

    await minioClient.putObject(BUCKET_NAME, fileId, stream, size, metaData)

    // Store full name/path in sidecar
    await writeFilePathData(fileId, { name: fileName, path: filePath })

    // Generate APA asynchronously to prevent blocking the upload response
    if (canGenerateApa(fileName)) {
      try {
        // Fetch it back into memory to parse for APA
        const minioStream = await minioClient.getObject(BUCKET_NAME, fileId)
        const chunks = []
        for await (const chunk of minioStream) {
          chunks.push(chunk)
        }
        const buffer = Buffer.concat(chunks)

        apa = await generateApaResult({
          buffer,
          fileName,
          fileUrl,
          projectInfo: `Uploaded: ${fileName} | Bucket: ${BUCKET_NAME} | ID: ${fileId}`,
        })

        if (apa) {
          await writeApaMetadata(fileId, {
            ...apa,
            Researchers: trimResearchers(apa.Researchers || []),
            Abstract: trimMetadataValue(apa.Abstract || '', 6000),
          })
          
          // Update the object metadata in MinIO to include APA fields
          const updatedMetaData = {
            ...metaData,
            'x-amz-meta-apatitle': encodeURIComponent(trimMetadataValue(apa?.Title || '', 240)),
            'x-amz-meta-apaauthor': encodeURIComponent(trimMetadataValue(apa?.Author || '', 180)),
          }
          // Copy object to itself to update metadata
          const source = new CopySourceOptions({ Bucket: BUCKET_NAME, Object: fileId })
          const dest = new CopyDestinationOptions({ 
            Bucket: BUCKET_NAME, 
            Object: fileId, 
            UserMetadata: updatedMetaData,
            MetadataDirective: 'REPLACE'
          })
          await minioClient.copyObject(source, dest)
        }
      } catch (error) {
        console.warn('APA generation skipped for upload:', {
          fileName,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return NextResponse.json({
      id: fileId,
      name: fileName,
      path: filePath,
      extension,
      size,
      previewKind,
      uploadedAt,
      apa,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 })
  }
}
