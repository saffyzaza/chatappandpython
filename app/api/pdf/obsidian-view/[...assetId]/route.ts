import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

/**
 * Proxy route for streaming Obsidian PDF assets from MinIO via the Python API.
 * Supports two modes:
 *   GET /api/pdf/obsidian-view/[assetId]         → by obsidian_pdf_assets.id
 *   GET /api/pdf/obsidian-view/note/[...notePath] → by note_id path
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ assetId: string[] }> }
) {
  const { assetId: segments } = await context.params

  let upstreamUrl: string
  if (segments[0] === 'note') {
    const notePath = segments.slice(1).join('/')
    upstreamUrl = `${PYTHON_API_URL}/pdf/view/obsidian/by-note/${encodeURIComponent(notePath)}`
  } else {
    const assetId = segments[0]
    upstreamUrl = `${PYTHON_API_URL}/pdf/view/obsidian/${assetId}`
  }

  try {
    const resp = await fetch(upstreamUrl)
    if (!resp.ok) {
      return NextResponse.json(
        { error: `PDF not found (${resp.status})` },
        { status: resp.status }
      )
    }
    const contentType = resp.headers.get('content-type') || 'application/pdf'
    const contentDisposition = resp.headers.get('content-disposition') || 'inline'
    const buffer = await resp.arrayBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
