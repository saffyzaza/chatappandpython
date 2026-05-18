import { Readable } from 'stream'

import type { ApaResult } from '@/app/fileapa/apaTypes'
import { readApaMetadata, writeApaMetadata } from '@/lib/fileApaMetadata'
import { buildApaString, buildFallbackApaResult, extractYear, trimMetadataValue, trimResearchers } from '@/lib/apa'
import { extractFileInsightInput } from '@/lib/fileInsights'
import { BUCKET_NAME, minioClient } from '@/lib/minio'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

const AISTUDIO_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const MODEL = process.env.GEMINI_FILE_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-pro'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const AISTUDIO_TIMEOUT_MS = 120000
const MAX_DIRECT_PDF_BYTES = 4 * 1024 * 1024

type RouteParams = { params: Promise<{ fileId: string }> }

function getMessageContent(data: unknown) {
  const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }

        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text ?? '')
        }

        return ''
      })
      .join('\n')
  }

  return ''
}

function extractJson<T>(rawText: string) {
  const trimmed = rawText.trim()

  try {
    return JSON.parse(trimmed) as T
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')

    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T
    }

    throw new Error('Invalid JSON response from AI Studio')
  }
}

function decodeApaMeta(meta: Record<string, unknown>, fileId: string) {
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
    const fileName = decodeURIComponent((meta['name'] as string) || fileId)
    return buildFallbackApaResult({
      fileName,
      fileUrl: `${APP_URL}/api/files/${fileId}?download=1`,
      projectInfo: `Uploaded: ${fileName} | Bucket: ${BUCKET_NAME} | ID: ${fileId}`,
    })
  }

  return {
    Author: author,
    Researchers: researchers,
    Title: title,
    Abstract: abstract,
  }
}

function buildCurrentApa(meta: Record<string, unknown>, fileId: string, storedApa: ApaResult | null): ApaResult {
  const fileName = decodeURIComponent((meta['name'] as string) || fileId)
  const fallback = buildFallbackApaResult({
    fileName,
    fileUrl: `${APP_URL}/api/files/${fileId}?download=1`,
    projectInfo: `Uploaded: ${fileName} | Bucket: ${BUCKET_NAME} | ID: ${fileId}`,
  })
  const decoded = decodeApaMeta(meta, fileId)

  return {
    ...fallback,
    ...(decoded ? decoded : {}),
    ...(storedApa ? storedApa : {}),
    Researchers: storedApa?.Researchers || decoded?.Researchers || fallback.Researchers,
  }
}

async function callAIStudio(prompt: string, signal?: AbortSignal) {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing')
  }

  const timeoutSignal = AbortSignal.timeout(AISTUDIO_TIMEOUT_MS)
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

  const response = await fetch(AISTUDIO_URL, {
    method: 'POST',
    signal: combinedSignal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'คุณคือผู้เชี่ยวชาญสกัด metadata จากเอกสารวิชาการภาษาไทย อ่านเนื้อหาทั้งหมดอย่างละเอียด แล้วคืน JSON เท่านั้น ห้ามเพิ่มข้อความอื่นนอกจาก JSON',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  const payload = (await response.json()) as unknown

  if (!response.ok) {
    const errorMessage = (payload as { error?: { message?: string } })?.error?.message
    throw new Error(errorMessage || 'AI Studio request failed')
  }

  return extractJson<{ title?: string; year?: string; author: string; researchers: string[]; abstract: string }>(getMessageContent(payload))
}

async function callAIStudioWithPdf(args: {
  prompt: string
  fileName: string
  buffer: Buffer
}) {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing')
  }

  const dataUrl = `data:application/pdf;base64,${args.buffer.toString('base64')}`
  const response = await fetch(AISTUDIO_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(AISTUDIO_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'คุณคือผู้เชี่ยวชาญสกัด metadata จากเอกสารวิชาการภาษาไทย อ่านเนื้อหาทั้งหมดอย่างละเอียด แล้วคืน JSON เท่านั้น ห้ามเพิ่มข้อความอื่นนอกจาก JSON',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: args.prompt,
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
    }),
  })

  const payload = (await response.json()) as unknown

  if (!response.ok) {
    const errorMessage = (payload as { error?: { message?: string } })?.error?.message
    throw new Error(errorMessage || 'AI Studio PDF request failed')
  }

  return extractJson<{ title?: string; year?: string; author: string; researchers: string[]; abstract: string }>(getMessageContent(payload))
}

export async function POST(request: Request, { params }: RouteParams) {
  const { fileId } = await params
  const stat = await minioClient.statObject(BUCKET_NAME, fileId).catch(() => null)

  if (!stat) {
    return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 })
  }

  const encoder = new TextEncoder()
  const abortController = new AbortController()
  request.signal.addEventListener('abort', () => abortController.abort())

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)))
      }

      try {
        const oldMeta = stat.metaData || {}
        const storedApa = await readApaMetadata(fileId)
        const fileName = decodeURIComponent((oldMeta['name'] as string) || fileId)
        const currentApa = buildCurrentApa(oldMeta, fileId, storedApa)
        const extension = fileName.split('.').pop()?.toLowerCase() ?? ''

        enqueue('progress', { step: 'reading', message: 'กำลังอ่านไฟล์...' })

        const objectStream = await minioClient.getObject(BUCKET_NAME, fileId)
        const chunks: Buffer[] = []

        await new Promise<void>((resolve, reject) => {
          objectStream.on('data', (chunk: Buffer) => chunks.push(chunk))
          objectStream.on('end', resolve)
          objectStream.on('error', reject)
        })

        const buffer = Buffer.concat(chunks)

        enqueue('progress', { step: 'extracting', message: 'สกัดข้อความจากไฟล์...' })

        const extracted = await extractFileInsightInput({ buffer, fileName })
        const aiPrompt = [
          `ชื่อไฟล์: ${fileName}`,
          `ชื่อเรื่องปัจจุบัน: ${currentApa.Title || '(ยังไม่ระบุ)'}`,
          'อ่านเนื้อหาด้านล่างอย่างละเอียดแล้วสกัด metadata ออกมา ตอบเป็น JSON ตาม schema นี้เท่านั้น:',
          JSON.stringify({
            title: 'ชื่อเรื่องจริงของเอกสาร (ไม่ใช่ชื่อไฟล์) ภาษาเดิมของเอกสาร',
            year: 'ปี พ.ศ. หรือ ค.ศ. ที่ตีพิมพ์หรือจัดทำ เช่น 2568 หรือ 2025 ถ้าไม่พบให้คืนค่าว่าง',
            author: 'หน่วยงานหรือผู้แต่งหลัก 1 รายชื่อ เช่น ชื่อองค์กร สถาบัน หรือนักวิจัยคนแรก',
            researchers: ['รายชื่อนักวิจัย ผู้แต่ง ผู้เรียบเรียง หรือองค์กรที่เกี่ยวข้องทั้งหมดที่พบในเอกสาร'],
            abstract: 'สรุปเนื้อหาครอบคลุมทุกประเด็นสำคัญของเอกสาร อธิบายวัตถุประสงค์ วิธีการ ผลการศึกษา และข้อเสนอแนะ ความยาว 3-5 ย่อหน้า เขียนเป็นภาษาไทย',
            keyStats: ['สกัดตัวเลขสถิติ ตัวเลขจากตาราง กราฟ และเนื้อหาทุกรายการที่พบในเอกสาร ระบุบริบทกำกับทุกตัวเลข เช่น "ผู้สูบบุหรี่ 9.9 ล้านคน (ร้อยละ 17.4)" หรือ "กลุ่มอายุ 25-44 ปี มีอัตราสูบบุหรี่สูงสุด ร้อยละ 21.0" ดึงออกมาให้ครบทุกตัวเลขที่สำคัญ ไม่จำกัดจำนวน'],
          }),
          'กฎสำคัญ:',
          '- title ต้องเป็นชื่อเรื่องจริงจากเนื้อหา ไม่ใช่ชื่อบท',
          '- abstract ต้องครอบคลุมและละเอียด ไม่ใช่แค่ประโยคเดียว',
          '- researchers ให้รวมทุกชื่อที่พบ ทั้งบุคคลและหน่วยงาน',
          '- keyStats ให้สกัดตัวเลขทุกตัวที่มีความหมายจากทั้งเนื้อหา ตาราง และกราฟ พร้อมบริบทกำกับ ยิ่งมากยิ่งดี ไม่จำกัดจำนวน',
          '- keyStats อ่านตารางทุกตาราง อ่านค่าตัวเลขทุกค่า เช่น ร้อยละ อัตรา จำนวน ปี และระบุว่าเป็นของกลุ่มไหน/หมวดไหน',
          '- ถ้าไม่พบข้อมูลใดให้คืนค่าว่างหรือ [] อย่าแต่งเอง',
        ].join('\n\n')

        enqueue('progress', { step: 'ai', message: 'AI กำลังอ่านและวิเคราะห์ไฟล์...' })

        let ai: { title?: string; year?: string; author: string; researchers: string[]; abstract: string; keyStats?: string[] }

        if (extension === 'pdf' && extracted.excerpt.trim()) {
          ai = await callAIStudio(`${aiPrompt}\n\nเนื้อหาที่อ่านได้:\n${extracted.excerpt}`, abortController.signal)
        } else if (extension === 'pdf' && buffer.length <= MAX_DIRECT_PDF_BYTES) {
          try {
            ai = await callAIStudioWithPdf({ prompt: aiPrompt, fileName, buffer })
          } catch {
            if (!extracted.excerpt.trim()) {
              enqueue('error', { error: 'AI ยังอ่านข้อความจาก PDF นี้ไม่ได้ จึงยังเติม Author/Abstract อัตโนมัติไม่ได้' })
              controller.close()
              return
            }
            ai = await callAIStudio(`${aiPrompt}\n\nเนื้อหาที่อ่านได้:\n${extracted.excerpt}`, abortController.signal)
          }
        } else {
          if (!extracted.excerpt.trim()) {
            enqueue('error', { error: extension === 'pdf' ? 'PDF นี้ใหญ่เกินสำหรับส่งตรงและยังสกัดข้อความอ่านได้ไม่พอ' : 'AI ยังอ่านข้อความจากไฟล์นี้ไม่ได้ จึงยังเติม Author/Abstract อัตโนมัติไม่ได้' })
            controller.close()
            return
          }
          ai = await callAIStudio(`${aiPrompt}\n\nเนื้อหาที่อ่านได้:\n${extracted.excerpt}`, abortController.signal)
        }

        const nextAuthor = ai.author?.trim() || currentApa.Author || ''
        const nextResearchers = ai.researchers?.map((item) => item.trim()).filter(Boolean) || currentApa.Researchers || []
        const nextAbstract = ai.abstract?.trim() || currentApa.Abstract || ''
        const nextKeyStats = ai.keyStats?.map((s) => s.trim()).filter(Boolean) || currentApa.KeyStats || []
        const aiTitle = ai.title?.trim() || ''
        const nextTitle = aiTitle || currentApa.Title || fileName.replace(/\.[^.]+$/, '')
        const nextYear = ai.year?.trim() || extractYear(fileName)

        if (!nextAuthor && !nextResearchers.length && !nextAbstract) {
          enqueue('error', { error: 'AI อ่านไฟล์ได้ไม่พอสำหรับสร้าง Author/Abstract จากเอกสารนี้' })
          controller.close()
          return
        }

        const nextApa: ApaResult = {
          ...currentApa,
          Author: nextAuthor,
          Researchers: nextResearchers,
          Title: nextTitle,
          Abstract: nextAbstract,
          KeyStats: nextKeyStats,
          ProjectInfo: currentApa.ProjectInfo,
          APA_String: buildApaString({
            author: nextAuthor,
            year: nextYear,
            title: nextTitle,
            fileUrl: `${APP_URL}/api/files/${fileId}?download=1`,
          }),
        }

        enqueue('progress', { step: 'saving', message: 'บันทึกข้อมูล...' })

        const readableStream = Readable.from(buffer)
        const contentType = (oldMeta['content-type'] as string) || 'application/octet-stream'
        const newMeta = {
          'Content-Type': contentType,
          'x-amz-meta-name': (oldMeta['name'] as string) || encodeURIComponent(fileName),
          'x-amz-meta-path': (oldMeta['path'] as string) || encodeURIComponent(fileName),
          'x-amz-meta-extension': (oldMeta['extension'] as string) || '',
          'x-amz-meta-previewkind': (oldMeta['previewkind'] as string) || 'unsupported',
          'x-amz-meta-size': (oldMeta['size'] as string) || stat.size.toString(),
          'x-amz-meta-uploadedat': (oldMeta['uploadedat'] as string) || '0',
          'x-amz-meta-apaauthor': encodeURIComponent(trimMetadataValue(nextApa.Author, 180)),
          'x-amz-meta-apatitle': encodeURIComponent(trimMetadataValue(nextApa.Title, 240)),
        }

        await minioClient.putObject(BUCKET_NAME, fileId, readableStream, buffer.length, newMeta)
        await writeApaMetadata(fileId, {
          ...nextApa,
          Researchers: trimResearchers(nextApa.Researchers),
          Abstract: trimMetadataValue(nextApa.Abstract, 6000),
        })

        enqueue('result', nextApa)
        enqueue('done', { final: true })
        controller.close()
      } catch (error) {
        console.error('AI metadata enrichment error:', error)
        const message = error instanceof Error ? error.message : 'Failed to enrich metadata'
        enqueue('error', { error: message })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}