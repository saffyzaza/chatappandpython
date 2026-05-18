'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Viewfile from '../Viewfile'
import { getFile } from '../fileStorage'

type ViewerEntry = {
  id: string
  name: string
  path: string
  extension: string
  size: number
  previewKind: 'pdf' | 'csv' | 'xlsx' | 'text' | 'unsupported'
  objectUrl: string
}

export default function FileViewPage() {
  const params = useParams()
  const router = useRouter()
  const [entry, setEntry] = useState<ViewerEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadFile = async () => {
      try {
        const fileRoute = params.fileRoute as string
        
        if (!fileRoute) {
          setError('Invalid file route')
          setLoading(false)
          return
        }

        // File ID is the route itself (just the 6-digit number)
        const fileId = decodeURIComponent(fileRoute)
        
        const storedFile = await getFile(fileId)

        if (!storedFile) {
          setError('File not found')
          setLoading(false)
          return
        }

        const viewerEntry: ViewerEntry = {
          id: storedFile.id,
          name: storedFile.name,
          path: storedFile.path,
          extension: storedFile.extension,
          size: storedFile.size,
          previewKind: storedFile.previewKind,
          objectUrl: `/api/files/${storedFile.id}`,
        }

        setEntry(viewerEntry)
        setLoading(false)
      } catch (err) {
        console.error('Error loading file:', err)
        setError('Failed to load file')
        setLoading(false)
      }
    }

    loadFile()
  }, [params.fileRoute])

  const handleToggleFullscreen = () => {
    // For file view page, fullscreen doesn't make sense
    // We can add a separate fullscreen modal if needed
  }

  const handleBackToExplorer = () => {
    router.push('/fileapa')
  }

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#fffaf8]">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#eb6f45f1] border-t-transparent mx-auto" />
          <p className="text-gray-600">Loading file...</p>
        </div>
      </main>
    )
  }

  if (error || !entry) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#fffaf8]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">File Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The file you are looking for does not exist.'}</p>
          <button
            onClick={handleBackToExplorer}
            className="rounded-xl bg-[#eb6f45f1] px-6 py-2 text-white hover:bg-[#fc632c] transition"
          >
            Back to Explorer
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen overflow-hidden bg-[#fffaf8]">
      <div className="flex h-full flex-col">
        {/* <div className="border-b border-gray-200 bg-white px-4 py-3">
          <button
            onClick={handleBackToExplorer}
            className="mb-2 inline-flex items-center gap-2 text-sm text-[#eb6f45f1] hover:text-[#fc632c] transition"
          >
            ← Back to Explorer
          </button>
        </div> */}
        <div className="flex-1 min-h-0">
          <Viewfile
            entry={entry}
            isFullscreen={false}
            onToggleFullscreen={handleToggleFullscreen}
          />
        </div>
      </div>
    </main>
  )
}
