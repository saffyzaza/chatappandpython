'use client'

import React, { ChangeEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import Sidelist from './Sidelist'
import Viewfile from './Viewfile'
import { saveFile, getAllFiles, deleteFile, updateFile } from './fileStorage'

type PreviewKind = 'pdf' | 'csv' | 'xlsx' | 'text' | 'unsupported'

type UploadedEntry = {
  id: string
  name: string
  path: string
  extension: string
  size: number
  previewKind: PreviewKind
  objectUrl: string
}

type VirtualFolder = {
  id: string
  name: string
  path: string
}

function getExtension(fileName: string) {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.at(-1)?.toLowerCase() ?? '' : ''
}

function getPreviewKind(fileName: string, mimeType = ''): PreviewKind {
  const extension = getExtension(fileName)

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return 'pdf'
  }

  if (extension === 'csv') {
    return 'csv'
  }

  if (extension === 'xlsx' || extension === 'xls') {
    return 'xlsx'
  }

  if (
    mimeType.startsWith('text/') ||
    ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css'].includes(extension)
  ) {
    return 'text'
  }

  return 'unsupported'
}

function renamePath(path: string, nextName: string) {
  const segments = path.split('/').filter(Boolean)

  if (segments.length === 0) {
    return nextName
  }

  segments[segments.length - 1] = nextName
  return segments.join('/')
}

function goToApaList(router: ReturnType<typeof useRouter>, fileId: string) {
  router.push(`/fileapa/listapa?fileId=${encodeURIComponent(fileId)}`)
}

export default function Page() {
  const router = useRouter()
  const [items, setItems] = useState<UploadedEntry[]>([])
  const [virtualFolders, setVirtualFolders] = useState<VirtualFolder[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [targetFolderPath, setTargetFolderPath] = useState<string>('')
  const folderUploadInputRef = useRef<HTMLInputElement>(null)

  // Load files from MinIO on mount
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const storedFiles = await getAllFiles()
        const loadedItems: UploadedEntry[] = storedFiles.map((storedFile) => ({
          id: storedFile.id,
          name: storedFile.name,
          path: storedFile.path,
          extension: storedFile.extension,
          size: storedFile.size,
          previewKind: storedFile.previewKind,
          objectUrl: `/api/files/${storedFile.id}`,
        }))
        setItems(loadedItems)
      } catch (error) {
        console.error('Error loading files from MinIO:', error)
      }
    }

    loadFiles()
  }, [])

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files

    if (!fileList?.length) {
      return
    }

    try {
      const savedIds: string[] = []

      for (const file of Array.from(fileList)) {
        const path = file.webkitRelativePath || file.name
        const saved = await saveFile(file, path)

        savedIds.push(saved.id)

        const newItem: UploadedEntry = {
          id: saved.id,
          name: saved.name,
          path: saved.path,
          extension: saved.extension,
          size: saved.size,
          previewKind: saved.previewKind,
          objectUrl: `/api/files/${saved.id}`,
        }

        setItems((current) => [...current, newItem])
      }

      if (savedIds.length > 0) {
        goToApaList(router, savedIds[0])
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('เกิดข้อผิดพลาดในการอัพโหลดไฟล์')
    }

    event.target.value = ''
  }

  const handleRemoveItem = async (itemId: string) => {
    try {
      await deleteFile(itemId)
      setItems((current) => current.filter((item) => item.id !== itemId))
      setSelectedId((current) => (current === itemId ? null : current))
    } catch (error) {
      console.error('Error removing file:', error)
      alert('เกิดข้อผิดพลาดในการลบไฟล์')
    }
  }

  const handleRenameItem = async (itemId: string) => {
    const target = items.find((item) => item.id === itemId)

    if (!target) {
      return
    }

    const nextName = window.prompt('Rename file', target.name)?.trim()

    if (!nextName || nextName === target.name) {
      return
    }

    try {
      const newExtension = getExtension(nextName)
      const newPath = renamePath(target.path, nextName)
      const newPreviewKind = getPreviewKind(nextName)

      await updateFile(itemId, {
        name: nextName,
        path: newPath,
        extension: newExtension,
        previewKind: newPreviewKind,
      })

      setItems((current) =>
        current.map((item) => {
          if (item.id !== itemId) {
            return item
          }

          return {
            ...item,
            name: nextName,
            path: newPath,
            extension: newExtension,
            previewKind: newPreviewKind,
          }
        })
      )
    } catch (error) {
      console.error('Error renaming file:', error)
      alert('เกิดข้อผิดพลาดในการเปลี่ยนชื่อไฟล์')
    }
  }

  const handleCreateFolder = (parentPath: string = '') => {
    const folderName = window.prompt('Folder name')?.trim()

    if (!folderName) {
      return
    }

    const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName

    const newFolder: VirtualFolder = {
      id: `folder-${Date.now()}-${Math.random()}`,
      name: folderName,
      path: folderPath,
    }

    setVirtualFolders((current) => [...current, newFolder])
  }

  const handleUploadToFolder = (folderPath: string) => {
    setTargetFolderPath(folderPath)
    folderUploadInputRef.current?.click()
  }

  const handleFolderFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files

    if (!fileList?.length) {
      return
    }

    try {
      const savedIds: string[] = []

      for (const file of Array.from(fileList)) {
        const path = targetFolderPath ? `${targetFolderPath}/${file.name}` : file.name
        const saved = await saveFile(file, path)

        savedIds.push(saved.id)

        const newItem: UploadedEntry = {
          id: saved.id,
          name: saved.name,
          path: saved.path,
          extension: saved.extension,
          size: saved.size,
          previewKind: saved.previewKind,
          objectUrl: `/api/files/${saved.id}`,
        }

        setItems((current) => [...current, newItem])
      }

      if (savedIds.length > 0) {
        goToApaList(router, savedIds[0])
      }
    } catch (error) {
      console.error('Error uploading files to folder:', error)
      alert('เกิดข้อผิดพลาดในการอัพโหลดไฟล์')
    }

    event.target.value = ''
  }

  const handleMoveItem = async (itemId: string, targetFolderPath: string) => {
    try {
      const newPath = targetFolderPath ? `${targetFolderPath}/${items.find(i => i.id === itemId)?.name}` : items.find(i => i.id === itemId)?.name || ''

      await updateFile(itemId, { path: newPath })

      setItems((current) =>
        current.map((item) => {
          if (item.id !== itemId) {
            return item
          }

          return {
            ...item,
            path: newPath,
          }
        })
      )
    } catch (error) {
      console.error('Error moving file:', error)
      alert('เกิดข้อผิดพลาดในการย้ายไฟล์')
    }
  }

  const handleDropExternal = async (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingOver(false)

    const fileList = event.dataTransfer.files

    if (!fileList?.length) {
      return
    }

    try {
      const savedIds: string[] = []

      for (const file of Array.from(fileList)) {
        const saved = await saveFile(file, file.name)

        savedIds.push(saved.id)

        const newItem: UploadedEntry = {
          id: saved.id,
          name: saved.name,
          path: saved.path,
          extension: saved.extension,
          size: saved.size,
          previewKind: saved.previewKind,
          objectUrl: `/api/files/${saved.id}`,
        }

        setItems((current) => [...current, newItem])
      }

      // Redirect to the first uploaded file
      if (savedIds.length > 0) {
        goToApaList(router, savedIds[0])
      }
    } catch (error) {
      console.error('Error dropping files:', error)
      alert('เกิดข้อผิดพลาดในการอัพโหลดไฟล์')
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingOver(false)
  }

  const selectedItem = items.find((item) => item.id === selectedId) ?? null

  return (
    <main 
      className="h-full min-h-0 overflow-hidden bg-[#fffaf8] px-3 py-3 text-gray-800 md:px-4 md:py-4"
      onDrop={handleDropExternal}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <section className={`mx-auto flex h-full min-h-0 max-w-7xl flex-col overflow-hidden rounded-2xl border shadow-sm xl:flex-row transition-all ${
        isDraggingOver 
          ? 'border-[#eb6f45f1] border-2 bg-[#fff3ee] shadow-lg' 
          : 'border-gray-100 bg-[#f7f4f3f1]'
      }`}>
        <div className="flex min-h-0 flex-1 flex-col border-b border-gray-200 xl:max-w-85 xl:border-b-0 xl:border-r">
          <div className="border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#eb6f45f1]">
                  File Workspace
                </p>
                <h1 className="text-base font-semibold text-gray-800">Document Explorer</h1>
              </div>
              <span className="rounded-full bg-[#eb6f45f1] px-2.5 py-0.5 text-[11px] font-medium text-white">
                {items.length}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <label
                htmlFor="file-upload"
                className="cursor-pointer rounded-lg bg-[#eb6f45f1] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#fc632c]"
              >
                Upload Files
              </label>
              <input
                id="file-upload"
                type="file"
                multiple
                onChange={handleUpload}
                className="hidden"
                accept=".pdf,.csv,.xlsx,.xls,.txt,.md,.json,.js,.ts,.tsx,.jsx,.html,.css"
              />

              <label
                htmlFor="folder-upload"
                className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-[#ffece5]"
              >
                Upload Folder
              </label>
              <input
                id="folder-upload"
                type="file"
                multiple
                onChange={handleUpload}
                className="hidden"
                {...({ webkitdirectory: '' } as unknown as React.InputHTMLAttributes<HTMLInputElement>)}
              />

              <button
                type="button"
                onClick={() => handleCreateFolder('')}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-[#ffece5]"
              >
                New Folder
              </button>
            </div>

            {/* Hidden input for upload to folder */}
            <input
              ref={folderUploadInputRef}
              type="file"
              multiple
              onChange={handleFolderFileUpload}
              className="hidden"
              accept=".pdf,.csv,.xlsx,.xls,.txt,.md,.json,.js,.ts,.tsx,.jsx,.html,.css"
            />
          </div>

          <Sidelist
            items={items}
            virtualFolders={virtualFolders}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={handleRemoveItem}
            onRename={handleRenameItem}
            onMoveItem={handleMoveItem}
            onCreateFolder={handleCreateFolder}
            onUploadToFolder={handleUploadToFolder}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <Viewfile
            entry={selectedItem}
            isFullscreen={false}
            onToggleFullscreen={() => selectedItem && router.push(`/fileapa/${selectedItem.id}`)}
          />
        </div>
      </section>
    </main>
  )
}
