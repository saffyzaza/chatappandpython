import type { FileInsightResult } from '@/app/fileapa/insightTypes'
import { buildFallbackInsight, extractFileInsightInput } from '@/lib/fileInsights'
import { BUCKET_NAME, minioClient } from '@/lib/minio'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AISTUDIO_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const PDF_MODEL = process.env.GEMINI_FILE_MODEL || 'gemini-2.5-pro'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const APP_TITLE = 'Musya File Insights'
const MAX_DIRECT_PDF_BYTES = 4 * 1024 * 1024

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

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

async function callAIStudioWithPdf(args: {
  prompt: string
  fileName: string
  buffer: Buffer
  signal?: AbortSignal
}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing')

  const dataUrl = `data:application/pdf;base64,${args.buffer.toString('base64')}`
  const response = await fetch(AISTUDIO_URL, {
    method: 'POST',
    signal: args.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PDF_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'คุณคือผู้ช่วยวิเคราะห์เอกสารภาษาไทย สรุปสาระสำคัญให้ชัดเจน กระชับ และตอบเป็น JSON เท่านั้น',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: args.prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
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

  return extractJson<{ abstract: string; summary: string[] }>(getMessageContent(payload))
}

async function callAIStudio(prompt: string, signal?: AbortSignal) {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing')
  }

  const response = await fetch(AISTUDIO_URL, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'คุณคือผู้ช่วยวิเคราะห์เอกสารภาษาไทย สรุปสาระสำคัญให้ชัดเจน กระชับ และตอบเป็น JSON เท่านั้น',
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

  return extractJson<{ abstract: string; summary: string[] }>(getMessageContent(payload))
}

export async function GET(request: Request, { params }: RouteParams) {
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
        const meta = stat.metaData || {}
        const fileName = decodeURIComponent((meta['name'] as string) || fileId)
        const objectStream = await minioClient.getObject(BUCKET_NAME, fileId)
        const chunks: Buffer[] = []

        await new Promise<void>((resolve, reject) => {
          objectStream.on('data', (chunk: Buffer) => chunks.push(chunk))
          objectStream.on('end', resolve)
          objectStream.on('error', reject)
        })

        const buffer = Buffer.concat(chunks)
        const extracted = await extractFileInsightInput({ buffer, fileName })
        const fallback = buildFallbackInsight({
          fileId,
          fileName,
          excerpt: extracted.excerpt,
          charts: extracted.charts,
        })

        enqueue('fallback', fallback)

        const aiPrompt = [
          `ชื่อไฟล์: ${fileName}`,
          'ช่วยสรุปเอกสารนี้เป็นภาษาไทย โดยตอบ JSON ตาม schema นี้เท่านั้น:',
          '{"abstract":"string","summary":["string"]}',
          'ให้ abstract เป็นบทคัดย่อสั้น 1 ย่อหน้า และ summary เป็น bullet 3-5 ข้อที่จับสาระสำคัญ',
        ].join('\n\n')

        const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
        const isPdf = extension === 'pdf'

        try {
          let ai: { abstract: string; summary: string[] }

          if (extracted.excerpt.trim()) {
            ai = await callAIStudio(
              `${aiPrompt}\n\nเนื้อหาที่อ่านได้:\n${extracted.excerpt}`,
              abortController.signal,
            )
          } else if (isPdf && buffer.length <= MAX_DIRECT_PDF_BYTES) {
            ai = await callAIStudioWithPdf({
              prompt: aiPrompt,
              fileName,
              buffer,
              signal: abortController.signal,
            })
          } else {
            enqueue('done', { final: true })
            controller.close()
            return
          }

          const final: FileInsightResult = {
            ...fallback,
            abstract: ai.abstract || fallback.abstract,
            summary: ai.summary?.length ? ai.summary : fallback.summary,
          }
          enqueue('result', final)
        } catch {
          enqueue('result', fallback)
        }

        enqueue('done', { final: true })
        controller.close()
      } catch (error) {
        console.error('File insight error:', error)
        const message = error instanceof Error ? error.message : 'Failed to analyze file'
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