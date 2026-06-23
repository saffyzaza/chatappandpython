'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { saveFile } from '../fileapa/fileStorage'

// ─── Types ────────────────────────────────────────────────────────────────────
type UploadedPdf = {
  id: string
  name: string
  size: number
  uploadedAt: number
  ingested: boolean
  ingestJobId?: string
  ingestStatus?: 'queued' | 'running' | 'completed' | 'error'
  province?: string | null
  district?: string | null
  saved_at?: string | null
}

type ProgressLog = { msg: string; status: string }

type IngestResult = {
  base_filename: string
  total_pages: number
  total_chunks: number
  created_files: string[]
  index_file: string
  province?: string | null
  district?: string | null
  location_confidence?: string
  saved_at?: string
}

type VaultNode = {
  type: 'folder' | 'file'
  name: string
  path: string
  size?: number
  modified_at?: number
  children?: VaultNode[]
}

type VaultData = {
  zone10: VaultNode[]
  root_files: VaultNode[]
  provinces: string[]
}

// ─── Zone 10 Provinces ───────────────────────────────────────────────────────
const PROVINCE_COLORS: Record<string, string> = {
  'อุบลราชธานี': 'from-violet-600 to-purple-600',
  'ศรีสะเกษ':   'from-blue-600 to-cyan-600',
  'ยโสธร':      'from-emerald-600 to-teal-600',
  'อำนาจเจริญ': 'from-amber-600 to-orange-600',
  'มุกดาหาร':   'from-rose-600 to-pink-600',
}
const PROVINCE_BG: Record<string, string> = {
  'อุบลราชธานี': 'bg-violet-100 border-violet-200 text-violet-700',
  'ศรีสะเกษ':   'bg-blue-100 border-blue-200 text-blue-700',
  'ยโสธร':      'bg-emerald-100 border-emerald-200 text-emerald-700',
  'อำนาจเจริญ': 'bg-amber-100 border-amber-200 text-amber-700',
  'มุกดาหาร':   'bg-rose-100 border-rose-200 text-rose-700',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number): string {
  if (!ts) return ''
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts))
}

// ─── Province Badge ───────────────────────────────────────────────────────────
function ProvinceBadge({ province, district }: { province?: string | null; district?: string | null }) {
  if (!province) return null
  const cls = PROVINCE_BG[province] || 'bg-gray-100 border-gray-200 text-gray-700'
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
      <span>📍</span>
      <span>{province}{district ? ` / ${district}` : ''}</span>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, ingested }: { status?: string; ingested: boolean }) {
  if (status === 'running' || status === 'queued') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
        </span>
        {status === 'queued' ? 'รอดำเนินการ' : 'กำลัง Ingest'}
      </span>
    )
  }
  if (status === 'completed' || ingested) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
        ✓ Ingested
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
        ✕ Error
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
      อัพโหลดแล้ว
    </span>
  )
}

// ─── Vault Tree Node ──────────────────────────────────────────────────────────
function VaultTreeNode({ node, depth = 0 }: { node: VaultNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1)
  const isFolder = node.type === 'folder'
  const indent = depth * 12

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer transition-all text-xs ${
          isFolder
            ? 'hover:bg-[#fff4f0] text-gray-800 font-medium'
            : 'hover:bg-gray-50 text-gray-600 pl-6'
        }`}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={() => isFolder && setOpen(o => !o)}
      >
        {isFolder && (
          <span className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>▶</span>
        )}
        <span className="text-sm">{isFolder ? '📂' : '📝'}</span>
        <span className="truncate flex-1 min-w-0">{node.name}</span>
        {!isFolder && node.size && (
          <span className="text-gray-400 text-[10px] flex-none">{formatBytes(node.size)}</span>
        )}
        {isFolder && node.children && (
          <span className="text-gray-400 text-[10px] flex-none">{node.children.length}</span>
        )}
      </div>
      {isFolder && open && node.children && (
        <div>
          {node.children.map((child, i) => (
            <VaultTreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PdfUploadPage() {
  const [pdfs, setPdfs] = useState<UploadedPdf[]>([])
  const [selectedPdf, setSelectedPdf] = useState<UploadedPdf | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [logs, setLogs] = useState<ProgressLog[]>([])
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null)
  const [activeTab, setActiveTab] = useState<'viewer' | 'logs' | 'vault'>('viewer')
  const [vaultData, setVaultData] = useState<VaultData>({ zone10: [], root_files: [], provinces: [] })
  const [pollingJobId, setPollingJobId] = useState<string | null>(null)
  const [filterProvince, setFilterProvince] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadPdfs()
    loadVaultData()
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    if (!pollingJobId) {
      if (pollingRef.current) clearInterval(pollingRef.current)
      return
    }
    pollingRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`/api/pdf/ingest/status/${pollingJobId}`)
        if (!resp.ok) return
        const data = await resp.json() as {
          status: string
          progress?: { msg: string }[]
          result?: IngestResult
          error?: string
        }

        const newLogs = (data.progress || []).map((p) => ({ msg: p.msg, status: data.status }))
        setLogs(newLogs)

        if (data.status === 'completed' || data.status === 'error') {
          clearInterval(pollingRef.current!)
          setPollingJobId(null)
          if (data.status === 'completed' && data.result) {
            setIngestResult(data.result)
            setActiveTab('logs')
            loadVaultData()
          }
          setPdfs((prev) =>
            prev.map((p) =>
              p.ingestJobId === pollingJobId
                ? {
                    ...p,
                    ingestStatus: data.status as UploadedPdf['ingestStatus'],
                    ingested: data.status === 'completed',
                    province: data.result?.province,
                    district: data.result?.district,
                    saved_at: data.result?.saved_at,
                  }
                : p
            )
          )
        } else {
          setPdfs((prev) =>
            prev.map((p) =>
              p.ingestJobId === pollingJobId
                ? { ...p, ingestStatus: data.status as UploadedPdf['ingestStatus'] }
                : p
            )
          )
        }
      } catch { /* ignore */ }
    }, 2000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [pollingJobId])

  const loadPdfs = async () => {
    try {
      const resp = await fetch('/api/pdf/files')
      const data = await resp.json() as { files?: UploadedPdf[] }
      if (data.files) setPdfs(data.files.map(f => ({ ...f, uploadedAt: parseInt(String(f.uploadedAt || '0')) })))
    } catch { /* ignore */ }
  }

  const loadVaultData = async () => {
    try {
      const resp = await fetch('/api/pdf/vault')
      const data = await resp.json() as VaultData
      setVaultData(data)
    } catch { /* ignore */ }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const pdfFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf')
    if (!pdfFiles.length) {
      alert('กรุณาเลือกเฉพาะไฟล์ PDF เท่านั้น')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i]
      try {
        setUploadProgress(Math.round((i / pdfFiles.length) * 80))
        const saved = await saveFile(file, file.name)
        const newPdf: UploadedPdf = {
          id: saved.id,
          name: saved.name,
          size: saved.size,
          uploadedAt: saved.uploadedAt,
          ingested: false,
        }
        setPdfs(prev => [newPdf, ...prev])
        setSelectedPdf(newPdf)
        setActiveTab('viewer')
        setUploadProgress(Math.round(((i + 1) / pdfFiles.length) * 100))
      } catch (err) {
        alert(`เกิดข้อผิดพลาดในการอัพโหลด: ${file.name}: ${err}`)
      }
    }

    setTimeout(() => { setUploading(false); setUploadProgress(0) }, 800)
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    await handleFiles(e.dataTransfer.files)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleDelete = async (pdf: UploadedPdf) => {
    if (!confirm(`ลบไฟล์ "${pdf.name}" ใช่หรือไม่?`)) return
    try {
      await fetch(`/api/pdf/files/${pdf.id}`, { method: 'DELETE' })
      setPdfs(prev => prev.filter(p => p.id !== pdf.id))
      if (selectedPdf?.id === pdf.id) setSelectedPdf(null)
    } catch (err) {
      alert(`เกิดข้อผิดพลาดในการลบ: ${err}`)
    }
  }

  const handleIngest = async (pdf: UploadedPdf) => {
    setLogs([])
    setIngestResult(null)
    setActiveTab('logs')

    try {
      const resp = await fetch('/api/pdf/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: pdf.id, original_name: pdf.name }),
      })
      const data = await resp.json() as { job_id?: string; error?: string }
      if (!data.job_id) {
        setLogs([{ msg: `❌ ${data.error || 'เกิดข้อผิดพลาด'}`, status: 'error' }])
        return
      }
      setPollingJobId(data.job_id)
      setPdfs(prev => prev.map(p =>
        p.id === pdf.id ? { ...p, ingestJobId: data.job_id, ingestStatus: 'queued' } : p
      ))
      setLogs([{ msg: '🚀 เริ่มต้น Ingest Job...', status: 'queued' }])
    } catch (err) {
      setLogs([{ msg: `❌ ${String(err)}`, status: 'error' }])
    }
  }

  const filteredPdfs = filterProvince
    ? pdfs.filter(p => p.province === filterProvince)
    : pdfs

  const pdfUrl = selectedPdf ? `/api/files/${selectedPdf.id}` : null

  return (
    <div className="h-full min-h-0 overflow-hidden bg-white text-gray-800 flex flex-col">
      {/* Header */}
      <header className="flex-none border-b border-[#fff0e5] bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f26522] flex items-center justify-center shadow-md shadow-[#f26522]/20 text-white">
              <span className="text-base">📄</span>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-gray-800">
                PDF Knowledge Ingest · เขต 10
              </h1>
              <p className="text-[10px] text-gray-500">อุบลราชธานี · ศรีสะเกษ · ยโสธร · อำนาจเจริญ · มุกดาหาร</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fff0e5] border border-[#fbd5c8]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f26522] animate-pulse"></span>
              <span className="text-xs text-[#f26522] font-medium">Gemini 3 Pro</span>
            </div>
            <div className="text-xs text-gray-500 bg-white border border-[#fff0e5] rounded-lg px-2.5 py-1.5">
              <span className="text-emerald-600 font-medium">musya knowlads</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* ── Left Panel ── */}
        <div className="w-72 flex-none flex flex-col border-r border-[#fff0e5] bg-white">

          {/* Upload Zone */}
          <div className="flex-none p-3">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all duration-300 group ${
                isDragging
                  ? 'border-[#f26522] bg-[#fff0e5] scale-[1.02]'
                  : 'border-[#fbd5c8] hover:border-[#f26522] hover:bg-[#fff0e5] bg-white'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {uploading ? (
                <div className="space-y-2">
                  <span className="text-xl animate-bounce block">📤</span>
                  <p className="text-xs text-gray-600">กำลังอัพโหลด...</p>
                  <div className="w-full bg-[#fff0e5] rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-[#f26522] rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs font-bold text-[#f26522]">{uploadProgress}%</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-2xl block">📁</span>
                  <p className="text-sm font-semibold text-gray-700">{isDragging ? 'วางไฟล์ที่นี่' : 'อัพโหลด PDF'}</p>
                  <p className="text-[10px] text-gray-400">ลากวาง หรือคลิก · ไม่จำกัดขนาด</p>
                </div>
              )}
            </div>
          </div>

          {/* Province Filter */}
          <div className="flex-none px-3 pb-2">
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFilterProvince(null)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${!filterProvince ? 'bg-[#f26522] border-[#f26522] text-white shadow-sm shadow-[#f26522]/20' : 'bg-white border-[#fff0e5] text-gray-500 hover:text-[#f26522] hover:bg-[#fff0e5]'}`}
              >
                ทั้งหมด
              </button>
              {Object.keys(PROVINCE_COLORS).map(p => (
                <button
                  key={p}
                  onClick={() => setFilterProvince(prev => prev === p ? null : p)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${filterProvince === p ? 'bg-[#f26522] border-[#f26522] text-white shadow-sm shadow-[#f26522]/20' : 'bg-white border-[#fff0e5] text-gray-500 hover:text-[#f26522] hover:bg-[#fff0e5]'}`}
                >
                  {p.slice(0, 4)}
                </button>
              ))}
            </div>
          </div>

          {/* PDF List */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                PDF ({filteredPdfs.length})
              </p>
              <button onClick={loadPdfs} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">↻</button>
            </div>

            {filteredPdfs.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs">
                <p className="text-xl mb-1">📄</p>
                <p>ยังไม่มีไฟล์ PDF</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    onClick={() => { setSelectedPdf(pdf); setActiveTab('viewer') }}
                    className={`group relative rounded-xl p-2.5 cursor-pointer transition-all duration-200 border ${
                      selectedPdf?.id === pdf.id
                        ? 'bg-[#fff0e5] border-[#fbd5c8] shadow-sm shadow-[#f26522]/5'
                        : 'bg-white border-[#fff0e5] hover:bg-[#fff0e5] hover:border-[#fbd5c8] shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#fff0e5] flex items-center justify-center flex-none">
                        <span className="text-sm">📄</span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-medium text-gray-800 truncate leading-tight">{pdf.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={pdf.ingestStatus} ingested={pdf.ingested} />
                          {pdf.province && <ProvinceBadge province={pdf.province} district={pdf.district} />}
                        </div>
                        {pdf.saved_at && (
                          <p className="text-[9px] text-gray-400 truncate">📁 {pdf.saved_at}</p>
                        )}
                      </div>
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(pdf) }}
                        title="ลบไฟล์"
                        className="flex-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-6 h-6 rounded-md bg-red-500/20 hover:bg-red-500/50 border border-red-500/30 hover:border-red-500/60 flex items-center justify-center text-red-400 hover:text-red-200 text-[11px]"
                      >
                        🗑
                      </button>
                    </div>

                    {!pdf.ingested && pdf.ingestStatus !== 'running' && pdf.ingestStatus !== 'queued' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleIngest(pdf) }}
                        className="mt-2 w-full rounded-lg bg-[#f26522] hover:bg-[#e15518] text-white text-[10px] font-semibold py-1 transition-all shadow-sm shadow-[#f26522]/20"
                      >
                        ✨ Ingest → Obsidian
                      </button>
                    )}
                    {(pdf.ingestStatus === 'running' || pdf.ingestStatus === 'queued') && (
                      <div className="mt-2 w-full rounded-lg bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-semibold py-1 text-center">
                        ⏳ กำลังประมวลผล...
                      </div>
                    )}
                    {(pdf.ingestStatus === 'completed' || pdf.ingested) && (
                      <div className="mt-2 w-full rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-semibold py-1 text-center">
                        ✅ Ingest สำเร็จแล้ว
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex-none flex items-center gap-1 px-4 pt-3 pb-0 border-b border-[#fff0e5]">
            {[
              { key: 'viewer', label: '📄 PDF Viewer' },
              { key: 'logs', label: '⚡ Ingest Log' },
              { key: 'vault', label: '🗂️ Vault เขต 10' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all duration-200 relative ${
                  activeTab === tab.key
                    ? 'text-[#f26522] bg-white border border-[#fff0e5] border-b-transparent -mb-px'
                    : 'text-gray-500 hover:text-[#f26522] hover:bg-[#fff0e5]'
                }`}
              >
                {tab.label}
                {tab.key === 'logs' && logs.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#f26522] text-white text-[9px] flex items-center justify-center font-bold">
                    {Math.min(logs.length, 99)}
                  </span>
                )}
              </button>
            ))}
            {selectedPdf && (
              <div className="ml-auto flex items-center gap-2 pb-2">
                <span className="text-xs text-gray-400 truncate max-w-48">{selectedPdf.name}</span>
              </div>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0 overflow-hidden">

            {/* PDF Viewer */}
            {activeTab === 'viewer' && (
              <div className="h-full flex flex-col">
                {pdfUrl ? (
                  <iframe
                    key={pdfUrl}
                    src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
                    className="flex-1 w-full border-0"
                    title={selectedPdf?.name}
                    style={{ background: 'white' }}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-4">
                    <span className="text-5xl opacity-40">📄</span>
                    <div className="text-center">
                      <p className="text-base font-semibold text-gray-500">ยังไม่ได้เลือกไฟล์</p>
                      <p className="text-sm text-gray-400 mt-1">เลือก PDF จากรายการทางซ้าย</p>
                    </div>
                    {/* Zone 10 Map Summary */}
                    <div className="mt-6 grid grid-cols-5 gap-2 max-w-lg">
                      {Object.entries(PROVINCE_COLORS).map(([prov, grad]) => (
                        <div key={prov} className="text-center">
                          <div className={`w-10 h-10 mx-auto rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-sm shadow-sm opacity-90`}>
                            🏛️
                          </div>
                          <p className="text-[9px] text-gray-400 mt-1 leading-tight">{prov.slice(0, 4)}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400">5 จังหวัด สาธารณสุขเขต 10</p>
                  </div>
                )}
              </div>
            )}

            {/* Ingest Log */}
            {activeTab === 'logs' && (
              <div className="h-full flex flex-col overflow-hidden p-4 gap-3">
                {ingestResult && (
                  <div className="flex-none rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">🎉</span>
                      <h3 className="text-sm font-bold text-emerald-400">Ingest สำเร็จ!</h3>
                      {ingestResult.province && (
                        <ProvinceBadge province={ingestResult.province} district={ingestResult.district} />
                      )}
                    </div>

                    {/* Location info */}
                    {ingestResult.province && (
                      <div className={`rounded-xl p-3 mb-3 border ${PROVINCE_BG[ingestResult.province] || 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">📍 บันทึกที่</p>
                        <p className="text-xs font-semibold">
                          เขต 10 › {ingestResult.province}{ingestResult.district ? ` › ${ingestResult.district}` : ''}
                        </p>
                        <p className="text-[10px] opacity-70 mt-0.5">
                          📁 {ingestResult.saved_at}
                        </p>
                        <p className="text-[10px] opacity-50 mt-0.5">
                          ความแม่นยำ: {ingestResult.location_confidence}
                        </p>
                      </div>
                    )}
                    {!ingestResult.province && (
                      <div className="rounded-xl p-3 mb-3 bg-[#fff0e5] border border-[#fbd5c8] text-gray-700">
                        <p className="text-xs">📁 บันทึกที่ root vault (ไม่พบข้อมูลจังหวัดในเขต 10)</p>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-white border border-[#fff0e5] shadow-sm rounded-xl p-2.5 text-center">
                        <p className="text-xl font-bold text-gray-800">{ingestResult.total_pages}</p>
                        <p className="text-[10px] text-gray-500">หน้า PDF</p>
                      </div>
                      <div className="bg-white border border-[#fff0e5] shadow-sm rounded-xl p-2.5 text-center">
                        <p className="text-xl font-bold text-[#f26522]">{ingestResult.total_chunks}</p>
                        <p className="text-[10px] text-gray-500">ไฟล์ MD</p>
                      </div>
                      <div className="bg-white border border-[#fff0e5] shadow-sm rounded-xl p-2.5 text-center">
                        <p className="text-xl font-bold text-indigo-600">10:1</p>
                        <p className="text-[10px] text-gray-500">อัตราส่วน</p>
                      </div>
                    </div>

                    <div className="bg-white border border-[#fff0e5] shadow-sm rounded-xl p-2.5 mb-2">
                      <p className="text-[10px] text-gray-500 mb-0.5">ชื่อเอกสาร</p>
                      <p className="text-xs font-bold text-[#f26522]">📝 {ingestResult.base_filename}</p>
                    </div>

                    <div className="max-h-20 overflow-y-auto space-y-0.5">
                      <p className="text-[10px] text-gray-400 mb-1">ไฟล์ที่สร้าง ({ingestResult.created_files.length + 1}):</p>
                      <div className="text-[10px] text-emerald-600 flex items-center gap-1">
                        <span>📚</span><span>{ingestResult.index_file}</span>
                      </div>
                      {ingestResult.created_files.map((f, i) => (
                        <div key={i} className="text-[10px] text-gray-500 flex items-center gap-1">
                          <span>📄</span><span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex-1 min-h-0 rounded-2xl bg-white border border-[#fff0e5] overflow-hidden">
                  <div className="border-b border-[#fff0e5] px-4 py-2 flex items-center gap-2 bg-[#fff0e5]/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <p className="text-xs font-semibold text-gray-600">Progress Log</p>
                  </div>
                  <div className="overflow-y-auto p-3 font-mono space-y-1" style={{ height: 'calc(100% - 38px)' }}>
                    {logs.length === 0 ? (
                      <p className="text-gray-400 text-xs">กด &quot;Ingest → Obsidian&quot; บนไฟล์ PDF ที่ต้องการ...</p>
                    ) : (
                      logs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-gray-400 text-[10px] flex-none mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                          <span className={`text-xs leading-relaxed ${
                            log.msg.startsWith('❌') ? 'text-red-600' :
                            log.msg.startsWith('✅') || log.msg.startsWith('🎉') ? 'text-emerald-600' :
                            log.msg.startsWith('🤖') || log.msg.startsWith('🗺️') ? 'text-[#f26522]' :
                            log.msg.startsWith('📍') ? 'text-amber-600' :
                            log.msg.startsWith('📝') ? 'text-indigo-600' :
                            log.msg.startsWith('💾') ? 'text-cyan-600' :
                            log.msg.startsWith('📁') ? 'text-green-600' :
                            'text-gray-700'
                          }`}>{log.msg}</span>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>
            )}

            {/* Vault Tree */}
            {activeTab === 'vault' && (
              <div className="h-full overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-gray-800">🗂️ Obsidian Vault — เขต 10</h2>
                    <p className="text-xs text-gray-500 mt-0.5">musya knowlads · 5 จังหวัด</p>
                  </div>
                  <button
                    onClick={loadVaultData}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#fff0e5] hover:bg-[#fff0e5] text-xs text-gray-600 hover:text-[#f26522] transition-all shadow-sm"
                  >
                    ↻ รีเฟรช
                  </button>
                </div>

                {/* Province Cards */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                {Object.entries(PROVINCE_COLORS).map(([prov, grad]) => {
                    const provNode = vaultData.zone10.find(n => n.name === prov)
                    const children = provNode?.children ?? []
                    const docFolders = children.filter(c => c.type === 'folder')
                    // นับ md files ทั้ง direct + nested
                    const countFiles = (nodes: VaultNode[]): number =>
                      nodes.reduce((sum, n) => sum + (n.type === 'file' ? 1 : countFiles(n.children ?? [])), 0)
                    const totalMd = countFiles(children)
                    return (
                      <div key={prov} className="rounded-xl bg-white border border-[#fff0e5] p-2.5 text-center hover:bg-[#fff0e5] transition-all cursor-default shadow-sm">
                        <div className={`w-8 h-8 mx-auto rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center text-sm mb-1.5 shadow-sm opacity-90`}>
                          🏛️
                        </div>
                        <p className="text-[10px] font-bold text-gray-800 leading-tight">{prov}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">{docFolders.length} เอกสาร</p>
                        <p className="text-[9px] text-gray-400">{totalMd} ไฟล์ MD</p>
                      </div>
                    )
                  })}
                </div>

                {/* Tree */}
                <div className="rounded-xl bg-white border border-[#fff0e5] p-2 shadow-sm">
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-[#fff0e5]">
                    <span className="text-sm">🗂️</span>
                    <span className="text-xs font-bold text-gray-700">เขต10</span>
                  </div>

                  {vaultData.zone10.length === 0 ? (
                    <p className="text-gray-400 text-xs px-3 py-4 text-center">ยังไม่มีไฟล์ใน vault</p>
                  ) : (
                    vaultData.zone10.map((node, i) => (
                      <VaultTreeNode key={i} node={node} depth={0} />
                    ))
                  )}

                  {vaultData.root_files.length > 0 && (
                    <>
                      <div className="border-t border-[#fff0e5] my-2" />
                      <p className="text-[10px] text-gray-400 px-2 mb-1">ไฟล์ที่ root (ไม่ระบุจังหวัด)</p>
                      {vaultData.root_files.map((f, i) => (
                        <VaultTreeNode key={i} node={f} depth={0} />
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
