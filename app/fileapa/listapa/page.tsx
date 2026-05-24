'use client'

import Link from 'next/link'
import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { FileInsightResult } from '../insightTypes'
import { getAllFiles, type StoredFile } from '../fileStorage'

type ChartDisplayMode = 'table' | 'bar' | 'pie'

const CHART_COLORS = ['#eb6f45', '#4f87e2', '#29c063', '#f59f0a', '#8b5cf6', '#ef476f', '#14b8a6']

function formatChartValue(value: number) {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }

  if (Math.abs(value) >= 100) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function toPercent(value: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) {
    return 0
  }
  return (value / total) * 100
}

function isLikelyTimelineLabels(labels: string[]) {
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

function buildConicGradient(stops: Array<{ value: number; color: string }>) {
  const total = stops.reduce((sum, stop) => sum + Math.max(stop.value, 0), 0)

  if (total <= 0) {
    return 'conic-gradient(#e5e7eb 0 100%)'
  }

  let cursor = 0
  const segments = stops.map((stop) => {
    const next = cursor + toPercent(Math.max(stop.value, 0), total)
    const segment = `${stop.color} ${cursor.toFixed(2)}% ${next.toFixed(2)}%`
    cursor = next
    return segment
  })

  return `conic-gradient(${segments.join(',')})`
}

function buildChartNarrative(data: Array<{ label: string; value: number }>) {
  if (!data.length) {
    return ['ยังไม่มีข้อมูลเพียงพอสำหรับสรุปแนวโน้มของกราฟนี้']
  }

  const sorted = [...data].sort((a, b) => b.value - a.value)
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  const average = total / data.length
  const spread = top.value - bottom.value

  const lines = [
    `ค่าสูงสุดคือ ${top.label} ที่ ${formatChartValue(top.value)} (${toPercent(top.value, total).toFixed(1)}% ของทั้งหมด)`,
    `ค่าเฉลี่ยอยู่ที่ ${formatChartValue(average)} และช่วงความต่างสูงสุด-ต่ำสุดเท่ากับ ${formatChartValue(spread)}`,
  ]

  if (isLikelyTimelineLabels(data.map((item) => item.label))) {
    const first = data[0]
    const last = data[data.length - 1]
    const delta = last.value - first.value
    const direction = delta > 0 ? 'เพิ่มขึ้น' : delta < 0 ? 'ลดลง' : 'ทรงตัว'
    lines.push(
      `แนวโน้มตามเวลา ${direction} จาก ${first.label} (${formatChartValue(first.value)}) ไป ${last.label} (${formatChartValue(last.value)})`,
    )
  } else {
    lines.push(`ค่าต่ำสุดคือ ${bottom.label} ที่ ${formatChartValue(bottom.value)} ควรใช้เป็นจุดเทียบในการติดตามผล`) 
  }

  return lines
}

function getInitialChartMode(chartType: 'bar' | 'line' | 'pie'): ChartDisplayMode {
  if (chartType === 'pie') {
    return 'pie'
  }
  return 'bar'
}

function ListApaContent() {
  const searchParams = useSearchParams()
  const highlightedFileId = searchParams.get('fileId')
  const [files, setFiles] = useState<StoredFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [activeInsightFileId, setActiveInsightFileId] = useState<string | null>(highlightedFileId)
  const [enrichingFileId, setEnrichingFileId] = useState<string | null>(null)
  const [enrichProgress, setEnrichProgress] = useState<string>('')
  const [insight, setInsight] = useState<FileInsightResult | null>(null)
  const [isInsightLoading, setIsInsightLoading] = useState(false)
  const [insightProgress, setInsightProgress] = useState<string>('')
  const [insightError, setInsightError] = useState('')
  const [chartModes, setChartModes] = useState<Record<string, ChartDisplayMode>>({})

  useEffect(() => {
    const loadFiles = async () => {
      try {
        setIsLoading(true)
        setErrorMsg('')
        const storedFiles = await getAllFiles()
        setFiles(storedFiles)
      } catch {
        setErrorMsg('ไม่สามารถโหลดรายการ APA ได้')
      } finally {
        setIsLoading(false)
      }
    }

    void loadFiles()
  }, [])

  const apaFiles = useMemo(
    () => files.filter((file) => file.apa).sort((left, right) => right.uploadedAt - left.uploadedAt),
    [files],
  )

  const handleLoadInsight = async (fileId: string) => {
    if (activeInsightFileId === fileId && insight) {
      setActiveInsightFileId(null)
      setInsight(null)
      setInsightError('')
      setInsightProgress('')
      setChartModes({})
      return
    }

    setActiveInsightFileId(fileId)
    setIsInsightLoading(true)
    setInsightError('')
    setInsightProgress('กำลังอ่านไฟล์...')
    setInsight(null)
    setChartModes({})

    try {
      const response = await fetch(`/api/files/${fileId}/insights`)
      if (!response.ok || !response.body) {
        throw new Error('ไม่สามารถวิเคราะห์ไฟล์ได้')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const eventLine = part.split('\n').find((l) => l.startsWith('event:'))
          const dataLine = part.split('\n').find((l) => l.startsWith('data:'))
          if (!dataLine) continue
          const event = eventLine?.slice(6).trim() ?? ''
          try {
            const parsed = JSON.parse(dataLine.slice(5).trim()) as unknown
            if (event === 'fallback') {
              setInsight(parsed as FileInsightResult)
              setInsightProgress('AI กำลังวิเคราะห์เชิงลึก...')
            } else if (event === 'result') {
              setInsight(parsed as FileInsightResult)
              setInsightProgress('')
            } else if (event === 'done') {
              setInsightProgress('')
              setIsInsightLoading(false)
            } else if (event === 'error') {
              const msg = (parsed as { error?: string }).error || 'ไม่สามารถวิเคราะห์ไฟล์ได้'
              setInsightError(msg)
              setInsightProgress('')
              setIsInsightLoading(false)
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (error) {
      setInsight(null)
      setInsightError(error instanceof Error ? error.message : 'ไม่สามารถวิเคราะห์ไฟล์ได้')
    } finally {
      setIsInsightLoading(false)
      setInsightProgress('')
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleEnrichMetadata = async (fileId: string) => {
    setEnrichingFileId(fileId)
    setEnrichProgress('กำลังอ่านไฟล์...')

    try {
      const response = await fetch(`/api/files/${fileId}/ai-metadata`, { method: 'POST' })
      if (!response.ok || !response.body) {
        throw new Error('AI เติมข้อมูลไม่สำเร็จ')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const eventLine = part.split('\n').find((l) => l.startsWith('event:'))
          const dataLine = part.split('\n').find((l) => l.startsWith('data:'))
          if (!dataLine) continue
          const event = eventLine?.slice(6).trim() ?? ''
          try {
            const parsed = JSON.parse(dataLine.slice(5).trim()) as unknown
            if (event === 'progress') {
              const msg = (parsed as { message?: string }).message || ''
              setEnrichProgress(msg)
            } else if (event === 'result') {
              const apa = parsed as StoredFile['apa']
              setFiles((current) =>
                current.map((file) => (file.id === fileId ? { ...file, apa } : file)),
              )
            } else if (event === 'done') {
              setEnrichProgress('')
              setEnrichingFileId(null)
            } else if (event === 'error') {
              const msg = (parsed as { error?: string }).error || 'AI เติมข้อมูลไม่สำเร็จ'
              setErrorMsg(msg)
              setEnrichProgress('')
              setEnrichingFileId(null)
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'AI เติมข้อมูลไม่สำเร็จ')
    } finally {
      setEnrichingFileId(null)
      setEnrichProgress('')
    }
  }

  const getInternalUrl = (fileId: string) => `/api/files/${fileId}?download=1`
  const getOpenUrl = (file: StoredFile) => (file.previewKind === 'pdf' ? `/api/files/${file.id}` : `/fileapa/${file.id}`)

  return (
    <main className="min-h-screen bg-[#f8f3ef] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-2xl border border-[#eadcd3] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1e6df] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#eb6f45f1]">
                Abstracts & Titles
              </p>
              <h1 className="mt-1 text-lg font-semibold text-gray-800">ข้อมูลวิชาการทั้งหมด</h1>
            </div>
            <div className="text-sm font-medium text-[#eb6f45f1]">
              แสดง list ทั้งหมด ({apaFiles.length})
            </div>
          </div>
        </section>

        {errorMsg ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMsg}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-100 bg-white px-6 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#eb6f45f1] border-t-transparent" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Loading APA results...</p>
              <p className="mt-0.5 text-xs text-gray-400">Reading generated citations from uploaded files</p>
            </div>
          </div>
        ) : null}

        {!isLoading && !apaFiles.length ? (
          <div className="rounded-2xl border border-dashed border-[#f0dfd8] bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-700">ยังไม่มี APA info</p>
            <p className="mt-1 text-sm text-gray-400">อัปโหลดไฟล์ PDF, CSV หรือ XLSX จากหน้า File Workspace แล้วกลับมาดูผลที่หน้านี้ได้ทันที</p>
            <Link
              href="/fileapa"
              className="mt-4 inline-flex rounded-xl bg-[#eb6f45f1] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#fc632c]"
            >
              ไปที่ File Workspace
            </Link>
          </div>
        ) : null}

        {!isLoading && apaFiles.length ? (
          <div className="space-y-4">
            {apaFiles.map((file, index) => {
              const apa = file.apa

              if (!apa) {
                return null
              }

              const isHighlighted = highlightedFileId === file.id
              const isInsightOpen = activeInsightFileId === file.id && Boolean(insight)
              const currentInsight = activeInsightFileId === file.id ? insight : null
              const needsAiMetadata = !apa.Author || !apa.Abstract || !apa.Researchers.length

              return (
                <article
                  key={file.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                    isHighlighted ? 'border-[#eb6f45f1] ring-2 ring-[#ffd9cb]' : 'border-[#eee3dc]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-1 text-sm font-semibold text-[#eb6f45f1]">{index + 1} {'{'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#eb6f45f1]">
                            {isHighlighted ? 'Latest upload' : 'Citation Ready'}
                          </p>
                          <h2 className="mt-1 text-base font-semibold text-gray-800">{file.name}</h2>
                          <p className="mt-1 text-sm text-gray-500">{file.path}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleEnrichMetadata(file.id)}
                            disabled={enrichingFileId === file.id}
                            className="rounded-xl border border-[#eb6f45f1] px-3 py-2 text-sm font-medium text-[#eb6f45f1] transition hover:bg-[#fff3ee] disabled:cursor-wait disabled:opacity-60"
                          >
                            {enrichingFileId === file.id
                              ? (enrichProgress || 'AI กำลังอ่านไฟล์...')
                              : needsAiMetadata
                                ? 'AI เติม Author/Abstract'
                                : 'รีเฟรช AI Metadata'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleLoadInsight(file.id)}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-[#fff3ee]"
                          >
                            {activeInsightFileId === file.id ? 'ซ่อน AI Insight' : 'ดู AI Insight'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(apa.APA_String)}
                            className="rounded-xl bg-[#eb6f45f1] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#fc632c]"
                          >
                            {copied && isHighlighted ? 'Copied!' : 'Copy APA'}
                          </button>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-[#eef1f5] bg-[#fbfcfe]">
                        <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-4 text-xs leading-7 text-gray-700">
{`  "Author": ${JSON.stringify(apa.Author || '')},
  "Title": ${JSON.stringify(apa.Title || '')},
  "Abstract": ${JSON.stringify(apa.Abstract || '')},
  "ProjectInfo": ${JSON.stringify(apa.ProjectInfo || '')},
  "researchers": ${JSON.stringify(apa.Researchers || [])},
  "Internal URL": ${JSON.stringify(getInternalUrl(file.id))},
  "APA_String": ${JSON.stringify(apa.APA_String || '')}
}`}
                        </pre>
                      </div>

                      {apa.KeyStats && apa.KeyStats.length > 0 ? (
                        <div className="mt-3 rounded-2xl border border-[#eef1f5] bg-[#fbfcfe] px-4 py-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#eb6f45f1]">
                            Key Statistics
                          </p>
                          <ul className="space-y-1.5">
                            {apa.KeyStats.map((stat, i) => (
                              <li key={i} className="flex gap-2 text-xs leading-6 text-gray-700">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#eb6f45f1]" />
                                <span>{stat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={getOpenUrl(file)}
                          target={file.previewKind === 'pdf' ? '_blank' : undefined}
                          rel={file.previewKind === 'pdf' ? 'noreferrer' : undefined}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-[#fff3ee]"
                        >
                          เปิดไฟล์
                        </Link>
                        <a
                          href={getInternalUrl(file.id)}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-[#fff3ee]"
                        >
                          เปิด URL ภายใน
                        </a>
                      </div>

                      {activeInsightFileId === file.id ? (
                        <div className="mt-4 rounded-2xl border border-[#f0dfd8] bg-[#fffaf8] p-4">
                          {insightError ? (
                            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                              {insightError}
                            </div>
                          ) : null}

                          {isInsightLoading ? (
                            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-4 text-sm text-gray-500">
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#eb6f45f1] border-t-transparent" />
                              <span>{insightProgress || 'กำลังอ่านไฟล์และสร้างบทสรุปด้วย AI...'}</span>
                            </div>
                          ) : null}

                          {currentInsight ? (
                            <div className="space-y-4">
                              <div className="rounded-xl bg-white px-4 py-4">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#eb6f45f1]">Abstract</p>
                                <p className="mt-2 text-sm leading-7 text-gray-700">{currentInsight.abstract}</p>
                              </div>

                              <div className="rounded-xl bg-white px-4 py-4">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#eb6f45f1]">Summary</p>
                                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                                  {currentInsight.summary.map((item, summaryIndex) => (
                                    <li key={`${currentInsight.fileId}-summary-${summaryIndex}`} className="flex gap-2">
                                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#eb6f45f1]" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="rounded-xl bg-white px-4 py-4">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#eb6f45f1]">Charts</p>
                                {currentInsight.charts.length ? (
                                  <div className="mt-4 space-y-4">
                                    {currentInsight.charts.map((chart, chartIndex) => {
                                      const chartKey = `${currentInsight.fileId}-chart-${chartIndex}`
                                      const mode = chartModes[chartKey] ?? getInitialChartMode(chart.chartType)
                                      const timeline = isLikelyTimelineLabels(chart.data.map((item) => item.label))
                                      const sortedForRanking = [...chart.data].sort((a, b) => b.value - a.value)
                                      const baseData = timeline ? chart.data : sortedForRanking
                                      const pieData = [...baseData]
                                      const total = pieData.reduce((sum, item) => sum + item.value, 0)
                                      const maxValue = Math.max(...baseData.map((item) => item.value), 1)
                                      const chartNarrative = buildChartNarrative(baseData)

                                      return (
                                        <div
                                          key={`${currentInsight.fileId}-chart-${chartIndex}`}
                                          className="rounded-xl border border-[#e8edf3] bg-[#f7fafc] px-4 py-4 shadow-sm"
                                          style={{ background: 'linear-gradient(180deg, #fcfeff 0%, #f7fafc 100%)' }}
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                              <h3 className="text-sm font-semibold text-gray-800">{chart.title}</h3>
                                              <p className="mt-1 text-xs text-gray-500">{chart.insight}</p>
                                            </div>
                                            <div className="flex items-center gap-1 rounded-full border border-[#f3d5c8] bg-white p-1">
                                              {([
                                                { mode: 'table', label: 'ตาราง' },
                                                { mode: 'bar', label: 'แท่ง' },
                                                { mode: 'pie', label: 'วงกลม' },
                                              ] as const).map((opt) => (
                                                <button
                                                  key={opt.mode}
                                                  type="button"
                                                  onClick={() =>
                                                    setChartModes((current) => ({
                                                      ...current,
                                                      [chartKey]: opt.mode,
                                                    }))
                                                  }
                                                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                                    mode === opt.mode
                                                      ? 'bg-[#eb6f45f1] text-white shadow'
                                                      : 'text-gray-500 hover:bg-[#fff3ee]'
                                                  }`}
                                                >
                                                  {opt.label}
                                                </button>
                                              ))}
                                            </div>
                                          </div>

                                          {mode === 'table' ? (
                                            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8edf3] bg-white">
                                              <table className="min-w-full text-sm">
                                                <thead className="bg-[#f8fafc] text-xs uppercase tracking-wide text-gray-500">
                                                  <tr>
                                                    <th className="px-3 py-2 text-left font-semibold">อันดับ</th>
                                                    <th className="px-3 py-2 text-left font-semibold">รายการ</th>
                                                    <th className="px-3 py-2 text-right font-semibold">ค่า</th>
                                                    <th className="px-3 py-2 text-right font-semibold">สัดส่วน</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {baseData.map((item, rowIndex) => (
                                                    <tr key={`${chart.title}-${item.label}`} className="border-t border-[#eef2f6] text-gray-700">
                                                      <td className="px-3 py-2 text-xs text-gray-500">{rowIndex + 1}</td>
                                                      <td className="px-3 py-2">{item.label}</td>
                                                      <td className="px-3 py-2 text-right font-medium">{formatChartValue(item.value)}</td>
                                                      <td className="px-3 py-2 text-right text-gray-500">{toPercent(item.value, total).toFixed(1)}%</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          ) : null}

                                          {mode === 'bar' ? (
                                            <div className="mt-4 space-y-3">
                                              {baseData.map((item, dataIndex) => {
                                                const color = CHART_COLORS[dataIndex % CHART_COLORS.length]
                                                return (
                                                  <div key={`${chart.title}-${item.label}`}>
                                                    <div className="mb-1 flex items-center justify-between gap-3 text-xs text-gray-600">
                                                      <span className="truncate">{item.label}</span>
                                                      <span className="font-medium">{formatChartValue(item.value)}</span>
                                                    </div>
                                                    <div className="h-3 rounded-full bg-[#edf1f5]">
                                                      <div
                                                        className="h-3 rounded-full transition-all duration-500"
                                                        style={{
                                                          width: `${Math.max((item.value / maxValue) * 100, 6)}%`,
                                                          background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
                                                        }}
                                                      />
                                                    </div>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          ) : null}

                                          {mode === 'pie' ? (
                                            <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
                                              <div className="relative mx-auto h-52 w-52 rounded-full"
                                                style={{
                                                  background: buildConicGradient(
                                                    pieData.map((item, dataIndex) => ({
                                                      value: item.value,
                                                      color: CHART_COLORS[dataIndex % CHART_COLORS.length],
                                                    })),
                                                  ),
                                                }}
                                              >
                                                <div className="absolute inset-[23%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                                                  <p className="text-[11px] uppercase tracking-wider text-gray-400">รวมทั้งหมด</p>
                                                  <p className="mt-1 text-lg font-semibold text-gray-800">{formatChartValue(total)}</p>
                                                </div>
                                              </div>
                                              <div className="space-y-2">
                                                {pieData.map((item, dataIndex) => {
                                                  const color = CHART_COLORS[dataIndex % CHART_COLORS.length]
                                                  return (
                                                    <div key={`${chart.title}-pie-${item.label}`} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-xs text-gray-600">
                                                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                                                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                                      <span className="font-medium text-gray-700">{formatChartValue(item.value)}</span>
                                                      <span className="w-12 text-right text-gray-500">{toPercent(item.value, total).toFixed(1)}%</span>
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            </div>
                                          ) : null}

                                          <div className="mt-4 rounded-xl border border-[#e6ecf2] bg-white px-3 py-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4a6b9a]">วิเคราะห์กราฟ</p>
                                            <ul className="mt-2 space-y-1.5 text-xs leading-6 text-gray-700">
                                              {chartNarrative.map((line, lineIndex) => (
                                                <li key={`${chart.title}-analysis-${lineIndex}`} className="flex gap-2">
                                                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4f87e2]" />
                                                  <span>{line}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div className="mt-3 text-sm text-gray-500">ยังไม่พบชุดข้อมูลตัวเลขที่เพียงพอสำหรับสร้างกราฟจากไฟล์นี้</div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="pt-1 text-sm font-semibold text-[#eb6f45f1]">{'}'},</div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </div>
    </main>
  )
}

export default function ListApaPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-gray-400">กำลังโหลด...</div>}>
      <ListApaContent />
    </Suspense>
  )
}
