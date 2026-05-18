import { NextResponse } from 'next/server'
import { isApaMetadataObject, readApaMetadata } from '@/lib/fileApaMetadata'
import { minioClient, BUCKET_NAME, ensureBucket } from '@/lib/minio'
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
