import { NextRequest, NextResponse } from 'next/server'
import { minioClient, BUCKET_NAME, ensureBucket } from '@/lib/minio'
import { isApaMetadataObject } from '@/lib/fileApaMetadata'

const AISTUDIO_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

// Try models in order — first available wins
const MODEL_PRIORITY = [
  process.env.GEMINI_MODEL        || 'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
]

type FileEntry = { id: string; name: string; path: string; size: number }
type AIResponse = { found: boolean; matchedFileId: string | null; confidence: number; reason: string }

function extractYears(name: string): string {
  const m = name.match(/(\d{4})\s*[-–]\s*(\d{4})/)
  if (m) return `${m[1]}-${m[2]}`
  const m2 = name.match(/\d{4}/)
  return m2?.[0] ?? ''
}

// ── Fallback: Dice bigram similarity ────────────────────────────────
function diceSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/\.(csv|xlsx|xls)$/i, '').replace(/\s+/g, '')
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return 1

  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2)
      m.set(bg, (m.get(bg) ?? 0) + 1)
    }
    return m
  }
  const ba = bigrams(na)
  const bb = bigrams(nb)
  if (!ba.size || !bb.size) return 0

  let common = 0
  for (const [bg, cnt] of ba) common += Math.min(cnt, bb.get(bg) ?? 0)
  const total = [...ba.values()].reduce((a, b) => a + b, 0) +
                [...bb.values()].reduce((a, b) => a + b, 0)
  return (2 * common) / total
}

function fallbackSearch(fileName: string, files: FileEntry[]): AIResponse {
  const scored = files
    .map(f => ({ ...f, score: diceSimilarity(fileName, f.name) }))
    .filter(f => f.score >= 0.3)
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best) return { found: false, matchedFileId: null, confidence: 0, reason: 'ไม่พบไฟล์ที่มีชื่อคล้ายกัน (ใช้ Dice similarity)' }

  return {
    found: true,
    matchedFileId: best.id,
    confidence: Math.round(best.score * 100),
    reason: `พบไฟล์ที่มีชื่อคล้ายกัน (Dice similarity ${Math.round(best.score * 100)}%)`,
  }
}

// ── AI search with model fallback & retry ───────────────────────────
async function askAI(uploadedFileName: string, files: FileEntry[]): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const fileList = files
    .map((f, i) => `${i + 1}. ID=${f.id} | ชื่อ="${f.name}" | path=${f.path}`)
    .join('\n')

  const prompt = `คุณเป็นผู้ช่วยจับคู่ไฟล์ข้อมูลสุขภาพของระบบจัดการข้อมูลสุขภาพภาคตะวันออกเฉียงเหนือ

ไฟล์ที่ผู้ใช้อัพโหลดใหม่: "${uploadedFileName}"

รายชื่อไฟล์ที่มีอยู่ในระบบ MinIO:
${fileList || '(ไม่มีไฟล์ในระบบ)'}

ภารกิจ: วิเคราะห์ว่าไฟล์ที่อัพโหลดใหม่ตรงกับไฟล์ใดในระบบหรือไม่

กฎการตัดสิน:
- "ตรงกัน" = ชุดข้อมูลเดียวกัน (ตัวชี้วัดเดียวกัน พื้นที่เดียวกัน ประเภทเดียวกัน) แต่อาจต่างปีหรือชื่อต่างกันเล็กน้อย
- ถ้าหัวข้อสุขภาพเดียวกันชัดเจน → ให้ถือว่าตรงกัน
- ถ้ามั่นใจต่ำกว่า 40% หรือไม่มีไฟล์ที่ตรงกัน → found=false
- ถ้าไม่มีไฟล์ในระบบเลย → found=false

ตอบด้วย JSON เท่านั้น:
{"found":true/false,"matchedFileId":"ID หรือ null","confidence":0-100,"reason":"เหตุผลสั้นๆ ภาษาไทย"}`

  const body = JSON.stringify({ messages: [{ role: 'user', content: prompt }], temperature: 0, max_tokens: 200 })

  // Try each model until one succeeds
  for (const model of MODEL_PRIORITY) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(AISTUDIO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ ...JSON.parse(body), model }),
          signal: AbortSignal.timeout(20000),
        })

        if (res.status === 503 || res.status === 429) {
          // Overloaded — wait briefly then try next model
          await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
          continue
        }

        if (!res.ok) {
          const txt = await res.text()
          throw new Error(`AI ${model} error ${res.status}: ${txt.slice(0, 120)}`)
        }

        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        const raw = data.choices?.[0]?.message?.content ?? ''
        const start = raw.indexOf('{')
        const end = raw.lastIndexOf('}')
        if (start === -1 || end === -1) throw new Error('No JSON in AI response')

        return JSON.parse(raw.slice(start, end + 1)) as AIResponse
      } catch (err) {
        if (attempt === 1) console.warn(`Model ${model} failed:`, err)
      }
    }
  }

  throw new Error('All AI models unavailable')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { fileName?: string }
    const fileName = body.fileName?.trim()
    if (!fileName) return NextResponse.json({ error: 'fileName required' }, { status: 400 })

    await ensureBucket()

    // List all CSV/XLSX files in MinIO
    const objectNames: string[] = []
    await new Promise<void>((resolve, reject) => {
      const stream = minioClient.listObjectsV2(BUCKET_NAME, '', true)
      stream.on('data', obj => { if (obj.name && !isApaMetadataObject(obj.name)) objectNames.push(obj.name) })
      stream.on('end', resolve)
      stream.on('error', reject)
    })

    const files: FileEntry[] = []
    await Promise.all(objectNames.map(async id => {
      try {
        const stat = await minioClient.statObject(BUCKET_NAME, id)
        const meta = stat.metaData || {}
        const ext = ((meta['extension'] as string) || '').toLowerCase()
        if (!['csv', 'xlsx', 'xls'].includes(ext)) return
        files.push({
          id,
          name: decodeURIComponent((meta['name'] as string) || id),
          path: decodeURIComponent((meta['path'] as string) || id),
          size: parseInt((meta['size'] as string) || '0', 10),
        })
      } catch { /* skip */ }
    }))

    // Try AI first, fall back to Dice similarity if AI unavailable
    let result: AIResponse
    try {
      result = await askAI(fileName, files)
    } catch (aiErr) {
      console.warn('AI unavailable, using Dice fallback:', aiErr)
      result = fallbackSearch(fileName, files)
    }

    if (!result.found || !result.matchedFileId) {
      return NextResponse.json({ found: false, reason: result.reason })
    }

    const matched = files.find(f => f.id === result.matchedFileId)
    if (!matched) return NextResponse.json({ found: false, reason: 'Matched file no longer exists' })

    return NextResponse.json({
      found: true,
      reason: result.reason,
      match: {
        id: matched.id,
        name: matched.name,
        path: matched.path,
        domain: matched.path.split('/')[0] ?? '',
        years: extractYears(matched.name),
        size: matched.size < 1024 ? `${matched.size} B` : `${(matched.size / 1024).toFixed(1)} KB`,
        confidence: result.confidence,
      },
    })
  } catch (error) {
    console.error('Merge search error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Search failed' }, { status: 500 })
  }
}
