import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import { readApaMetadata, removeApaMetadata } from '@/lib/fileApaMetadata'
import { minioClient, BUCKET_NAME, ensureBucket } from '@/lib/minio'
import { buildApaString, buildFallbackApaResult, canGenerateApa, extractYear } from '@/lib/apa'

type RouteParams = { params: Promise<{ fileId: string }> }

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

function getApaFromMeta(meta: Record<string, unknown>, fileId: string) {
  const decoded = decodeApaMeta(meta)

  if (decoded) {
    return decoded
  }

  const name = decodeURIComponent((meta['name'] as string) || fileId)

  if (!canGenerateApa(name)) {
    return null
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const fallback = buildFallbackApaResult({
    fileName: name,
    fileUrl: `${appUrl}/api/files/${fileId}?download=1`,
    projectInfo: `Uploaded: ${name} | Bucket: ${BUCKET_NAME} | ID: ${fileId}`,
  })

  const base = decoded || fallback

  return {
    ...base,
    ProjectInfo: `Uploaded: ${name} | Bucket: ${BUCKET_NAME} | ID: ${fileId}`,
    APA_String: buildApaString({
      author: base.Author,
      year: extractYear(name),
      title: base.Title || name,
      fileUrl: `${appUrl}/api/files/${fileId}?download=1`,
    }),
  }
}

// GET /api/files/[fileId] — stream file content from MinIO
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { fileId } = await params
    const url = new URL(request.url)
    const metaOnly = url.searchParams.get('meta') === '1'

    const stat = await minioClient.statObject(BUCKET_NAME, fileId).catch(() => null)

    if (!stat) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const meta = stat.metaData || {}
    const sidecarApa = await readApaMetadata(fileId)

    if (metaOnly) {
      return NextResponse.json({
        id: fileId,
        name: decodeURIComponent((meta['name'] as string) || fileId),
        path: decodeURIComponent((meta['path'] as string) || fileId),
        extension: (meta['extension'] as string) || '',
        size: parseInt((meta['size'] as string) || '0', 10),
        previewKind: (meta['previewkind'] as string) || 'unsupported',
        uploadedAt: parseInt((meta['uploadedat'] as string) || '0', 10),
        apa: sidecarApa || getApaFromMeta(meta, fileId),
      })
    }

    const contentType = (meta['content-type'] as string) || 'application/octet-stream'
    const fileName = decodeURIComponent((meta['name'] as string) || fileId)

    const objectStream = await minioClient.getObject(BUCKET_NAME, fileId)

    const webStream = new ReadableStream({
      start(controller) {
        objectStream.on('data', (chunk: Buffer) => controller.enqueue(chunk))
        objectStream.on('end', () => controller.close())
        objectStream.on('error', (err: Error) => controller.error(err))
      },
    })

    const isDownload = url.searchParams.get('download') === '1'

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Content-Disposition': isDownload
          ? `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
          : `inline; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Get file error:', error)
    return NextResponse.json({ error: 'Failed to get file' }, { status: 500 })
  }
}

// DELETE /api/files/[fileId] — remove from MinIO
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { fileId } = await params
    await minioClient.removeObject(BUCKET_NAME, fileId)
    await removeApaMetadata(fileId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete file error:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}

// PATCH /api/files/[fileId] — update metadata (name, path, etc.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { fileId } = await params
    const updates = (await request.json()) as {
      name?: string
      path?: string
      extension?: string
      previewKind?: string
    }

    await ensureBucket()

    const stat = await minioClient.statObject(BUCKET_NAME, fileId).catch(() => null)
    if (!stat) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const oldMeta = stat.metaData || {}

    const newName = updates.name
      ? encodeURIComponent(updates.name)
      : (oldMeta['name'] as string) || fileId
    const newPath = updates.path
      ? encodeURIComponent(updates.path)
      : (oldMeta['path'] as string) || fileId
    const newExtension = updates.extension ?? ((oldMeta['extension'] as string) || '')
    const newPreviewKind = updates.previewKind ?? ((oldMeta['previewkind'] as string) || 'unsupported')
    const contentType = (oldMeta['content-type'] as string) || 'application/octet-stream'

    // Re-upload with updated metadata (MinIO does not support in-place metadata updates)
    const objectStream = await minioClient.getObject(BUCKET_NAME, fileId)
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      objectStream.on('data', (chunk: Buffer) => chunks.push(chunk))
      objectStream.on('end', resolve)
      objectStream.on('error', reject)
    })
    const buffer = Buffer.concat(chunks)
    const stream = Readable.from(buffer)

    const newMeta = {
      'Content-Type': contentType,
      'x-amz-meta-name': newName,
      'x-amz-meta-path': newPath,
      'x-amz-meta-extension': newExtension,
      'x-amz-meta-previewkind': newPreviewKind,
      'x-amz-meta-size': (oldMeta['size'] as string) || '0',
      'x-amz-meta-uploadedat': (oldMeta['uploadedat'] as string) || '0',
      'x-amz-meta-apaauthor': (oldMeta['apaauthor'] as string) || '',
      'x-amz-meta-apatitle': (oldMeta['apatitle'] as string) || '',
    }

    await minioClient.putObject(BUCKET_NAME, fileId, stream, buffer.length, newMeta)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update file error:', error)
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 })
  }
}
