import type { ApaResult } from '@/app/fileapa/apaTypes'
import { BUCKET_NAME, minioClient } from '@/lib/minio'

const META_PREFIX = '__meta__/'

function getMetadataObjectName(fileId: string) {
  return `${META_PREFIX}${fileId}.json`
}

export function isApaMetadataObject(objectName: string) {
  return objectName.startsWith(META_PREFIX)
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