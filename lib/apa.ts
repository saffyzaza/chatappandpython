import * as XLSX from 'xlsx'
import type { ApaResult } from '@/app/fileapa/apaTypes'

export function extractYear(text: string): string {
  const match = text.match(/\b(19|20)\d{2}\b/)
  return match ? match[0] : new Date().getFullYear().toString()
}

function firstNonEmpty(lines: string[]): string {
  return lines.find((line) => line.trim().length > 3)?.trim() ?? ''
}

function detectAgency(lines: string[]): string {
  const orgKeywords = /office|ministry|department|agency|bureau|institute|university|commission|authority|council|centre|center|สำนัก|กรม|กระทรวง|องค์การ|มหาวิทยาลัย/i
  const candidate = lines.find((line) => orgKeywords.test(line))
  return candidate?.trim() ?? ''
}

function detectAuthor(lines: string[], title: string, agency: string): string {
  const authorKeywords = /^(author|authors|ผู้แต่ง|เรียบเรียง|โดย)[:\s-]*/i
  const labelled = lines.find((line) => authorKeywords.test(line))

  if (labelled) {
    return labelled.replace(authorKeywords, '').trim()
  }

  const candidate = lines
    .slice(1, 6)
    .find((line) =>
      line !== title &&
      line !== agency &&
      !/abstract|บทคัดย่อ/i.test(line) &&
      !/\b(19|20)\d{2}\b/.test(line) &&
      line.length <= 120,
    )

  return candidate?.trim() ?? ''
}

async function extractFromPdf(buffer: Buffer): Promise<{ title: string; author: string; agency: string; year: string; abstract: string }> {
  // Load lazily so non-PDF uploads do not evaluate pdf-parse at route startup.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (input: Buffer) => Promise<{ text?: string }>
  const data = await pdfParse(buffer)
  const text: string = data.text ?? ''
  const lines = text.split('\n').map((line: string) => line.trim()).filter(Boolean)

  const title = firstNonEmpty(lines)
  const agency = detectAgency(lines)
  const author = detectAuthor(lines, title, agency)
  const year = extractYear(text)
  const abstractIndex = lines.findIndex((line: string) => /^abstract$/i.test(line))
  const abstract = abstractIndex !== -1
    ? lines.slice(abstractIndex + 1, abstractIndex + 6).join(' ')
    : lines.slice(1, 4).join(' ')

  return { title, author, agency, year, abstract }
}

function extractFromSheet(buffer: Buffer): { title: string; author: string; agency: string; year: string; abstract: string } {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  if (rows.length === 0) {
    return { title: '', author: '', agency: '', year: '', abstract: '' }
  }

  const findField = (row: Record<string, string>, ...keys: string[]): string => {
    for (const key of Object.keys(row)) {
      if (keys.some((candidate) => key.toLowerCase().includes(candidate))) {
        return String(row[key])
      }
    }

    return ''
  }

  const first = rows[0]
  const title = findField(first, 'title', 'ชื่อ', 'เรื่อง')
  const author = findField(first, 'author', 'authors', 'ผู้แต่ง', 'นักวิจัย')
  const agency = findField(first, 'agency', 'หน่วยงาน', 'organization', 'publisher')
  const year = findField(first, 'year', 'ปี', 'date') || extractYear(JSON.stringify(first))
  const abstract = findField(first, 'abstract', 'บทคัดย่อ', 'summary', 'description')

  return { title, author, agency, year, abstract }
}

export function canGenerateApa(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  return ['pdf', 'csv', 'xlsx', 'xls'].includes(extension)
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '')
}

export function buildApaString(args: {
  author: string
  fallbackAuthor?: string
  year?: string
  title: string
  fileUrl: string
}) {
  const authorPart = args.author || args.fallbackAuthor || 'Unknown Author'
  const yearPart = args.year || new Date().getFullYear().toString()

  return `${authorPart}. (${yearPart}). ${args.title}. [Online]. Available: ${args.fileUrl}`
}

export function trimMetadataValue(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength)
}

export function trimResearchers(researchers: string[], maxItems = 6, maxLength = 120) {
  return researchers
    .map((item) => trimMetadataValue(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

export function buildFallbackApaResult(args: {
  fileName: string
  fileUrl: string
  projectInfo: string
}): ApaResult {
  const title = stripExtension(args.fileName) || args.fileName
  const year = extractYear(args.fileName)

  return {
    Author: '',
    Researchers: [],
    Title: title,
    Abstract: '',
    KeyStats: [],
    ProjectInfo: args.projectInfo,
    APA_String: buildApaString({ author: '', year, title, fileUrl: args.fileUrl }),
  }
}

export async function generateApaResult(args: {
  buffer: Buffer
  fileName: string
  fileUrl: string
  projectInfo: string
}): Promise<ApaResult> {
  const extension = args.fileName.split('.').pop()?.toLowerCase() ?? ''

  try {
    const extracted = extension === 'pdf'
      ? await extractFromPdf(args.buffer)
      : extractFromSheet(args.buffer)

    const yearPart = extracted.year || new Date().getFullYear().toString()
    const titlePart = extracted.title || stripExtension(args.fileName) || args.fileName

    return {
      Author: extracted.author,
      Researchers: extracted.author ? [extracted.author] : [],
      Title: titlePart,
      Abstract: extracted.abstract,
      KeyStats: [],
      ProjectInfo: args.projectInfo,
      APA_String: buildApaString({
        author: extracted.author,
        fallbackAuthor: extracted.agency,
        year: yearPart,
        title: titlePart,
        fileUrl: args.fileUrl,
      }),
    }
  } catch {
    return buildFallbackApaResult(args)
  }
}