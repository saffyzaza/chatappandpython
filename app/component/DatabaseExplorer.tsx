"use client"
import { useEffect, useState, useSyncExternalStore } from "react"
import { FiFile, FiRefreshCw, FiX, FiCheck } from "react-icons/fi"
import {
  getAttachedFiles,
  subscribeAttachedFiles,
  attachFile,
  detachFile,
  type AttachedFile,
} from "../chat/attachedFilesStore"
import { getAllFiles, type StoredFile } from "../fileapa/fileStorage"

const EXT_COLOR: Record<string, string> = {
  csv:  "bg-green-100 text-green-700",
  xlsx: "bg-blue-100 text-blue-700",
  pdf:  "bg-red-100 text-red-700",
  txt:  "bg-gray-100 text-gray-600",
}

export function DatabaseExplorer() {
  const [files, setFiles]       = useState<StoredFile[]>([])
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState("")

  const attached = useSyncExternalStore(
    subscribeAttachedFiles,
    getAttachedFiles,
    () => [] as AttachedFile[],
  )

  const load = async () => {
    setLoading(true)
    try {
      const all = await getAllFiles()
      setFiles(all)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.path.toLowerCase().includes(search.toLowerCase())
  )

  const isAttached = (id: string) => attached.some((a) => a.id === id)

  const toggle = (file: StoredFile) => {
    if (isAttached(file.id)) {
      detachFile(file.id)
    } else {
      attachFile({ id: file.id, name: file.name, extension: file.extension })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          ฐานข้อมูล
        </span>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 transition"
          title="รีเฟรช"
        >
          <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-gray-100">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาไฟล์..."
          className="w-full text-xs px-2 py-1 rounded-md border border-gray-200 outline-none focus:border-[#db5b24] bg-gray-50"
        />
      </div>

      {/* Attached badges */}
      {attached.length > 0 && (
        <div className="px-2 py-1.5 border-b border-gray-100 flex flex-wrap gap-1">
          {attached.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 text-[10px] bg-[#fff1eb] text-[#c85f35] border border-[#f5c7ad] rounded-full px-1.5 py-0.5 font-medium"
            >
              {f.name.length > 14 ? f.name.slice(0, 12) + "…" : f.name}
              <button onClick={() => detachFile(f.id)} className="hover:text-red-500">
                <FiX size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading && files.length === 0 && (
          <div className="flex justify-center py-6">
            <div className="w-4 h-4 border-2 border-[#db5b24] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">ไม่พบไฟล์</p>
        )}
        {filtered.map((file) => {
          const ext = file.extension.replace(".", "").toLowerCase()
          const selected = isAttached(file.id)
          return (
            <button
              key={file.id}
              onClick={() => toggle(file)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                selected ? "bg-[#fff8f5]" : ""
              }`}
            >
              {/* Checkbox */}
              <div
                className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                  selected
                    ? "bg-[#db5b24] border-[#db5b24]"
                    : "border-gray-300"
                }`}
              >
                {selected && <FiCheck size={9} className="text-white" />}
              </div>

              <FiFile size={12} className="text-gray-400 flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-gray-700 truncate">
                  {file.name}
                </p>
                <p className="text-[10px] text-gray-400 truncate">{file.path}</p>
              </div>

              <span
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${
                  EXT_COLOR[ext] ?? "bg-gray-100 text-gray-500"
                }`}
              >
                {ext}
              </span>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      {attached.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 bg-[#fff8f5]">
          <p className="text-[10px] text-[#c85f35] font-medium">
            เลือก {attached.length} ไฟล์ → พิมพ์คำถามในแชต
          </p>
        </div>
      )}
    </div>
  )
}
