import type { ApaResult } from '@/app/fileapa/apaTypes'
import { BUCKET_NAME, minioClient } from '@/lib/minio'

const META_PREFIX = '__meta__/'
const PATH_PREFIX = '__pathdata__/'

function getMetadataObjectName(fileId: string) {
  return `${META_PREFIX}${fileId}.json`
}

function getPathDataObjectName(fileId: string) {
  return `${PATH_PREFIX}${fileId}.json`
}

export async function readFilePathData(
  fileId: string
): Promise<{ name: string; path: string } | null> {
  try {
    const stream = await minioClient.getObject(BUCKET_NAME, getPathDataObjectName(fileId))
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', resolve)
      stream.on('error', reject)
    })
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as { name: string; path: string }
  } catch {
    return null
  }
}

export async function writeFilePathData(fileId: string, data: { name: string; path: string }) {
  const body = Buffer.from(JSON.stringify(data), 'utf8')
  await minioClient.putObject(BUCKET_NAME, getPathDataObjectName(fileId), body, body.length, {
    'Content-Type': 'application/json',
  })
}

export async function removeFilePathData(fileId: string) {
  try {
    await minioClient.removeObject(BUCKET_NAME, getPathDataObjectName(fileId))
  } catch {
    // Ignore missing sidecar files.
  }
}

export function isApaMetadataObject(objectName: string) {
  return objectName.startsWith(META_PREFIX) || objectName.startsWith(PATH_PREFIX)
}

export async function readApaMetadata(fileId: string): Promise<ApaResult | null> {
  try {
    const objectStream = await minioClient.getObject(BUCKET_NAME, getMetadataObjectName(fileId))
    const chunks: Buffer[] = []

    await new Promise<void>((resolve, reject) => {
      objectStream.on('data', (chunk: Buffer) => chunks.push(chunk))
      objectStream.on('end', resolve)
      objectStream.on('error', reject)
    })

    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as ApaResult
  } catch {
    return null
  }
}

export async function writeApaMetadata(fileId: string, apa: ApaResult) {
  const body = Buffer.from(JSON.stringify(apa), 'utf8')
  await minioClient.putObject(BUCKET_NAME, getMetadataObjectName(fileId), body, body.length, {
    'Content-Type': 'application/json',
  })
}

export async function removeApaMetadata(fileId: string) {
  try {
    await minioClient.removeObject(BUCKET_NAME, getMetadataObjectName(fileId))
  } catch {
    // Ignore missing sidecar metadata files.
  }
}