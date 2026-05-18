import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import * as XLSX from 'xlsx'
import { minioClient, APA_BUCKET_NAME, ensureApaBucket } from '@/lib/minio'

// pdf-parse has no named exports — require it
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

export interface ApaResult {
  Title: string
  Abstract: string
  ProjectInfo: string
  APA_String: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function extractYear(text: string): string {
  const m = text.match(/\b(19|20)\d{2}\b/)
  return m ? m[0] : new Date().getFullYear().toString()
}

function firstNonEmpty(lines: string[]): string {
  return lines.find((l) => l.trim().length > 3)?.trim() ?? ''
}

// Heuristic: lines that look like organisation names (all-caps words, "Office", "Ministry", etc.)
function detectAgency(lines: string[]): string {
  const orgKeywords = /office|ministry|department|agency|bureau|institute|university|commission|authority|council|centre|center|สำนัก|กรม|กระทรวง|องค์การ|มหาวิทยาลัย/i
  const candidate = lines.find((l) => orgKeywords.test(l))
  return candidate?.trim() ?? ''
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

async function extractFromPdf(buffer: Buffer): Promise<{ title: string; agency: string; year: string; abstract: string }> {
  const data = await pdfParse(buffer)
  const text: string = data.text ?? ''
  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

  const title = firstNonEmpty(lines)
  const agency = detectAgency(lines)
  const year = extractYear(text)

  // Abstract: look for the word "abstract" and grab following lines
  const abIdx = lines.findIndex((l: string) => /^abstract$/i.test(l))
  const abstract = abIdx !== -1
    ? lines.slice(abIdx + 1, abIdx + 6).join(' ')
    : lines.slice(1, 4).join(' ')

  return { title, agency, year, abstract }
}

// ─── CSV / XLSX extraction ────────────────────────────────────────────────────

function extractFromSheet(buffer: Buffer): { title: string; agency: string; year: string; abstract: string } {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  if (rows.length === 0) return { title: '', agency: '', year: '', abstract: '' }

  // Try header-based lookup first (case-insensitive)
  const findField = (row: Record<string, string>, ...keys: string[]): string => {
    for (const key of Object.keys(row)) {
      if (keys.some((k) => key.toLowerCase().includes(k))) return String(row[key])
    }
    return ''
  }

  const first = rows[0]
  const title = findField(first, 'title', 'ชื่อ', 'เรื่อง')
  const agency = findField(first, 'agency', 'หน่วยงาน', 'organization', 'author')
  const year = findField(first, 'year', 'ปี', 'date') || extractYear(JSON.stringify(first))
  const abstract = findField(first, 'abstract', 'บทคัดย่อ', 'summary', 'description')

  return { title, agency, year, abstract }
}

// ─── Route ────────────────────────────────────────────────────────────────────

function generateFileId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function uniqueId(): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const id = generateFileId()
    try {
      await minioClient.statObject(APA_BUCKET_NAME, id)
    } catch {
      return id
    }
  }
  throw new Error('Could not generate unique ID')
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowed = ['pdf', 'csv', 'xlsx', 'xls']
    if (!allowed.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, CSV, or XLSX.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // ── Extract fields ──
    let extracted: { title: string; agency: string; year: string; abstract: string }
    if (ext === 'pdf') {
      extracted = await extractFromPdf(buffer)
    } else {
      extracted = extractFromSheet(buffer)
    }

    const { title, agency, year, abstract } = extracted

    // ── Upload to apa-docs bucket ──
    await ensureApaBucket()
    const fileId = await uniqueId()
    const mimeType = file.type || 'application/octet-stream'
    const stream = Readable.from(buffer)

    const endpoint = process.env.MINIO_ENDPOINT || 'localhost'
    const port = process.env.MINIO_PORT || '9000'
    const useSSL = process.env.MINIO_USE_SSL === 'true'
    const protocol = useSSL ? 'https' : 'http'
    const minioUrl = `${protocol}://${endpoint}:${port}/${APA_BUCKET_NAME}/${fileId}`

    await minioClient.putObject(APA_BUCKET_NAME, fileId, stream, buffer.length, {
      'Content-Type': mimeType,
      'x-amz-meta-name': encodeURIComponent(file.name),
      'x-amz-meta-title': encodeURIComponent(title),
      'x-amz-meta-agency': encodeURIComponent(agency),
      'x-amz-meta-year': year,
    })

    // ── Build APA 7th string ──
    const agencyPart = agency || 'Unknown Agency'
    const yearPart = year || new Date().getFullYear().toString()
    const titlePart = title || file.name
    const APA_String = `${agencyPart}. (${yearPart}). ${titlePart}. [Online]. Available: ${minioUrl}`

    const result: ApaResult = {
      Title: titlePart,
      Abstract: abstract,
      ProjectInfo: `Uploaded: ${file.name} | Bucket: ${APA_BUCKET_NAME} | ID: ${fileId}`,
      APA_String,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('generate-apa error:', error)
    return NextResponse.json({ error: 'Failed to generate APA citation' }, { status: 500 })
  }
}
