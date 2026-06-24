import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params
  try {
    const resp = await fetch(`${PYTHON_API_URL}/pdf/ingest/status/${job_id}`)
    if (!resp.ok) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    const data = await resp.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}
