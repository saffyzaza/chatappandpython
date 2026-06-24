import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { minioClient, BUCKET_NAME } from '@/lib/minio'

const PREVIEW_ROWS = 4

function getTmpDir(): string {
  const dir = process.env.CHAT_UPLOAD_TMP_DIR || path.join(os.tmpdir(), 'chat_uploads')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function parseBuffer(buffer: Buffer): { headers: string[]; rows: string[][] } {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]
  if (!all.length) return { headers: [], rows: [] }
  const headers = (all[0] as unknown[]).map(v => String(v ?? ''))
  const rows = (all.slice(1) as unknown[][]).map(r => r.map(v => String(v ?? '')))
  return { headers, rows }
}

async function readFromMinio(fileId: string): Promise<Buffer> {
  const chunks: Buffer[] = []
  const stream = await minioClient.getObject(BUCKET_NAME, fileId)
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', resolve)
    stream.on('error', reject)
  })
  return Buffer.concat(chunks)
}

function headerSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const norm = (s: string) => s.toLowerCase().replace(/[\s_()\-%.]/g, '')
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return 0.95
  if (na.includes(nb) || nb.includes(na)) return 0.8
  return 0
}

// Check whether any header is a year indicator
function hasYearColumn(headers: string[]): boolean {
  return headers.some(h => /ปี|year|fiscal|งบประมาณ/i.test(h))
}

// Extract year label from filename  e.g. "data_2565-2569.csv" → "2565-2569", "data_2570.csv" → "2570"
function extractYearLabel(name: string): string {
  const rangeMatch = name.match(/(2\d{3})\s*[-–]\s*(2\d{3})/)
  if (rangeMatch) return `${rangeMatch[1]}-${rangeMatch[2]}`
  const singleMatch = name.match(/(?<![0-9])(2\d{3})(?![0-9])/)
  if (singleMatch) return singleMatch[1]
  return ''
}

// Build merged output filename by combining year ranges
// e.g. existing="data 2565.csv" + new="data 2566.csv" → "data 2565-2566.csv"
// e.g. existing="data 2565-2569.csv" + new="data 2570.csv" → "data 2565-2570.csv"
function buildMergedFileName(existingName: string, newName: string): string {
  const ext = existingName.match(/\.[^.]+$/)?.[0] ?? ''
  const base = existingName.slice(0, existingName.length - ext.length)

  // Start year: earliest year in existing filename
  const exRangeM = base.match(/(2\d{3})\s*[-–]\s*(2\d{3})/)
  const exSingleM = base.match(/(2\d{3})/)
  const startYear = exRangeM ? exRangeM[1] : (exSingleM?.[1] ?? '')

  // End year: latest year in new filename
  const newRangeM = newName.match(/(2\d{3})\s*[-–]\s*(2\d{3})/)
  const newSingleM = newName.match(/(2\d{3})/)
  const endYear = newRangeM ? newRangeM[2] : (newSingleM?.[1] ?? '')

  if (!startYear || !endYear || startYear === endYear) return existingName

  // Replace year pattern in base name (range first, then single)
  const newBase = exRangeM
    ? base.replace(/(2\d{3})\s*[-–]\s*(2\d{3})/, `${startYear}-${endYear}`)
    : base.replace(/(2\d{3})/, `${startYear}-${endYear}`)

  return newBase + ext
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      existingFileId?: string
      tempFileId?: string
      newFileName?: string   // original uploaded filename — used for year extraction
    }
    const { existingFileId, tempFileId, newFileName } = body

    if (!existingFileId || !tempFileId) {
      return NextResponse.json({ error: 'existingFileId and tempFileId required' }, { status: 400 })
    }

    const tmpDir = getTmpDir()
    const tmpPath = path.join(tmpDir, tempFileId)
    if (!fs.existsSync(tmpPath)) {
      return NextResponse.json({ error: 'Temp file not found — please re-upload' }, { status: 404 })
    }

    // Fetch existing file metadata to get its original name (for year extraction)
    const existingStat = await minioClient.statObject(BUCKET_NAME, existingFileId).catch(() => null)
    const existingFileName = existingStat
      ? decodeURIComponent((existingStat.metaData['name'] as string) || existingFileId)
      : existingFileId

    const [existingBuf, tempBuf] = await Promise.all([
      readFromMinio(existingFileId),
      Promise.resolve(fs.readFileSync(tmpPath)),
    ])

    const existing = parseBuffer(existingBuf)
    const incoming = parseBuffer(tempBuf)

    // ── Column mapping ───────────────────────────────────────────────
    const usedIncoming = new Set<number>()
    const existingToIncomingIdx = new Map<string, number>()

    for (const eh of existing.headers) {
      let idx = incoming.headers.findIndex((ih, i) => !usedIncoming.has(i) && ih === eh)
      if (idx === -1) {
        let best = 0
        incoming.headers.forEach((ih, i) => {
          if (usedIncoming.has(i)) return
          const s = headerSimilarity(eh, ih)
          if (s > best) { best = s; idx = i }
        })
        if (best < 0.8) idx = -1
      }
      existingToIncomingIdx.set(eh, idx)
      if (idx !== -1) usedIncoming.add(idx)
    }

    const newOnlyHeaders: string[] = []
    const newOnlyIdxMap: number[] = []
    for (let i = 0; i < incoming.headers.length; i++) {
      if (!usedIncoming.has(i)) {
        newOnlyHeaders.push(incoming.headers[i])
        newOnlyIdxMap.push(i)
      }
    }

    // ── Auto year column ─────────────────────────────────────────────
    const needYearCol = !hasYearColumn(existing.headers) && !hasYearColumn(incoming.headers)
    const YEAR_COL = 'ปี_ข้อมูล'
    const existingYearLabel = extractYearLabel(existingFileName)
    const newYearLabel = extractYearLabel(newFileName ?? '')

    // ── Build merged structure ───────────────────────────────────────
    // Year column goes first (if needed), then existing headers, then new-only headers
    const mergedHeaders = needYearCol
      ? [YEAR_COL, ...existing.headers, ...newOnlyHeaders]
      : [...existing.headers, ...newOnlyHeaders]

    const buildExistingRow = (r: string[]): string[] => {
      const base = [
        ...existing.headers.map((_, i) => r[i] ?? ''),
        ...newOnlyHeaders.map(() => ''),
      ]
      return needYearCol ? [existingYearLabel, ...base] : base
    }

    const buildIncomingRow = (r: string[]): string[] => {
      const base = [
        ...existing.headers.map(eh => {
          const idx = existingToIncomingIdx.get(eh) ?? -1
          return idx !== -1 ? (r[idx] ?? '') : ''
        }),
        ...newOnlyIdxMap.map(i => r[i] ?? ''),
      ]
      return needYearCol ? [newYearLabel, ...base] : base
    }

    const existingMergedRows = existing.rows.map(buildExistingRow)
    const incomingMergedRows = incoming.rows.map(buildIncomingRow)
    const allMergedRows = [...existingMergedRows, ...incomingMergedRows]

    // ── Write merged CSV to temp file ────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet([mergedHeaders, ...allMergedRows])
    const mergedCsv = XLSX.utils.sheet_to_csv(ws)
    const mergedTempKey = `${existingFileId}_merged`
    fs.writeFileSync(path.join(tmpDir, mergedTempKey), mergedCsv, 'utf-8')

    const suggestedOutputName = buildMergedFileName(existingFileName, newFileName ?? '')

    return NextResponse.json({
      mergedTempKey,
      headers: mergedHeaders,
      previewExisting: existingMergedRows.slice(0, PREVIEW_ROWS),
      previewNew: incomingMergedRows.slice(0, PREVIEW_ROWS),
      existingRowCount: existing.rows.length,
      newRowCount: incoming.rows.length,
      totalRowCount: allMergedRows.length,
      yearColumnAdded: needYearCol,
      existingYearLabel,
      newYearLabel,
      suggestedOutputName,
    })
  } catch (error) {
    console.error('Merge execute error:', error)
    return NextResponse.json({ error: 'Execute failed' }, { status: 500 })
  }
}
