import * as XLSX from 'xlsx'
import type { FileInsightResult, InsightChart } from '@/app/fileapa/insightTypes'

type TableRows = string[][]

function isLikelyTimeline(labels: string[]) {
  if (labels.length < 3) {
    return false
  }

  const years = labels
    .map((label) => {
      const m = label.match(/\b(19\d{2}|20\d{2}|25\d{2})\b/)
      return m ? Number(m[1]) : null
    })
    .filter((year): year is number => year !== null)

  if (years.length < Math.ceil(labels.length * 0.7)) {
    return false
  }

  for (let i = 1; i < years.length; i += 1) {
    if (years[i] < years[i - 1]) {
      return false
    }
  }

  return true
}

function buildChartInsight(title: string, points: Array<{ label: string; value: number }>) {
  if (!points.length) {
    return `ไม่พบข้อมูลเชิงตัวเลขเพียงพอในคอลัมน์ ${title}`
  }

  const sorted = [...points].sort((a, b) => b.value - a.value)
  const total = points.reduce((sum, item) => sum + item.value, 0)
  const top = sorted[0]
  const share = total > 0 ? (top.value / total) * 100 : 0

  if (isLikelyTimeline(points.map((point) => point.label))) {
    const first = points[0]
    const last = points[points.length - 1]
    const diff = last.value - first.value
    const direction = diff > 0 ? 'เพิ่มขึ้น' : diff < 0 ? 'ลดลง' : 'ทรงตัว'
    return `แนวโน้มค่า ${title} ${direction} จาก ${first.label} ไป ${last.label} (${first.value.toLocaleString()} → ${last.value.toLocaleString()})`
  }

  return `ค่าหลักอยู่ที่ ${top.label} (${top.value.toLocaleString()}) คิดเป็นประมาณ ${share.toFixed(1)}% ของกลุ่มข้อมูลนี้`
}

function normalizeRows(rows: Array<Array<string | number | boolean | null | undefined>>) {
  return rows
    .map((row) => row.map((cell) => `${cell ?? ''}`.trim()))
    .filter((row) => row.some((cell) => cell.length > 0))
}

function getNumericValue(value: string) {
  const normalized = value.replace(/,/g, '').trim()

  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function buildRowsPreview(rows: TableRows, maxRows = 12, maxCols = 6) {
  return rows
    .slice(0, maxRows)
    .map((row) => row.slice(0, maxCols).join(' | '))
    .join('\n')
}

function buildChartsFromRows(rows: TableRows): InsightChart[] {
  if (rows.length < 2) {
    return []
  }

  const header = rows[0]
  const dataRows = rows.slice(1, 9)
  const labelIndex = dataRows[0]?.findIndex((value) => getNumericValue(value) === null && value.trim().length > 0) ?? 0
  const fallbackLabelIndex = labelIndex >= 0 ? labelIndex : 0
  const charts: InsightChart[] = []

  for (let columnIndex = 0; columnIndex < header.length; columnIndex += 1) {
    if (columnIndex === fallbackLabelIndex) {
      continue
    }

    const points = dataRows
      .map((row, rowIndex) => {
        const value = getNumericValue(row[columnIndex] ?? '')

        if (value === null) {
          return null
        }

        return {
          label: row[fallbackLabelIndex] || `รายการ ${rowIndex + 1}`,
          value,
        }
      })
      .filter((entry): entry is { label: string; value: number } => Boolean(entry))

    if (points.length < 3) {
      continue
    }

    const labels = points.map((point) => point.label)
    const chartType: InsightChart['chartType'] = isLikelyTimeline(labels)
      ? 'line'
      : points.length <= 6
        ? 'pie'
        : 'bar'

    charts.push({
      title: header[columnIndex] || `ชุดข้อมูล ${columnIndex + 1}`,
      chartType,
      insight: buildChartInsight(header[columnIndex] || `ชุดข้อมูล ${columnIndex + 1}`, points),
      data: points,
    })

    if (charts.length === 3) {
      break
    }
  }

  return charts
}

async function extractPdfText(buffer: Buffer) {
  const isReadable = (text: string) => {
    const trimmed = text.trim()

    if (trimmed.length < 80) {
      return false
    }

    const mojibakeMatches = trimmed.match(/à¸|Ã|�/g) ?? []
    return mojibakeMatches.length / Math.max(trimmed.length, 1) < 0.05
  }

  const extractWithPdfJs = async () => {
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

      // pdfjs-dist v5 in Node.js: explicitly point to bundled worker
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
        import.meta.url,
      ).toString()

      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true })
      const pdf = await loadingTask.promise
      const pages: string[] = []

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .trim()

        if (pageText) {
          pages.push(pageText)
        }
      }

      return pages.join('\n').trim()
    } catch {
      return ''
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (input: Buffer) => Promise<{ text?: string }>
    const result = await pdfParse(buffer)
    const text = (result.text ?? '').trim()

    if (isReadable(text)) {
      return text
    }

    const fallbackText = await extractWithPdfJs()
    return fallbackText || text
  } catch {
    return extractWithPdfJs()
  }
}

function extractSheetRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const firstSheetName = workbook.SheetNames[0]
  const firstSheet = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(firstSheet, {
    header: 1,
    blankrows: false,
  })

  return normalizeRows(rawRows)
}

export async function extractFileInsightInput(args: {
  buffer: Buffer
  fileName: string
}): Promise<{ excerpt: string; charts: InsightChart[] }> {
  const extension = args.fileName.split('.').pop()?.toLowerCase() ?? ''

  if (extension === 'pdf') {
    const text = await extractPdfText(args.buffer)

    return {
      excerpt: text.slice(0, 300000),
      charts: [],
    }
  }

  if (['csv', 'xlsx', 'xls'].includes(extension)) {
    const rows = extractSheetRows(args.buffer)

    return {
      excerpt: buildRowsPreview(rows),
      charts: buildChartsFromRows(rows),
    }
  }

  return {
    excerpt: '',
    charts: [],
  }
}

export function buildFallbackInsight(args: {
  fileId: string
  fileName: string
  excerpt: string
  charts: InsightChart[]
}): FileInsightResult {
  return {
    fileId: args.fileId,
    fileName: args.fileName,
    abstract: `สรุปเบื้องต้นของไฟล์ ${args.fileName}`,
    summary: [
      'ระบบยังสกัดสาระสำคัญเชิง AI แบบละเอียดไม่ได้ จึงแสดงผลจากข้อมูลที่อ่านได้เบื้องต้น',
      args.excerpt ? 'มีข้อความหรือตารางตัวอย่างพร้อมสำหรับการตรวจอ่านต่อ' : 'ยังอ่านเนื้อหาเชิงลึกจากไฟล์นี้ไม่ได้',
      args.charts.length ? 'พบข้อมูลเชิงตัวเลขที่สามารถนำไปแสดงเป็นกราฟได้' : 'ยังไม่พบข้อมูลเชิงตัวเลขเพียงพอสำหรับสร้างกราฟ',
    ],
    charts: args.charts,
    sourceExcerpt: args.excerpt,
  }
}