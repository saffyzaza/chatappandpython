import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { minioClient, BUCKET_NAME } from '@/lib/minio'

function getTmpPath(fileId: string): string {
  const dir = process.env.CHAT_UPLOAD_TMP_DIR || path.join(os.tmpdir(), 'chat_uploads')
  return path.join(dir, fileId)
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

function isGarbledRow(row: string[]): boolean {
  return row.some(cell => /[ÃÂ]/.test(cell) || /à[¸¹]/.test(cell))
}

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

// Normalized string similarity — strips punctuation/spaces, checks containment & equality
function headerSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const norm = (s: string) => s.toLowerCase().replace(/[\s_()\-%.]/g, '')
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return 0.95
  if (na.includes(nb) || nb.includes(na)) return 0.8
  return 0
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { existingFileId?: string; tempFileId?: string }
    const { existingFileId, tempFileId } = body

    if (!existingFileId || !tempFileId) {
      return NextResponse.json({ error: 'existingFileId and tempFileId required' }, { status: 400 })
    }

    const tmpPath = getTmpPath(tempFileId)
    if (!fs.existsSync(tmpPath)) {
      return NextResponse.json({ error: 'Temp file not found — please re-upload' }, { status: 404 })
    }

    const [existingBuf, tempBuf] = await Promise.all([
      readFromMinio(existingFileId),
      Promise.resolve(fs.readFileSync(tmpPath)),
    ])

    const existingRaw = parseBuffer(existingBuf)
    const incomingRaw = parseBuffer(tempBuf)
    const existing = { headers: existingRaw.headers, rows: cleanRows(existingRaw.rows, existingRaw.headers) }
    const incoming = { headers: incomingRaw.headers, rows: cleanRows(incomingRaw.rows, incomingRaw.headers) }

    type ColStatus = 'matched' | 'similar' | 'new' | 'missing'
    type ColRow = { existing: string; incoming: string; status: ColStatus }

    const columns: ColRow[] = []
    const usedIncoming = new Set<number>()

    for (const eh of existing.headers) {
      const exactIdx = incoming.headers.findIndex((ih, i) => !usedIncoming.has(i) && ih === eh)
      if (exactIdx !== -1) {
        columns.push({ existing: eh, incoming: incoming.headers[exactIdx], status: 'matched' })
        usedIncoming.add(exactIdx)
        continue
      }
      let bestScore = 0
      let bestIdx = -1
      incoming.headers.forEach((ih, i) => {
        if (usedIncoming.has(i)) return
        const s = headerSimilarity(eh, ih)
        if (s > bestScore) { bestScore = s; bestIdx = i }
      })
      if (bestIdx !== -1 && bestScore >= 0.8) {
        columns.push({ existing: eh, incoming: incoming.headers[bestIdx], status: 'similar' })
        usedIncoming.add(bestIdx)
        continue
      }
      columns.push({ existing: eh, incoming: '', status: 'missing' })
    }

    for (let i = 0; i < incoming.headers.length; i++) {
      if (!usedIncoming.has(i)) {
        columns.push({ existing: '', incoming: incoming.headers[i], status: 'new' })
      }
    }

    return NextResponse.json({
      columns,
      existingRowCount: existing.rows.length,
      newRowCount: incoming.rows.length,
    })
  } catch (error) {
    console.error('Merge analyze error:', error)
    return NextResponse.json({ error: 'Analyze failed' }, { status: 500 })
  }
}
