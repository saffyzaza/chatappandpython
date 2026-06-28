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
  // XLSX = ZIP (PK\x03\x04), XLS = OLE (0xD0 0xCF) — everything else is UTF-8 CSV
  const isBinary = (buffer[0] === 0x50 && buffer[1] === 0x4B) || (buffer[0] === 0xD0 && buffer[1] === 0xCF)
  const wb = isBinary
    ? XLSX.read(buffer, { type: 'buffer' })
    : XLSX.read(buffer.toString('utf-8').replace(/^﻿/, ''), { type: 'string' })
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

function hasYearColumn(headers: string[]): boolean {
  return headers.some(h => /ปี|year|fiscal|งบประมาณ/i.test(h))
}

/** Detect Latin-1 mojibake from mis-encoded UTF-8 Thai/Latin text */
function isGarbledRow(row: string[]): boolean {
  return row.some(cell => /[ÃÂ]/.test(cell) || /à[¸¹]/.test(cell))
}

/**
 * Clean rows from encoding artifacts and year-range duplicates:
 * 1. Remove rows with garbled encoding
 * 2. If mix of range years ("2565-2566") and single years ("2566"), keep only single-year rows
 */
function cleanRows(rows: string[][], headers: string[]): string[][] {
  let cleaned = rows.filter(r => !isGarbledRow(r))

  const yearColIdx = headers.findIndex(h => /ปี|year/i.test(h))
  if (yearColIdx === -1) return cleaned

  const hasRangeYear = cleaned.some(r => /^\d{4}-\d{4}$/.test((r[yearColIdx] ?? '').trim()))
  const hasSingleYear = cleaned.some(r => /^\d{4}$/.test((r[yearColIdx] ?? '').trim()))

  if (hasRangeYear && hasSingleYear) {
    cleaned = cleaned.filter(r => /^\d{4}$/.test((r[yearColIdx] ?? '').trim()))
  }

  return cleaned
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
function buildMergedFileName(existingName: string, newName: string): string {
  const ext = existingName.match(/\.[^.]+$/)?.[0] ?? ''
  const base = existingName.slice(0, existingName.length - ext.length)

  const exRangeM = base.match(/(2\d{3})\s*[-–]\s*(2\d{3})/)
  const exSingleM = base.match(/(2\d{3})/)
  const startYear = exRangeM ? exRangeM[1] : (exSingleM?.[1] ?? '')

  const newRangeM = newName.match(/(2\d{3})\s*[-–]\s*(2\d{3})/)
  const newSingleM = newName.match(/(2\d{3})/)
  const endYear = newRangeM ? newRangeM[2] : (newSingleM?.[1] ?? '')

  if (!startYear || !endYear || startYear === endYear) return existingName

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
      newFileName?: string
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

    const existingStat = await minioClient.statObject(BUCKET_NAME, existingFileId).catch(() => null)
    const existingFileName = existingStat
      ? decodeURIComponent((existingStat.metaData['name'] as string) || existingFileId)
      : existingFileId

    const [existingBuf, tempBuf] = await Promise.all([
      readFromMinio(existingFileId),
      Promise.resolve(fs.readFileSync(tmpPath)),
    ])

    const existingRaw = parseBuffer(existingBuf)
    const incomingRaw = parseBuffer(tempBuf)

    const existing = { headers: existingRaw.headers, rows: cleanRows(existingRaw.rows, existingRaw.headers) }
    const incoming = { headers: incomingRaw.headers, rows: cleanRows(incomingRaw.rows, incomingRaw.headers) }

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
    const existingHasYear = hasYearColumn(existing.headers)
    const incomingHasYear = hasYearColumn(incoming.headers)
    const needYearCol = !existingHasYear && !incomingHasYear
    const YEAR_COL = 'ปี_ข้อมูล'
    const existingYearLabel = extractYearLabel(existingFileName)
    const newYearLabel = extractYearLabel(newFileName ?? '')

    // When existing has year col but incoming doesn't, auto-fill from filename
    const fillYearFromFilename = existingHasYear && !incomingHasYear && newYearLabel !== ''

    // ── Build merged structure ───────────────────────────────────────
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
          if (idx !== -1) return r[idx] ?? ''
          // No match — if year col and can derive from filename, fill automatically
          if (fillYearFromFilename && /ปี|year|fiscal|งบประมาณ/i.test(eh)) return newYearLabel
          return ''
        }),
        ...newOnlyIdxMap.map(i => r[i] ?? ''),
      ]
      return needYearCol ? [newYearLabel, ...base] : base
    }

    const existingMergedRows = existing.rows.map(buildExistingRow)
    const incomingMergedRows = incoming.rows.map(buildIncomingRow)

    // ── Dedup: replace existing rows for the same year as incoming ────
    const yearColInMerged = needYearCol
      ? 0
      : mergedHeaders.findIndex(h => /ปี|year|fiscal|งบประมาณ/i.test(h))

    const targetYear = newYearLabel || (
      yearColInMerged !== -1 && incomingMergedRows.length > 0
        ? (incomingMergedRows[0][yearColInMerged] ?? '').trim()
        : ''
    )

    let filteredExistingRows = existingMergedRows
    let replacedRowCount = 0

    if (yearColInMerged !== -1 && targetYear) {
      const before = existingMergedRows.length
      filteredExistingRows = existingMergedRows.filter(
        r => (r[yearColInMerged] ?? '').trim() !== targetYear
      )
      replacedRowCount = before - filteredExistingRows.length
    }

    const allMergedRows = [...filteredExistingRows, ...incomingMergedRows]

    // ── Write merged CSV to temp file ────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet([mergedHeaders, ...allMergedRows])
    const mergedCsv = XLSX.utils.sheet_to_csv(ws)
    const mergedTempKey = `${existingFileId}_merged`
    fs.writeFileSync(path.join(tmpDir, mergedTempKey), mergedCsv, 'utf-8')

    const suggestedOutputName = buildMergedFileName(existingFileName, newFileName ?? '')

    return NextResponse.json({
      mergedTempKey,
      headers: mergedHeaders,
      previewExisting: filteredExistingRows.slice(0, PREVIEW_ROWS),
      previewNew: incomingMergedRows.slice(0, PREVIEW_ROWS),
      existingRowCount: filteredExistingRows.length,
      replacedRowCount,
      newRowCount: incoming.rows.length,
      totalRowCount: allMergedRows.length,
      yearColumnAdded: needYearCol,
      yearFilledFromFilename: fillYearFromFilename,
      existingYearLabel,
      newYearLabel,
      suggestedOutputName,
    })
  } catch (error) {
    console.error('Merge execute error:', error)
    return NextResponse.json({ error: 'Execute failed' }, { status: 500 })
  }
}
