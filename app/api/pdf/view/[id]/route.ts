import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

/**
 * GET /api/pdf/view/[id] — stream a PDF from the pdf-library bucket via the Python backend.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const resp = await fetch(`${PYTHON_API_URL}/pdf/view/${encodeURIComponent(id)}`)

    if (!resp.ok) {
      return NextResponse.json({ error: 'File not found' }, { status: resp.status })
    }

    const contentType = resp.headers.get('content-type') || 'application/pdf'
    const buffer = await resp.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
