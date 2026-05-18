'use client'

import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { FileInsightResult } from '../insightTypes'
import { getAllFiles, type StoredFile } from '../fileStorage'

export default function ListApaPage() {
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
      return
    }

    setActiveInsightFileId(fileId)
    setIsInsightLoading(true)
    setInsightError('')
    setInsightProgress('กำลังอ่านไฟล์...')
    setInsight(null)

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
                                      const maxValue = Math.max(...chart.data.map((item) => item.value), 1)

                                      return (
                                        <div key={`${currentInsight.fileId}-chart-${chartIndex}`} className="rounded-xl border border-[#f0dfd8] bg-[#fcfbf9] px-4 py-4">
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                              <h3 className="text-sm font-semibold text-gray-800">{chart.title}</h3>
                                              <p className="mt-1 text-xs text-gray-500">{chart.insight}</p>
                                            </div>
                                            <span className="rounded-full bg-[#fff3ee] px-2.5 py-1 text-[11px] font-medium uppercase text-[#c85f35]">
                                              {chart.chartType}
                                            </span>
                                          </div>

                                          <div className="mt-4 space-y-3">
                                            {chart.data.map((item) => (
                                              <div key={`${chart.title}-${item.label}`}>
                                                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-gray-500">
                                                  <span className="truncate">{item.label}</span>
                                                  <span>{item.value.toLocaleString()}</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-[#f5dfd5]">
                                                  <div
                                                    className="h-2 rounded-full bg-[#eb6f45f1]"
                                                    style={{ width: `${Math.max((item.value / maxValue) * 100, 8)}%` }}
                                                  />
                                                </div>
                                              </div>
                                            ))}
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
