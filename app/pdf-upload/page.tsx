'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

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

const ZONE10_DISTRICTS: Record<string, string[]> = {
  'อุบลราชธานี': [
    'เมืองอุบลราชธานี', 'ศรีเมืองใหม่', 'โขงเจียม', 'เขื่องใน', 'เขมราฐ',
    'เดชอุดม', 'นาจะหลวย', 'น้ำยืน', 'บุณฑริก', 'ตระการพืชผล',
    'กุดข้าวปุ้น', 'ม่วงสามสิบ', 'วารินชำราบ', 'พิบูลมังสาหาร', 'ตาลสุม',
    'โพธิ์ไทร', 'สำโรง', 'ดอนมดแดง', 'สิรินธร', 'ทุ่งศรีอุดม',
    'นาเยีย', 'นาตาล', 'เหล่าเสือโก้ก', 'สว่างวีระวงศ์', 'น้ำขุ่น'
  ],
  'ศรีสะเกษ': [
    'เมืองศรีสะเกษ', 'ยางชุมน้อย', 'กันทรารมย์', 'กันทรลักษ์', 'ขุขันธ์',
    'ไพรบึง', 'ปรางค์กู่', 'ขุนหาญ', 'ราษีไศล', 'อุทุมพรพิสัย',
    'บึงบูรพ์', 'ห้วยทับทัน', 'โนนคูณ', 'ศรีรัตนะ', 'น้ำเกลี้ยง',
    'วังหิน', 'ภูสิงห์', 'เมืองจันทร์', 'เบญจลักษ์', 'พยุห์',
    'โพธิ์ศรีสุวรรณ', 'ศิลาลาด'
  ],
  'ยโสธร': [
    'เมืองยโสธร', 'ทรายมูล', 'กุดชุม', 'คำเขื่อนแก้ว', 'ป่าติ้ว',
    'มหาชนะชัย', 'ค้อวัง', 'เลิงนกทา', 'ไทยเจริญ'
  ],
  'อำนาจเจริญ': [
    'เมืองอำนาจเจริญ', 'ชานุมาน', 'ปทุมราชวงศา', 'พนา',
    'เสนางคนิคม', 'หัวตะพาน', 'ลืออำนาจ'
  ],
  'มุกดาหาร': [
    'เมืองมุกดาหาร', 'นิคมคำสร้อย', 'ดอนตาล', 'ดงหลวง',
    'คำชะอี', 'หว้านใหญ่', 'หนองสูง'
  ]
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
type VaultActions = {
  onEdit: (node: VaultNode) => void
  onDelete: (node: VaultNode) => void
  onRename: (node: VaultNode) => void
}

function VaultTreeNode({ node, depth = 0, actions }: { node: VaultNode; depth?: number; actions: VaultActions }) {
  const [open, setOpen] = useState(depth < 1)
  const isFolder = node.type === 'folder'
  const indent = depth * 12

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 py-1 px-2 rounded-lg transition-all text-xs cursor-pointer ${
          isFolder
            ? 'hover:bg-[#fff4f0] text-gray-800 font-medium'
            : 'hover:bg-orange-50 text-gray-600'
        }`}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={() => isFolder ? setOpen(o => !o) : actions.onEdit(node)}
      >
        {isFolder && (
          <span className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>▶</span>
        )}
        <span className="text-sm">{isFolder ? '📂' : '📝'}</span>
        <span className="truncate flex-1 min-w-0">{node.name}</span>
        {!isFolder && node.size && (
          <span className="text-gray-400 text-[10px] flex-none mr-1">{formatBytes(node.size)}</span>
        )}
        {isFolder && node.children && (
          <span className="text-gray-400 text-[10px] flex-none">{node.children.length}</span>
        )}
        {/* Action buttons — show on hover */}
        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-none ml-1">
          {!isFolder && (
            <button
              onClick={e => { e.stopPropagation(); actions.onEdit(node) }}
              className="p-0.5 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors"
              title="แก้ไข"
            >✏️</button>
          )}
          <button
            onClick={e => { e.stopPropagation(); actions.onRename(node) }}
            className="p-0.5 rounded hover:bg-amber-100 text-amber-500 hover:text-amber-700 transition-colors"
            title="เปลี่ยนชื่อ"
          >🏷️</button>
          <button
            onClick={e => { e.stopPropagation(); actions.onDelete(node) }}
            className="p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
            title={isFolder ? 'ลบโฟลเดอร์' : 'ลบไฟล์'}
          >🗑️</button>
        </span>
      </div>
      {isFolder && open && node.children && (
        <div>
          {node.children.map((child, i) => (
            <VaultTreeNode key={i} node={child} depth={depth + 1} actions={actions} />
          ))}
        </div>
      )}
    </div>
  )
}

function countActualDocsAndMd(nodes: VaultNode[]): { docs: number; md: number } {
  let docs = 0
  let md = 0

  const traverse = (node: VaultNode) => {
    if (node.type === 'file') {
      if (node.name !== 'INDEX.md') {
        md++
      }
    } else if (node.type === 'folder') {
      const hasRealFile = node.children?.some(c => c.type === 'file' && c.name !== 'INDEX.md')
      if (hasRealFile) {
        docs++
      }
      if (node.children) {
        node.children.forEach(traverse)
      }
    }
  }

  nodes.forEach(traverse)
  return { docs, md }
}

function renderSimpleMarkdown(text: string): string {
  if (!text) return '<p class="text-gray-400 italic">ไม่มีเนื้อหา</p>';
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return `<h1 class="text-xl font-bold text-gray-900 border-b border-gray-200 pb-2 mt-4 mb-2">${trimmed.slice(2)}</h1>`;
      }
      if (trimmed.startsWith('## ')) {
        return `<h2 class="text-lg font-bold text-gray-800 mt-3 mb-1.5">${trimmed.slice(3)}</h2>`;
      }
      if (trimmed.startsWith('### ')) {
        return `<h3 class="text-base font-bold text-gray-800 mt-3 mb-1">${trimmed.slice(4)}</h3>`;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.slice(2)
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<span class="text-[#f26522] font-semibold">$2</span>')
          .replace(/\[\[([^\]]+)\]\]/g, '<span class="text-[#f26522] font-semibold">$1</span>');
        return `<li class="list-disc ml-5 my-1 text-gray-700">${content}</li>`;
      }
      if (trimmed === '---') {
        return `<hr class="my-4 border-gray-200" />`;
      }
      const content = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<span class="text-[#f26522] hover:underline cursor-pointer">$2</span>')
        .replace(/\[\[([^\]]+)\]\]/g, '<span class="text-[#f26522] hover:underline cursor-pointer">$1</span>');
      return `<p class="my-1 text-gray-700 min-h-[1rem] leading-relaxed">${content}</p>`;
    })
    .join('');
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
  // Vault CRUD state
  const [editingNode, setEditingNode] = useState<VaultNode | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [editorSaving, setEditorSaving] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view')
  const [renameNode, setRenameNode] = useState<VaultNode | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [vaultBusy, setVaultBusy] = useState(false)
  const [newFilePath, setNewFilePath] = useState('')
  const [showNewFileDialog, setShowNewFileDialog] = useState(false)

  // Ingest custom configuration state
  const [ingestConfigPdf, setIngestConfigPdf] = useState<UploadedPdf | null>(null)
  const [ingestProvince, setIngestProvince] = useState<string>('auto')
  const [ingestDistrict, setIngestDistrict] = useState<string>('auto')
  const [ingestFolderName, setIngestFolderName] = useState<string>('')
  const [useAiFolderName, setUseAiFolderName] = useState<boolean>(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Vault handlers ─────────────────────────────────────────────────────────
  const handleVaultEdit = async (node: VaultNode) => {
    try {
      const res = await fetch(`/api/pdf/vault/file?path=${encodeURIComponent(node.path)}`)
      const data = await res.json() as { content?: string }
      setEditorContent(data.content || '')
      setEditingNode(node)
      setModalMode('view')
    } catch { alert('ไม่สามารถโหลดไฟล์ได้') }
  }

  const handleVaultSave = async () => {
    if (!editingNode) return
    setEditorSaving(true)
    try {
      await fetch(`/api/pdf/vault/file?path=${encodeURIComponent(editingNode.path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editorContent }),
      })
      setEditingNode(null)
      loadVaultData()
    } catch { alert('บันทึกไม่สำเร็จ') }
    setEditorSaving(false)
  }

  const handleVaultDelete = async (node: VaultNode) => {
    const label = node.type === 'folder' ? `โฟลเดอร์ "${node.name}" และไฟล์ทั้งหมดภายใน` : `ไฟล์ "${node.name}"`
    if (!confirm(`ยืนยันลบ${label}?`)) return
    setVaultBusy(true)
    try {
      await fetch(`/api/pdf/vault/file?path=${encodeURIComponent(node.path)}`, { method: 'DELETE' })
      loadVaultData()
      fetch('/api/obsidian/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vault_id: 'health_region_10' }),
      }).catch(() => {})
    } catch { alert('ลบไม่สำเร็จ') }
    setVaultBusy(false)
  }

  const handleVaultRename = async () => {
    if (!renameNode || !renameValue.trim()) return
    const parts = renameNode.path.split('/')
    parts[parts.length - 1] = renameValue.trim() + (renameNode.type === 'file' && !renameValue.endsWith('.md') ? '.md' : '')
    const newPath = parts.join('/')
    setVaultBusy(true)
    try {
      await fetch('/api/pdf/vault/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_path: renameNode.path, new_path: newPath }),
      })
      setRenameNode(null)
      loadVaultData()
    } catch { alert('เปลี่ยนชื่อไม่สำเร็จ') }
    setVaultBusy(false)
  }

  const handleVaultNewFile = async () => {
    if (!newFilePath.trim()) return
    const path = newFilePath.trim().endsWith('.md') ? newFilePath.trim() : newFilePath.trim() + '.md'
    setVaultBusy(true)
    try {
      await fetch(`/api/pdf/vault/file?path=${encodeURIComponent(path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `# ${path.split('/').pop()?.replace('.md', '')}\n\n` }),
      })
      setShowNewFileDialog(false)
      setNewFilePath('')
      loadVaultData()
    } catch { alert('สร้างไฟล์ไม่สำเร็จ') }
    setVaultBusy(false)
  }

  const vaultActions: VaultActions = {
    onEdit: handleVaultEdit,
    onDelete: handleVaultDelete,
    onRename: (node) => { setRenameNode(node); setRenameValue(node.name.replace('.md', '')) },
  }

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
            loadVaultData()
            // Auto-index vault หลัง ingest สำเร็จ (fire-and-forget)
            fetch('/api/obsidian/index', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ vault_id: 'health_region_10' }),
            }).catch(() => {})
            // รอให้ vault load แล้วค่อย switch ไป vault tab
            setTimeout(() => setActiveTab('vault'), 800)
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
      if (data.files) {
        const mapped = data.files.map(f => ({ ...f, uploadedAt: parseInt(String(f.uploadedAt || '0')) }))
        setPdfs(mapped)
        
        // Auto-resume polling if any job is still running or queued in backend
        const activeJob = mapped.find(p => p.ingestStatus === 'running' || p.ingestStatus === 'queued')
        if (activeJob && activeJob.ingestJobId) {
          setPollingJobId(activeJob.ingestJobId)
        }
      }
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

    // ตรวจสอบไฟล์ซ้ำกับรายการที่เคยอัปโหลดไปแล้ว
    const duplicates = pdfFiles.filter(f => pdfs.some(p => p.name === f.name))
    if (duplicates.length > 0) {
      alert(`ไม่สามารถอัปโหลดได้ เนื่องจากไฟล์ต่อไปนี้มีอยู่ในระบบแล้ว:\n- ${duplicates.map(d => d.name).join('\n- ')}`)
      return
    }

    setUploading(true)
    setUploadProgress(0)

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i]
      try {
        setUploadProgress(Math.round((i / pdfFiles.length) * 80))

        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/pdf/upload', { method: 'POST', body: form })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Upload failed')
        }
        const saved = await res.json() as { id: string; name: string; size: number; uploadedAt: number }

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

  const handleIngest = async (
    pdf: UploadedPdf,
    options?: { province?: string; district?: string; folder_name?: string }
  ) => {
    setLogs([])
    setIngestResult(null)
    setActiveTab('logs')

    try {
      const resp = await fetch('/api/pdf/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: pdf.id,
          original_name: pdf.name,
          province: options?.province && options.province !== 'auto' ? options.province : null,
          district: options?.district && options.district !== 'auto' ? options.district : null,
          folder_name: options?.folder_name || null,
        }),
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

  const openIngestConfig = (pdf: UploadedPdf) => {
    setIngestConfigPdf(pdf)
    setIngestProvince('auto')
    setIngestDistrict('auto')
    const baseName = pdf.name.replace(/\.[^/.]+$/, "")
    setIngestFolderName(baseName)
    setUseAiFolderName(true)
  }

  const filteredPdfs = filterProvince
    ? pdfs.filter(p => p.province === filterProvince)
    : pdfs

  const pdfUrl = selectedPdf ? `/api/pdf/view/${selectedPdf.id}` : null

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
                        onClick={(e) => { e.stopPropagation(); openIngestConfig(pdf) }}
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
                        <p className="text-[10px] opacity-70 mt-0.5">
                          ความแม่นยำ:{' '}
                          <span className={`font-semibold ${
                            ingestResult.location_confidence === 'high' ? 'text-emerald-600' :
                            ingestResult.location_confidence === 'manual' ? 'text-blue-600 font-bold' :
                            ingestResult.location_confidence === 'medium' ? 'text-amber-600' :
                            'text-red-500'
                          }`}>
                            {ingestResult.location_confidence === 'high' ? 'สูง 🎯' :
                             ingestResult.location_confidence === 'manual' ? 'สูง (ระบุเอง) 👤' :
                             ingestResult.location_confidence === 'medium' ? 'กลาง ✓' : 'ต่ำ ⚠️'}
                          </span>
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
                    <p className="text-xs text-gray-500 mt-0.5">
                      musya knowlads · 5 จังหวัด (มีจริง {(() => {
                        const stats = countActualDocsAndMd([...vaultData.zone10, ...vaultData.root_files])
                        return `${stats.docs} เอกสาร, ${stats.md} ไฟล์ MD`
                      })()})
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowNewFileDialog(true)}
                      className="px-3 py-1.5 rounded-lg bg-[#f26522] text-white text-xs font-medium hover:bg-[#e05510] transition-all shadow-sm"
                    >
                      + ไฟล์ใหม่
                    </button>
                    <button
                      onClick={loadVaultData}
                      disabled={vaultBusy}
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#fff0e5] hover:bg-[#fff0e5] text-xs text-gray-600 hover:text-[#f26522] transition-all shadow-sm disabled:opacity-50"
                    >
                      ↻ รีเฟรช
                    </button>
                  </div>
                </div>

                {/* Province Cards */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                {Object.entries(PROVINCE_COLORS).map(([prov, grad]) => {
                    const provNode = vaultData.zone10.find(n => n.name === prov)
                    const children = provNode?.children ?? []
                    const stats = countActualDocsAndMd(children)
                    return (
                      <div key={prov} className="rounded-xl bg-white border border-[#fff0e5] p-2.5 text-center hover:bg-[#fff0e5] transition-all cursor-default shadow-sm">
                        <div className={`w-8 h-8 mx-auto rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center text-sm mb-1.5 shadow-sm opacity-90`}>
                          🏛️
                        </div>
                        <p className="text-[10px] font-bold text-gray-800 leading-tight">{prov}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">{stats.docs} เอกสาร</p>
                        <p className="text-[9px] text-gray-400">{stats.md} ไฟล์ MD</p>
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
                      <VaultTreeNode key={i} node={node} depth={0} actions={vaultActions} />
                    ))
                  )}

                  {vaultData.root_files.length > 0 && (
                    <>
                      <div className="border-t border-[#fff0e5] my-2" />
                      <p className="text-[10px] text-gray-400 px-2 mb-1">ไฟล์ที่ root (ไม่ระบุจังหวัด)</p>
                      {vaultData.root_files.map((f, i) => (
                        <VaultTreeNode key={i} node={f} depth={0} actions={vaultActions} />
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Markdown Editor Modal ─────────────────────────────────────────────── */}
      {editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-bold text-gray-800">
                  {modalMode === 'view' ? '📖 ดูไฟล์' : '✏️ แก้ไขไฟล์'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{editingNode.path}</p>
              </div>
              <div className="flex gap-2">
                {modalMode === 'view' ? (
                  <>
                    <button
                      onClick={() => setModalMode('edit')}
                      className="px-3 py-1.5 rounded-lg border border-[#ffd8bf] bg-[#fff2e8] text-[#f26522] hover:bg-[#ffebd9] text-xs font-semibold transition-all shadow-sm cursor-pointer"
                    >
                      ✏️ แก้ไข
                    </button>
                    <button
                      onClick={() => setEditingNode(null)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      ปิด
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setModalMode('view')}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      📖 โหมดอ่าน
                    </button>
                    <button
                      onClick={() => setEditingNode(null)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleVaultSave}
                      disabled={editorSaving}
                      className="px-4 py-1.5 rounded-lg bg-[#f26522] text-white text-xs font-semibold hover:bg-[#e05510] disabled:opacity-60 transition-all shadow-sm cursor-pointer"
                    >
                      {editorSaving ? 'กำลังบันทึก...' : '💾 บันทึก'}
                    </button>
                  </>
                )}
              </div>
            </div>
            {modalMode === 'view' ? (
              <div
                className="flex-1 w-full p-6 overflow-y-auto bg-gray-50 rounded-b-2xl font-sans text-sm text-gray-800 leading-relaxed"
                style={{ minHeight: '60vh' }}
              >
                <div
                  className="prose prose-orange max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(editorContent) }}
                />
              </div>
            ) : (
              <textarea
                value={editorContent}
                onChange={e => setEditorContent(e.target.value)}
                className="flex-1 w-full p-4 font-mono text-xs text-gray-800 resize-none outline-none bg-gray-50 rounded-b-2xl"
                style={{ minHeight: '60vh' }}
                spellCheck={false}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Rename Modal ──────────────────────────────────────────────────────── */}
      {renameNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <p className="text-sm font-bold text-gray-800 mb-1">🏷️ เปลี่ยนชื่อ</p>
            <p className="text-xs text-gray-500 mb-4 font-mono truncate">{renameNode.path}</p>
            <input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVaultRename()} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all mb-4" placeholder="ชื่อใหม่" autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenameNode(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all">ยกเลิก</button>
              <button onClick={handleVaultRename} disabled={vaultBusy} className="px-4 py-2 rounded-xl bg-[#f26522] text-white text-xs font-medium hover:bg-[#e05510] disabled:opacity-60 transition-all">เปลี่ยนชื่อ</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New File Modal ────────────────────────────────────────────────────── */}
      {showNewFileDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <p className="text-sm font-bold text-gray-800 mb-1">📝 สร้างไฟล์ใหม่</p>
            <p className="text-xs text-gray-500 mb-4">ระบุ path เช่น <span className="font-mono bg-gray-100 px-1 rounded">เขต10/อุบลราชธานี/ชื่อไฟล์</span></p>
            <input value={newFilePath} onChange={e => setNewFilePath(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVaultNewFile()} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all mb-4" placeholder="เขต10/จังหวัด/ชื่อไฟล์" autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowNewFileDialog(false); setNewFilePath('') }} className="px-4 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all">ยกเลิก</button>
              <button onClick={handleVaultNewFile} disabled={vaultBusy || !newFilePath.trim()} className="px-4 py-2 rounded-xl bg-[#f26522] text-white text-xs font-medium hover:bg-[#e05510] disabled:opacity-60 transition-all">สร้าง</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ingest Configuration Modal ────────────────────────────────────────── */}
      {ingestConfigPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-500 to-[#f26522] px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <h3 className="font-bold text-sm">ตั้งค่าการนำเข้า Obsidian (Ingest)</h3>
                  <p className="text-[10px] text-orange-100 truncate mt-0.5 max-w-[280px]">{ingestConfigPdf.name}</p>
                </div>
              </div>
              <button onClick={() => setIngestConfigPdf(null)} className="text-white hover:text-orange-200 text-lg font-bold">×</button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Folder Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">ชื่อโฟลเดอร์สำหรับเก็บไฟล์ใน Vault</label>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    id="useAiFolderName"
                    checked={useAiFolderName}
                    onChange={(e) => setUseAiFolderName(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-[#f26522] focus:ring-[#f26522]"
                  />
                  <label htmlFor="useAiFolderName" className="text-[11px] text-gray-500 cursor-pointer">ให้ AI วิเคราะห์ตั้งชื่อหัวข้อเอกสารอัตโนมัติ (แนะนำ)</label>
                </div>
                {!useAiFolderName && (
                  <input
                    type="text"
                    value={ingestFolderName}
                    onChange={(e) => setIngestFolderName(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all font-mono"
                    placeholder="เช่น รายงานการวิจัย-2569"
                  />
                )}
              </div>

              {/* Province Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">จังหวัด</label>
                <select
                  value={ingestProvince}
                  onChange={(e) => {
                    setIngestProvince(e.target.value)
                    setIngestDistrict('auto')
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 bg-white outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all cursor-pointer"
                >
                  <option value="auto">🤖 วิเคราะห์ตำแหน่งอัตโนมัติด้วย AI (Auto)</option>
                  <option value="ส่วนกลาง">🏢 ส่วนกลาง (ไม่ระบุจังหวัด)</option>
                  {Object.keys(ZONE10_DISTRICTS).map(p => (
                    <option key={p} value={p}>📍 {p}</option>
                  ))}
                </select>
              </div>

              {/* District Select */}
              {ingestProvince !== 'auto' && ingestProvince !== 'ส่วนกลาง' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">อำเภอ</label>
                  <select
                    value={ingestDistrict}
                    onChange={(e) => setIngestDistrict(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 bg-white outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all cursor-pointer"
                  >
                    <option value="auto">🤖 วิเคราะห์อำเภออัตโนมัติด้วย AI (Auto)</option>
                    <option value="none">❌ ไม่ระบุอำเภอ (จัดเก็บระดับจังหวัด)</option>
                    {(ZONE10_DISTRICTS[ingestProvince] || []).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setIngestConfigPdf(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  handleIngest(ingestConfigPdf, {
                    province: ingestProvince,
                    district: ingestDistrict,
                    folder_name: useAiFolderName ? undefined : ingestFolderName,
                  })
                  setIngestConfigPdf(null)
                }}
                className="px-5 py-2 rounded-xl bg-[#f26522] hover:bg-[#e05510] text-white text-xs font-semibold shadow-md shadow-[#f26522]/10 transition-all cursor-pointer"
              >
                🚀 นำเข้าข้อมูล (Ingest)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
