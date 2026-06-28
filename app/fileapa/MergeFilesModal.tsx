'use client'

import React, { ChangeEvent, useRef, useState } from 'react'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type FlowStep = 'upload' | 'searching' | 'found' | 'not_found' | 'analyze' | 'pipeline' | 'preview'

type UploadedFile = { name: string; size: number }

type FoundMatch = {
  id: string
  name: string
  path: string
  domain: string
  years: string
  size: string
  confidence: number
}

type SuggestedDomain = {
  id: string
  label: string
  path: string
  reason: string
  folderName: string
  subfolder: string
}

type ColumnRow = {
  existing: string
  incoming: string
  status: 'matched' | 'similar' | 'new' | 'missing'
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const PIPELINE_STEPS = [
  { id: 0, icon: '🔗', label: 'Match Columns', desc: 'จับคู่คอลัมน์' },
  { id: 1, icon: '🔄', label: 'Merge Data', desc: 'รวมข้อมูล' },
  { id: 2, icon: '✅', label: 'Validate', desc: 'ตรวจสอบ' },
]

const DOMAIN_OPTIONS = [
  { id: 'D2', label: 'D2_Mental Health', path: 'D2_Mental_Health/' },
  { id: 'D3', label: 'D3_NCDs',          path: 'D3_NCDs/' },
  { id: 'D4', label: 'D4_Nutrition',     path: 'D4_Nutrition/' },
]

// ──────────────────────────────────────────────
// AI domain suggestion (client-side keyword matching)
// ──────────────────────────────────────────────
function suggestDomain(fileName: string): SuggestedDomain {
  const lower = fileName.toLowerCase()

  // D2: Mental Health
  if (lower.includes('ซึมเศร้า') || lower.includes('depression'))
    return { id: 'D2', label: 'D2_Mental Health', path: 'D2_Mental_Health/', folderName: 'D2_Mental_Health', subfolder: 'โรคซึมเศร้า', reason: 'พบคำเกี่ยวกับโรคซึมเศร้า' }
  if (lower.includes('ฆ่าตัวตาย') || lower.includes('suicide'))
    return { id: 'D2', label: 'D2_Mental Health', path: 'D2_Mental_Health/', folderName: 'D2_Mental_Health', subfolder: 'การฆ่าตัวตาย', reason: 'พบคำเกี่ยวกับการฆ่าตัวตาย' }
  if (lower.includes('จิตเวช') || lower.includes('psychosis') || lower.includes('psychiatric'))
    return { id: 'D2', label: 'D2_Mental Health', path: 'D2_Mental_Health/', folderName: 'D2_Mental_Health', subfolder: 'โรคจิตเวช', reason: 'พบคำเกี่ยวกับโรคจิตเวช' }
  if (lower.includes('เครียด') || lower.includes('stress'))
    return { id: 'D2', label: 'D2_Mental Health', path: 'D2_Mental_Health/', folderName: 'D2_Mental_Health', subfolder: 'ความเครียด', reason: 'พบคำเกี่ยวกับความเครียด' }
  if (lower.includes('จิต') || lower.includes('mental'))
    return { id: 'D2', label: 'D2_Mental Health', path: 'D2_Mental_Health/', folderName: 'D2_Mental_Health', subfolder: 'สุขภาพจิต', reason: 'พบคำเกี่ยวกับสุขภาพจิต' }

  // D3: NCDs
  if (lower.includes('เบาหวาน') || lower.includes('diabetes') || lower.includes('dm'))
    return { id: 'D3', label: 'D3_NCDs', path: 'D3_NCDs/', folderName: 'D3_NCDs', subfolder: 'โรคเบาหวาน', reason: 'พบคำเกี่ยวกับโรคเบาหวาน' }
  if (lower.includes('ไต') || lower.includes('kidney') || lower.includes('ckd') || lower.includes('renal'))
    return { id: 'D3', label: 'D3_NCDs', path: 'D3_NCDs/', folderName: 'D3_NCDs', subfolder: 'โรคไต', reason: 'พบคำเกี่ยวกับโรคไต' }
  if (lower.includes('ความดัน') || lower.includes('hypertension') || lower.includes('htn'))
    return { id: 'D3', label: 'D3_NCDs', path: 'D3_NCDs/', folderName: 'D3_NCDs', subfolder: 'โรคความดันโลหิตสูง', reason: 'พบคำเกี่ยวกับโรคความดันโลหิตสูง' }
  if (lower.includes('มะเร็ง') || lower.includes('cancer'))
    return { id: 'D3', label: 'D3_NCDs', path: 'D3_NCDs/', folderName: 'D3_NCDs', subfolder: 'โรคมะเร็ง', reason: 'พบคำเกี่ยวกับโรคมะเร็ง' }
  if (lower.includes('หัวใจ') || lower.includes('หลอดเลือด') || lower.includes('heart') || lower.includes('cvd'))
    return { id: 'D3', label: 'D3_NCDs', path: 'D3_NCDs/', folderName: 'D3_NCDs', subfolder: 'โรคหัวใจและหลอดเลือด', reason: 'พบคำเกี่ยวกับโรคหัวใจ/หลอดเลือด' }
  if (lower.includes('ปอด') || lower.includes('lung') || lower.includes('copd') || lower.includes('ถุงลม'))
    return { id: 'D3', label: 'D3_NCDs', path: 'D3_NCDs/', folderName: 'D3_NCDs', subfolder: 'โรคปอด', reason: 'พบคำเกี่ยวกับโรคปอด' }
  if (lower.includes('ไขมัน') || lower.includes('cholesterol') || lower.includes('lipid'))
    return { id: 'D3', label: 'D3_NCDs', path: 'D3_NCDs/', folderName: 'D3_NCDs', subfolder: 'ไขมันในเลือด', reason: 'พบคำเกี่ยวกับไขมันในเลือด' }
  if (lower.includes('แทรกซ้อน') || lower.includes('complication'))
    return { id: 'D3', label: 'D3_NCDs', path: 'D3_NCDs/', folderName: 'D3_NCDs', subfolder: 'ภาวะแทรกซ้อน', reason: 'พบคำเกี่ยวกับภาวะแทรกซ้อน' }
  if (lower.includes('ncd') || lower.includes('โรคเรื้อรัง') || lower.includes('ไม่ติดต่อ'))
    return { id: 'D3', label: 'D3_NCDs', path: 'D3_NCDs/', folderName: 'D3_NCDs', subfolder: 'โรคไม่ติดต่อ', reason: 'พบคำเกี่ยวกับโรคไม่ติดต่อ' }

  // D4: Nutrition
  if (lower.includes('โภชนาการ') || lower.includes('น้ำหนัก') || lower.includes('bmi') || lower.includes('nutrition') || lower.includes('อาหาร') || lower.includes('ส่วนสูง')) {
    if (lower.includes('0-2') || lower.includes('0 - 2') || lower.includes('แรกเกิด'))
      return { id: 'D4', label: 'D4_Nutrition', path: 'D4_Nutrition/', folderName: 'D4_Nutrition', subfolder: 'โภชนาการเด็ก 0-2 ปี', reason: 'พบคำเกี่ยวกับโภชนาการเด็ก 0-2 ปี' }
    if (lower.includes('0-5') || lower.includes('เด็กเล็ก') || lower.includes('ปฐมวัย'))
      return { id: 'D4', label: 'D4_Nutrition', path: 'D4_Nutrition/', folderName: 'D4_Nutrition', subfolder: 'โภชนาการเด็กปฐมวัย', reason: 'พบคำเกี่ยวกับโภชนาการเด็กเล็ก' }
    if (lower.includes('หญิงตั้งครรภ์') || lower.includes('มารดา') || lower.includes('แม่'))
      return { id: 'D4', label: 'D4_Nutrition', path: 'D4_Nutrition/', folderName: 'D4_Nutrition', subfolder: 'โภชนาการหญิงตั้งครรภ์', reason: 'พบคำเกี่ยวกับโภชนาการหญิงตั้งครรภ์' }
    if (lower.includes('ไอโอดีน') || lower.includes('iodine'))
      return { id: 'D4', label: 'D4_Nutrition', path: 'D4_Nutrition/', folderName: 'D4_Nutrition', subfolder: 'การได้รับไอโอดีน', reason: 'พบคำเกี่ยวกับไอโอดีน' }
    return { id: 'D4', label: 'D4_Nutrition', path: 'D4_Nutrition/', folderName: 'D4_Nutrition', subfolder: 'ภาวะโภชนาการ', reason: 'พบคำเกี่ยวกับโภชนาการ/น้ำหนัก' }
  }

  return { id: 'D3', label: 'D3_NCDs', path: 'D3_NCDs/', folderName: 'D3_NCDs', subfolder: 'โรคไม่ติดต่อ', reason: 'ไม่พบหมวดชัดเจน — ใช้ D3_NCDs เป็นค่าเริ่มต้น' }
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────
function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-100 text-green-700' : value >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {value >= 80 ? '✦' : '◎'} {value}% match
    </span>
  )
}

function StepBar({ current, isNewFile }: { current: FlowStep; isNewFile: boolean }) {
  const mergeSteps: FlowStep[] = ['upload', 'found', 'analyze', 'pipeline', 'preview']
  const newSteps: FlowStep[]   = ['upload', 'not_found', 'preview']
  const mergeLabels = ['1. Upload', '2. AI ค้นหา', '3. Analyze', '4. Merge', '5. Preview']
  const newLabels   = ['1. Upload', '2. AI ค้นหา', '3. Preview']

  const steps  = isNewFile ? newSteps  : mergeSteps
  const labels = isNewFile ? newLabels : mergeLabels

  const activeIdx = (() => {
    if (current === 'searching') return 1
    if (current === 'not_found') return 1
    return steps.indexOf(current)
  })()

  return (
    <div className="flex flex-wrap items-center gap-0">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
            i === activeIdx ? 'bg-[#eb6f45f1] text-white' : i < activeIdx ? 'text-[#eb6f45f1]' : 'text-gray-400'
          }`}>
            {i < activeIdx && <span>✓</span>}
            {labels[i]}
          </div>
          {i < steps.length - 1 && <div className={`h-px w-4 ${i < activeIdx ? 'bg-[#eb6f45f1]' : 'bg-gray-200'}`} />}
        </React.Fragment>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
type Props = { onClose: () => void; onSuccess?: () => void }

export default function MergeFilesModal({ onClose, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Flow
  const [flowStep, setFlowStep]         = useState<FlowStep>('upload')
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [foundMatch, setFoundMatch]     = useState<FoundMatch | null>(null)
  const [isNewFile, setIsNewFile]       = useState(false)
  const [suggested, setSuggested]       = useState<SuggestedDomain | null>(null)
  const [selectedDomainId, setSelectedDomainId] = useState<string>('')
  const [isDragging, setIsDragging]     = useState(false)

  // API state
  const [tempFileId, setTempFileId]     = useState<string | null>(null)
  const [columns, setColumns]           = useState<ColumnRow[]>([])
  const [existingRowCount, setExistingRowCount] = useState(0)
  const [newRowCount, setNewRowCount]   = useState(0)

  // Merge execution state
  const [mergedTempKey, setMergedTempKey]       = useState<string | null>(null)
  const [previewHeaders, setPreviewHeaders]     = useState<string[]>([])
  const [previewExistingRows, setPreviewExistingRows] = useState<string[][]>([])
  const [previewNewRows, setPreviewNewRows]     = useState<string[][]>([])
  const [totalRowCount, setTotalRowCount]       = useState(0)

  const [pipelineActive, setPipelineActive]   = useState(false)
  const [pipelineStep, setPipelineStep]       = useState(-1)
  const [pipelineDone, setPipelineDone]       = useState(false)
  const [yearColumnAdded, setYearColumnAdded] = useState(false)
  const [yearFilledFromFilename, setYearFilledFromFilename] = useState(false)
  const [replacedRowCount, setReplacedRowCount] = useState(0)
  const [existingYearLabel, setExistingYearLabel] = useState('')
  const [newYearLabel, setNewYearLabel]       = useState('')
  const [suggestedOutputName, setSuggestedOutputName] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [isSaved,  setIsSaved]  = useState(false)
  const [savedPath, setSavedPath] = useState('')

  const [apiError, setApiError] = useState<string | null>(null)
  const [aiReason, setAiReason] = useState<string>('')

  // ── File upload + search + analyze (all in one go) ──
  const handleFileSelect = async (file: File) => {
    setApiError(null)
    setUploadedFile({ name: file.name, size: file.size })
    setFlowStep('searching')

    try {
      // 1. Upload to temp
      const formData = new FormData()
      formData.append('file', file)
      formData.append('path', file.name)

      const uploadRes = await fetch('/api/files/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const uploadData = await uploadRes.json() as { id: string }
      const tid = uploadData.id
      setTempFileId(tid)

      // 2. Search MinIO for a matching file
      const searchRes = await fetch('/api/files/merge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
      })
      if (!searchRes.ok) throw new Error('Search failed')
      const searchData = await searchRes.json() as {
        found: boolean
        reason?: string
        match?: { id: string; name: string; path: string; domain: string; years: string; size: string; confidence: number }
      }

      if (searchData.found && searchData.match) {
        const match = searchData.match
        setAiReason(searchData.reason ?? '')
        setFoundMatch(match)
        setIsNewFile(false)

        // 3a. Pre-analyze columns while user sees "found" screen
        try {
          const analyzeRes = await fetch('/api/files/merge/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ existingFileId: match.id, tempFileId: tid }),
          })
          if (analyzeRes.ok) {
            const analyzeData = await analyzeRes.json() as { columns: ColumnRow[]; existingRowCount: number; newRowCount: number }
            setColumns(analyzeData.columns)
            setExistingRowCount(analyzeData.existingRowCount)
            setNewRowCount(analyzeData.newRowCount)
          }
        } catch { /* non-fatal — analyze step can retry */ }

        setFlowStep('found')
      } else {
        // 3b. Not found — suggest a domain
        setAiReason(searchData.reason ?? 'ไม่พบไฟล์ที่มีหัวข้อเดียวกันในระบบ')
        const s = suggestDomain(file.name)
        setSuggested(s)
        setSelectedDomainId(s.id)
        setIsNewFile(true)
        setFlowStep('not_found')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setApiError(msg)
      setFlowStep('upload')
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFileSelect(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFileSelect(file)
  }

  // ── Re-analyze if columns not loaded yet ──
  const handleGoToAnalyze = async () => {
    if (columns.length > 0) { setFlowStep('analyze'); return }
    if (!foundMatch || !tempFileId) return
    setApiError(null)
    try {
      const res = await fetch('/api/files/merge/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingFileId: foundMatch.id, tempFileId }),
      })
      if (!res.ok) throw new Error('Analyze failed')
      const data = await res.json() as { columns: ColumnRow[]; existingRowCount: number; newRowCount: number }
      setColumns(data.columns)
      setExistingRowCount(data.existingRowCount)
      setNewRowCount(data.newRowCount)
      setFlowStep('analyze')
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Analyze failed')
    }
  }

  // ── Execute merge ──
  const handleStartPipeline = async () => {
    if (!foundMatch || !tempFileId) return
    setApiError(null)
    setPipelineActive(true)
    setPipelineStep(0)
    setPipelineDone(false)

    // Simulate step progression while API runs
    const stepInterval = setInterval(() => {
      setPipelineStep(prev => Math.min(prev + 1, PIPELINE_STEPS.length - 1))
    }, 900)

    try {
      const res = await fetch('/api/files/merge/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingFileId: foundMatch.id, tempFileId, newFileName: uploadedFile?.name }),
      })
      clearInterval(stepInterval)
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || 'Execute failed') }
      const data = await res.json() as {
        mergedTempKey: string
        headers: string[]
        previewExisting: string[][]
        previewNew: string[][]
        existingRowCount: number
        replacedRowCount: number
        newRowCount: number
        totalRowCount: number
        yearColumnAdded: boolean
        yearFilledFromFilename: boolean
        existingYearLabel: string
        newYearLabel: string
        suggestedOutputName: string
      }
      setMergedTempKey(data.mergedTempKey)
      setPreviewHeaders(data.headers)
      setPreviewExistingRows(data.previewExisting)
      setPreviewNewRows(data.previewNew)
      setExistingRowCount(data.existingRowCount)
      setReplacedRowCount(data.replacedRowCount ?? 0)
      setNewRowCount(data.newRowCount)
      setTotalRowCount(data.totalRowCount)
      setYearColumnAdded(data.yearColumnAdded)
      setYearFilledFromFilename(data.yearFilledFromFilename ?? false)
      setExistingYearLabel(data.existingYearLabel)
      setNewYearLabel(data.newYearLabel)
      setSuggestedOutputName(data.suggestedOutputName)
      setPipelineStep(PIPELINE_STEPS.length - 1)
      setPipelineDone(true)
    } catch (err) {
      clearInterval(stepInterval)
      setApiError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setPipelineActive(false)
    }
  }

  // ── Confirm save ──
  const handleConfirmSave = async () => {
    setIsSaving(true)
    setApiError(null)
    try {
      let body: Record<string, unknown>
      if (isNewFile) {
        const domainOption = DOMAIN_OPTIONS.find(d => d.id === selectedDomainId)
        body = {
          mode: 'new',
          tempFileId,
          fileName: uploadedFile?.name ?? '',
          domain: domainOption?.path ?? '',
          subfolder: suggested?.subfolder ?? '',
        }
      } else {
        body = {
          mode: 'merge',
          existingFileId: foundMatch?.id,
          mergedTempKey,
          fileName: foundMatch?.name ?? uploadedFile?.name ?? '',
          suggestedOutputName: suggestedOutputName || undefined,
        }
      }

      const res = await fetch('/api/files/merge/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || 'Save failed') }
      const data = await res.json() as { savedPath: string }
      setSavedPath(data.savedPath)
      setIsSaved(true)
      onSuccess?.()
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setFlowStep('upload')
    setUploadedFile(null)
    setFoundMatch(null)
    setIsNewFile(false)
    setSuggested(null)
    setSelectedDomainId('')
    setTempFileId(null)
    setColumns([])
    setExistingRowCount(0)
    setNewRowCount(0)
    setMergedTempKey(null)
    setPreviewHeaders([])
    setPreviewExistingRows([])
    setPreviewNewRows([])
    setTotalRowCount(0)
    setPipelineActive(false)
    setPipelineStep(-1)
    setPipelineDone(false)
    setYearColumnAdded(false)
    setYearFilledFromFilename(false)
    setReplacedRowCount(0)
    setExistingYearLabel('')
    setNewYearLabel('')
    setSuggestedOutputName('')
    setIsSaving(false)
    setIsSaved(false)
    setSavedPath('')
    setApiError(null)
    setAiReason('')
  }

  // ── Derived values ──
  const selectedDomainOption = DOMAIN_OPTIONS.find(d => d.id === selectedDomainId)
  const newFileSavePath = selectedDomainOption && uploadedFile
    ? `${selectedDomainOption.path}${suggested?.subfolder ?? ''}/${uploadedFile.name}`
    : ''

  const displayHeaders = previewHeaders.length > 0 ? previewHeaders.slice(0, 7) : []

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-800">Merge Files</h2>
              <span className="rounded-full bg-[#fff0ea] px-2 py-0.5 text-[10px] font-semibold text-[#eb6f45f1]">AI-assisted</span>
            </div>
            <StepBar current={flowStep} isNewFile={isNewFile} />
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Error banner */}
          {apiError && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <span className="text-red-500">⚠️</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-700">เกิดข้อผิดพลาด</p>
                <p className="text-xs text-red-600">{apiError}</p>
              </div>
              <button onClick={() => setApiError(null)} className="ml-auto text-xs text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {/* ── UPLOAD ── */}
          {flowStep === 'upload' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">อัพโหลดไฟล์ข้อมูลปีใหม่</p>
                <p className="mt-0.5 text-xs text-gray-400">AI จะค้นหาไฟล์เดิมใน workspace ให้อัตโนมัติ ถ้าไม่พบจะสร้างโฟลเดอร์ใหม่ให้</p>
              </div>
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-14 transition ${
                  isDragging ? 'border-[#eb6f45f1] bg-[#fff3ee]' : 'border-orange-200 bg-gradient-to-br from-white to-[#fff8f5] hover:border-[#ffa57d] hover:shadow-md'
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0ea]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[#eb6f45f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-700">วางไฟล์ที่นี่ หรือ คลิกเพื่อเลือก</p>
                <p className="mt-1 text-xs text-gray-400">รองรับ .csv, .xlsx</p>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleInputChange} />
              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
                  <span>🔗</span>
                  <span><strong className="text-blue-700">พบไฟล์เดิม</strong> — Merge ข้อมูลปีใหม่เข้าไฟล์เดิม แล้ว Preview ก่อนบันทึก</span>
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2.5">
                  <span>✨</span>
                  <span><strong className="text-purple-700">ไม่พบไฟล์เดิม</strong> — AI แนะนำ domain แล้วสร้างโฟลเดอร์ใหม่ให้อัตโนมัติ</span>
                </div>
              </div>
            </div>
          )}

          {/* ── SEARCHING ── */}
          {flowStep === 'searching' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#fff0ea]">
                <span className="text-3xl">🔍</span>
                <svg className="absolute inset-0 h-full w-full animate-spin" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="#eb6f45" strokeWidth="3" strokeDasharray="56 170" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">AI กำลังวิเคราะห์ไฟล์ทั้งหมดใน MinIO…</p>
                <p className="mt-1 text-xs text-gray-400">อัพโหลดไฟล์ · ดึงรายการ MinIO · ให้ AI ตัดสิน</p>
              </div>
              <div className="w-full max-w-xs rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-center">
                <p className="text-[10px] text-gray-400">ไฟล์ที่อัพโหลด</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-gray-700">{uploadedFile?.name}</p>
              </div>
            </div>
          )}

          {/* ── FOUND ── */}
          {flowStep === 'found' && foundMatch && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                <span className="text-2xl">✅</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-green-800">AI พบไฟล์เดิมใน MinIO แล้ว</p>
                  {aiReason && <p className="mt-0.5 text-xs text-green-600">💡 {aiReason}</p>}
                  {!aiReason && <p className="mt-0.5 text-xs text-green-600">ตรวจสอบข้อมูลด้านล่าง แล้วกด "ยืนยัน" เพื่อดำเนินการต่อ</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-orange-100 bg-[#fff8f5] p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#eb6f45f1]">ไฟล์ใหม่ที่อัพโหลด</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📄</span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-800">{uploadedFile?.name}</p>
                      <p className="text-[10px] text-gray-400">{uploadedFile ? `${(uploadedFile.size / 1024).toFixed(0)} KB` : ''}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-green-700">ไฟล์เดิมใน MinIO</p>
                    <ConfidenceBadge value={foundMatch.confidence} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📂</span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-800">{foundMatch.name}</p>
                      <p className="text-[10px] text-gray-400">{foundMatch.path}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded-full bg-green-200/70 px-2 py-0.5 text-[9px] font-medium text-green-800">{foundMatch.domain}</span>
                    {foundMatch.years && <span className="rounded-full bg-green-200/70 px-2 py-0.5 text-[9px] font-medium text-green-800">ปี {foundMatch.years}</span>}
                    <span className="rounded-full bg-green-200/70 px-2 py-0.5 text-[9px] font-medium text-green-800">{foundMatch.size}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                <span>⚠️</span>
                <span>ผลลัพธ์จะ <strong className="text-gray-700">แทนที่ไฟล์เดิม</strong> ใน MinIO — ดู Preview ก่อนยืนยัน</span>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={handleReset} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100">เลือกไฟล์ใหม่</button>
                <button onClick={handleGoToAnalyze} className="rounded-lg bg-[#eb6f45f1] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#fc632c]">ยืนยัน → วิเคราะห์คอลัมน์</button>
              </div>
            </div>
          )}

          {/* ── NOT FOUND ── */}
          {flowStep === 'not_found' && suggested && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4">
                <span className="text-2xl">✨</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-purple-800">ไม่พบไฟล์เดิมที่ตรงกันใน MinIO</p>
                  {aiReason && <p className="mt-0.5 text-xs text-purple-600">💡 {aiReason}</p>}
                  {!aiReason && <p className="mt-0.5 text-xs text-purple-600">AI วิเคราะห์ชื่อไฟล์แล้วแนะนำ domain — เลือก domain แล้วกด Preview เพื่อบันทึก</p>}
                </div>
              </div>

              <div className="rounded-xl border border-orange-100 bg-[#fff8f5] p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#eb6f45f1]">ไฟล์ที่อัพโหลด</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl">📄</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">{uploadedFile?.name}</p>
                    <p className="text-[10px] text-gray-400">{uploadedFile ? `${(uploadedFile.size / 1024).toFixed(0)} KB` : ''}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-xs font-semibold text-gray-700">AI แนะนำ Domain</p>
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-semibold text-purple-700">เหตุผล: {suggested.reason}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {DOMAIN_OPTIONS.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDomainId(d.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        selectedDomainId === d.id
                          ? 'border-[#eb6f45f1] bg-[#fff3ee] ring-1 ring-[#eb6f45f1]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full border ${selectedDomainId === d.id ? 'border-[#eb6f45f1] bg-[#eb6f45f1]' : 'border-gray-300'}`} />
                        <span className="text-xs font-semibold text-gray-800">{d.label}</span>
                      </div>
                      {d.id === suggested.id && (
                        <span className="mt-1 inline-block rounded-full bg-[#fff0ea] px-1.5 py-0.5 text-[9px] font-semibold text-[#eb6f45f1]">AI แนะนำ</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save path preview */}
              {selectedDomainOption && uploadedFile && (
                <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/50 px-4 py-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-purple-700">จะสร้างโฟลเดอร์ใหม่และบันทึกไฟล์ที่</p>
                  <p className="font-mono text-xs text-purple-900 leading-relaxed">
                    <span className="text-purple-400">MinIO / </span>
                    <span className="font-bold text-purple-700">{selectedDomainOption.path}</span>
                    <span className="font-bold text-purple-900">{suggested.subfolder}/</span>
                    <span className="text-purple-600">{uploadedFile.name}</span>
                  </p>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    <span className="rounded-full bg-purple-200/70 px-2 py-0.5 text-[9px] font-semibold text-purple-800">📁 {selectedDomainOption.label}</span>
                    <span className="rounded-full bg-purple-200/70 px-2 py-0.5 text-[9px] font-semibold text-purple-800">📂 {suggested.subfolder}</span>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] text-purple-600">สร้างอัตโนมัติถ้ายังไม่มี</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={handleReset} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100">เลือกไฟล์ใหม่</button>
                <button
                  onClick={() => setFlowStep('preview')}
                  className="rounded-lg bg-[#eb6f45f1] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#fc632c]"
                >
                  ดู Preview → บันทึกไฟล์ใหม่
                </button>
              </div>
            </div>
          )}

          {/* ── ANALYZE ── */}
          {flowStep === 'analyze' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">วิเคราะห์โครงสร้างข้อมูล</p>
                <p className="mt-0.5 text-xs text-gray-400">เปรียบเทียบคอลัมน์ระหว่างไฟล์เดิมและไฟล์ใหม่ก่อน merge</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'ตรงกัน', count: columns.filter(c => c.status === 'matched').length, color: 'bg-green-50 border-green-200 text-green-700' },
                  { label: 'คล้ายกัน', count: columns.filter(c => c.status === 'similar').length, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
                  { label: 'คอลัมน์ใหม่', count: columns.filter(c => c.status === 'new').length, color: 'bg-blue-50 border-blue-200 text-blue-700' },
                  { label: 'หายไป', count: columns.filter(c => c.status === 'missing').length, color: 'bg-red-50 border-red-200 text-red-700' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border px-3 py-2.5 ${s.color}`}>
                    <p className="text-xl font-bold">{s.count}</p>
                    <p className="text-[10px] font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 text-center">
                <div className="rounded-lg bg-gray-50 border border-gray-100 py-2">
                  <span className="font-semibold text-gray-700">{existingRowCount.toLocaleString()}</span> แถวในไฟล์เดิม
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 py-2">
                  <span className="font-semibold text-gray-700">+{newRowCount.toLocaleString()}</span> แถวจากไฟล์ใหม่
                </div>
              </div>
              {columns.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="grid grid-cols-[1fr_32px_1fr_80px] bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    <span>ไฟล์เดิม (MinIO)</span><span /><span>ไฟล์ใหม่</span><span className="text-center">สถานะ</span>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
                    {columns.map((col, i) => {
                      const s = {
                        matched: { dot: 'bg-green-400', label: 'ตรงกัน',      cls: 'bg-green-100 text-green-700' },
                        similar: { dot: 'bg-yellow-400', label: 'คล้ายกัน',   cls: 'bg-yellow-100 text-yellow-700' },
                        new:     { dot: 'bg-blue-400',   label: 'คอลัมน์ใหม่', cls: 'bg-blue-100 text-blue-700' },
                        missing: { dot: 'bg-red-400',    label: 'หายไป',        cls: 'bg-red-100 text-red-700' },
                      }[col.status]
                      return (
                        <div key={i} className={`grid grid-cols-[1fr_32px_1fr_80px] items-center px-3 py-2 text-xs ${col.status === 'new' ? 'bg-blue-50/40' : ''}`}>
                          <span className={`font-medium ${!col.existing ? 'text-gray-300' : 'text-gray-700'}`}>{col.existing || '—'}</span>
                          <div className="flex justify-center"><span className={`h-2 w-2 rounded-full ${s.dot}`} /></div>
                          <span className="font-medium text-gray-700">{col.incoming || '—'}</span>
                          <div className="flex justify-center"><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.cls}`}>{s.label}</span></div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-yellow-100 bg-yellow-50 px-4 py-3 text-xs text-yellow-700">ยังไม่มีข้อมูลคอลัมน์ — จะวิเคราะห์อัตโนมัติเมื่อเริ่ม Merge</div>
              )}
              {columns.some(c => c.status === 'similar') && (
                <div className="flex items-start gap-2 rounded-xl border border-yellow-100 bg-yellow-50 px-4 py-3">
                  <span>⚠️</span>
                  <p className="text-[11px] text-yellow-800">คอลัมน์ที่ <strong>คล้ายกัน</strong> — AI จะ map ให้อัตโนมัติตามความหมาย · คอลัมน์ <strong>ใหม่</strong> จะถูก append เพิ่มในผลลัพธ์</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setFlowStep('found')} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100">ย้อนกลับ</button>
                <button onClick={() => setFlowStep('pipeline')} className="rounded-lg bg-[#eb6f45f1] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#fc632c]">เริ่ม Merge →</button>
              </div>
            </div>
          )}

          {/* ── PIPELINE ── */}
          {flowStep === 'pipeline' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-700">🔗 {foundMatch?.name}</p>
                  <p className="text-gray-400">+ {uploadedFile?.name}</p>
                </div>
                <svg className="h-4 w-4 flex-none text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                <p className="flex-none font-semibold text-[#eb6f45f1]">ผลลัพธ์ที่ merge</p>
              </div>
              <div className="flex flex-wrap items-start gap-1.5">
                {PIPELINE_STEPS.map((step, idx) => (
                  <React.Fragment key={step.id}>
                    <div className={`flex min-w-[120px] flex-col items-center rounded-xl border p-3 transition ${
                      pipelineActive && pipelineStep === step.id ? 'scale-105 border-[#eb6f45f1] bg-[#fff3ee] shadow-md'
                      : (pipelineActive && pipelineStep > step.id) || pipelineDone ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-white'
                    }`}>
                      <span className="text-2xl">{step.icon}</span>
                      <span className="mt-1 text-[10px] font-semibold text-gray-700">{step.label}</span>
                      <span className="mt-0.5 text-center text-[9px] leading-tight text-gray-400">{step.desc}</span>
                      {pipelineActive && pipelineStep === step.id && <span className="mt-1 animate-pulse text-[9px] font-medium text-[#eb6f45f1]">⏳ กำลังทำงาน…</span>}
                      {((pipelineActive && pipelineStep > step.id) || pipelineDone) && <span className="mt-1 text-[9px] font-medium text-green-600">✓ เสร็จ</span>}
                    </div>
                    {idx < PIPELINE_STEPS.length - 1 && (
                      <div className="flex items-center pt-7">
                        <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              {pipelineDone && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                    <span>✅</span>
                    <div>
                      <p>Merge สำเร็จ! ข้อมูลรวม {totalRowCount.toLocaleString()} แถว — ตรวจสอบใน Preview ก่อนบันทึก</p>
                      {replacedRowCount > 0 && newYearLabel && (
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-orange-700">
                          <span className="rounded-full bg-orange-100 px-2 py-0.5">🔄 แทนที่ {replacedRowCount.toLocaleString()} แถวปี {newYearLabel} ด้วยข้อมูลใหม่</span>
                        </p>
                      )}
                      {yearColumnAdded && (
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-blue-700">
                          <span className="rounded-full bg-blue-100 px-2 py-0.5">📅 เพิ่มคอลัมน์ "ปี_ข้อมูล" อัตโนมัติ</span>
                          {existingYearLabel && <span className="text-gray-500">ไฟล์เดิม → {existingYearLabel}</span>}
                          {newYearLabel && <span className="text-gray-500">ไฟล์ใหม่ → {newYearLabel}</span>}
                        </p>
                      )}
                      {yearFilledFromFilename && newYearLabel && (
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-blue-700">
                          <span className="rounded-full bg-blue-100 px-2 py-0.5">📅 เติมปี "{newYearLabel}" ให้แถวใหม่อัตโนมัติ (จากชื่อไฟล์)</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setFlowStep('preview')} className="w-full rounded-xl border-2 border-[#eb6f45f1] py-3 text-sm font-semibold text-[#eb6f45f1] transition hover:bg-[#fff3ee]">
                    👁 ดู Preview ก่อนบันทึกลง MinIO →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── PREVIEW ── */}
          {flowStep === 'preview' && (
            <div className="space-y-4">
              {!isSaved ? (
                <>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {isNewFile ? 'Preview ไฟล์ใหม่ก่อนบันทึกลง MinIO' : 'Preview ข้อมูลที่จะบันทึกลง MinIO'}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {isNewFile ? 'ตรวจสอบให้ครบ แล้วกด "ยืนยัน" เพื่อสร้างโฟลเดอร์และบันทึกไฟล์' : 'ตรวจสอบให้ครบ แล้วกด "ยืนยัน" เพื่อแทนที่ไฟล์เดิม'}
                    </p>
                  </div>

                  {/* Stats — merge only */}
                  {!isNewFile && (
                    <div className="space-y-2">
                      <div className={`grid gap-2 ${replacedRowCount > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                        {[
                          ...(replacedRowCount > 0 ? [{ label: `ลบออก (ปี ${newYearLabel})`, value: `-${replacedRowCount.toLocaleString()}`, color: 'text-orange-600' }] : []),
                          { label: `แถวเดิม${existingYearLabel ? ` (${existingYearLabel})` : ''}`, value: existingRowCount.toLocaleString(), color: 'text-gray-700' },
                          { label: `แถวใหม่${newYearLabel ? ` (${newYearLabel})` : ''}`, value: `+${newRowCount.toLocaleString()}`, color: 'text-green-600' },
                          { label: 'รวมทั้งหมด', value: totalRowCount.toLocaleString(), color: 'text-[#eb6f45f1]' },
                        ].map(s => (
                          <div key={s.label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-center">
                            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-[10px] text-gray-400">{s.label}</p>
                          </div>
                        ))}
                      </div>
                      {replacedRowCount > 0 && newYearLabel && (
                        <div className="flex items-center gap-2 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-[11px] text-orange-700">
                          <span>🔄</span>
                          <span>ลบ <strong>{replacedRowCount.toLocaleString()} แถว</strong> ของปี <strong>{newYearLabel}</strong> ออกจากไฟล์เดิม แล้วแทนด้วยข้อมูลใหม่</span>
                        </div>
                      )}
                      {yearColumnAdded && (
                        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                          <span>📅</span>
                          <span>เพิ่มคอลัมน์ <strong>ปี_ข้อมูล</strong> อัตโนมัติ เพราะไม่พบคอลัมน์ปีในไฟล์ทั้งสอง</span>
                        </div>
                      )}
                      {yearFilledFromFilename && newYearLabel && (
                        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                          <span>📅</span>
                          <span>เติมปี <strong>{newYearLabel}</strong> ให้แถวใหม่ทุกแถวอัตโนมัติ — ดึงจากชื่อไฟล์ที่อัพโหลด</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Data preview table */}
                  {displayHeaders.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-[10px] font-semibold text-gray-500">
                        {isNewFile ? 'ตัวอย่างข้อมูลจากไฟล์ที่อัพโหลด' : 'ตัวอย่างข้อมูล — แถวสีเขียว = ข้อมูลใหม่ที่จะถูก append'}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              {displayHeaders.map(h => (
                                <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {!isNewFile && previewExistingRows.map((row, i) => (
                              <tr key={`ex-${i}`} className="text-gray-600">
                                {displayHeaders.map((_, ci) => (
                                  <td key={ci} className="whitespace-nowrap px-3 py-1.5">{row[ci] ?? ''}</td>
                                ))}
                              </tr>
                            ))}
                            {!isNewFile && previewExistingRows.length > 0 && (
                              <tr><td colSpan={displayHeaders.length} className="bg-gray-50 px-3 py-1 text-center text-[10px] text-gray-400">··· {existingRowCount.toLocaleString()} แถว ···</td></tr>
                            )}
                            {previewNewRows.map((row, i) => (
                              <tr key={`new-${i}`} className={isNewFile ? 'text-gray-700' : 'bg-green-50 font-medium text-green-800'}>
                                {displayHeaders.map((_, ci) => (
                                  <td key={ci} className="whitespace-nowrap px-3 py-1.5">{row[ci] ?? ''}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-8 text-center text-xs text-gray-400">
                      {isNewFile ? 'ไฟล์จะถูกบันทึกตามที่อัพโหลด' : 'ข้อมูล preview จะแสดงหลังจาก merge สำเร็จ'}
                    </div>
                  )}

                  {/* Target path */}
                  <div className={`rounded-xl border px-4 py-3 ${isNewFile ? 'border-purple-100 bg-purple-50/60' : 'border-orange-100 bg-[#fff8f5]'}`}>
                    <p className={`text-[10px] font-semibold ${isNewFile ? 'text-purple-700' : 'text-[#eb6f45f1]'}`}>
                      {isNewFile ? '✨ จะสร้างโฟลเดอร์ใหม่และบันทึกไฟล์ที่' : '⚠️ จะบันทึกแทนที่ไฟล์เดิมใน MinIO'}
                    </p>
                    {isNewFile && selectedDomainOption && suggested ? (
                      <p className="mt-1 font-mono text-xs leading-relaxed text-purple-900">
                        <span className="text-purple-400">MinIO / </span>
                        <span className="font-bold text-purple-700">{selectedDomainOption.path}</span>
                        <span className="font-bold text-purple-900">{suggested.subfolder}/</span>
                        <span className="text-purple-600">{uploadedFile?.name}</span>
                      </p>
                    ) : (
                      <div className="mt-1 space-y-1">
                        <p className="font-mono text-xs text-gray-500 line-through opacity-60">{foundMatch?.path ?? ''}{foundMatch?.name ?? ''}</p>
                        <p className="font-mono text-xs font-semibold text-[#eb6f45f1]">
                          {(() => {
                            const p = foundMatch?.path ?? ''
                            const lastSlash = p.lastIndexOf('/')
                            const dir = lastSlash !== -1 ? p.slice(0, lastSlash + 1) : ''
                            return `${dir}${suggestedOutputName || (foundMatch?.name ?? '')}`
                          })()}
                        </p>
                        {suggestedOutputName && suggestedOutputName !== foundMatch?.name && (
                          <p className="text-[10px] text-[#eb6f45f1]">📅 อัปเดตชื่อไฟล์ตามช่วงปีใหม่</p>
                        )}
                      </div>
                    )}
                    {isNewFile && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="rounded-full bg-purple-200/70 px-2 py-0.5 text-[9px] font-semibold text-purple-800">📁 {selectedDomainOption?.label}</span>
                        <span className="rounded-full bg-purple-200/70 px-2 py-0.5 text-[9px] font-semibold text-purple-800">📂 {suggested?.subfolder}</span>
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] text-purple-600">สร้างอัตโนมัติถ้ายังไม่มี</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button onClick={() => setFlowStep(isNewFile ? 'not_found' : 'pipeline')} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100">ย้อนกลับ</button>
                    <button
                      onClick={handleConfirmSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 rounded-lg bg-[#eb6f45f1] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#fc632c] disabled:opacity-60"
                    >
                      {isSaving ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="30 40" strokeLinecap="round"/></svg>
                          กำลังบันทึก…
                        </>
                      ) : 'ยืนยัน • บันทึกลง MinIO'}
                    </button>
                  </div>
                </>
              ) : (
                /* SAVED */
                <div className="flex flex-col items-center justify-center space-y-5 py-12">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                    <span className="text-4xl">✅</span>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-800">บันทึกลง MinIO สำเร็จ!</p>
                    <p className="mt-1 text-xs text-gray-500">{isNewFile ? 'สร้างโฟลเดอร์ใหม่และบันทึกไฟล์เรียบร้อยแล้ว' : 'ไฟล์ถูกแทนที่เรียบร้อยแล้ว'}</p>
                  </div>
                  <div className={`w-full rounded-xl border px-4 py-3 ${isNewFile ? 'border-purple-200 bg-purple-50' : 'border-green-200 bg-green-50'}`}>
                    <p className={`text-[10px] font-semibold ${isNewFile ? 'text-purple-700' : 'text-green-700'}`}>บันทึกที่</p>
                    <p className={`mt-0.5 font-mono text-xs break-all ${isNewFile ? 'text-purple-900' : 'text-green-800'}`}>
                      {savedPath || (isNewFile ? newFileSavePath : `${foundMatch?.path ?? ''}${suggestedOutputName || (foundMatch?.name ?? '')}`)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1.5 rounded-lg border-2 border-[#eb6f45f1] px-5 py-2 text-sm font-semibold text-[#eb6f45f1] transition hover:bg-[#fff3ee]"
                    >
                      <span>+</span> เพิ่มข้อมูลใหม่
                    </button>
                    <button onClick={onClose} className="rounded-lg bg-[#eb6f45f1] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#fc632c]">ปิด</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
          <p className="text-[11px] text-gray-400">
            {flowStep === 'upload'    && 'รองรับ .csv, .xlsx — ค้นหาใน MinIO อัตโนมัติ'}
            {flowStep === 'searching' && 'อัพโหลดไฟล์และค้นหาใน MinIO…'}
            {flowStep === 'found'     && foundMatch && `พบไฟล์ · similarity ${foundMatch.confidence}%`}
            {flowStep === 'not_found' && `ไม่พบไฟล์เดิม · AI แนะนำ ${suggested?.label}`}
            {flowStep === 'analyze'   && `${columns.filter(c => c.status === 'matched').length} ตรงกัน · ${columns.filter(c => c.status === 'similar').length} คล้ายกัน · ${existingRowCount + newRowCount} แถวรวม`}
            {flowStep === 'pipeline'  && (pipelineDone ? `Merge เสร็จ · ${totalRowCount.toLocaleString()} แถว` : pipelineActive ? 'กำลัง Merge…' : 'พร้อม Merge')}
            {flowStep === 'preview'   && !isSaved && (isNewFile ? `จะบันทึกใหม่ใน ${selectedDomainOption?.label}/${suggested?.subfolder}` : 'จะแทนที่ไฟล์เดิมใน MinIO')}
            {flowStep === 'preview'   && isSaved  && 'บันทึกสำเร็จ ✓'}
          </p>
          <div className="flex gap-2">
            {flowStep !== 'searching' && flowStep !== 'preview' && (
              <button onClick={handleReset} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100">รีเซ็ต</button>
            )}
            {flowStep !== 'preview' && (
              <button onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100">ปิด</button>
            )}
            {flowStep === 'pipeline' && !pipelineDone && (
              <button onClick={handleStartPipeline} disabled={pipelineActive} className="rounded-lg bg-[#eb6f45f1] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#fc632c] disabled:opacity-50">
                {pipelineActive ? 'กำลัง Merge…' : 'เริ่ม Merge'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
