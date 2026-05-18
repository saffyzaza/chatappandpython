import * as Minio from 'minio'

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
})

export const BUCKET_NAME = process.env.MINIO_BUCKET || 'fileapa'
export const APA_BUCKET_NAME = process.env.MINIO_APA_BUCKET || 'apa-docs'

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET_NAME)
  if (!exists) {
    await minioClient.makeBucket(BUCKET_NAME, 'us-east-1')
  }
}

export async function ensureApaBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(APA_BUCKET_NAME)
  if (!exists) {
    await minioClient.makeBucket(APA_BUCKET_NAME, 'us-east-1')
  }
}
