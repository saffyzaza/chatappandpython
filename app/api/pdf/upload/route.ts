import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Forward directly to Python backend
    const proxyForm = new FormData()
    proxyForm.append('file', file)

    const resp = await fetch(`${PYTHON_API_URL}/pdf/upload`, {
      method: 'POST',
      body: proxyForm,
    })

    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json({ error: text }, { status: resp.status })
    }

    const data = await resp.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('PDF upload proxy error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    )
  }
}
