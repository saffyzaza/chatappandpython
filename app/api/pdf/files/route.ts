import { NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function GET() {
  try {
    const resp = await fetch(`${PYTHON_API_URL}/pdf/files`)
    if (!resp.ok) {
      return NextResponse.json({ files: [] }, { status: resp.status })
    }
    const data = await resp.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('PDF files list error:', error)
    return NextResponse.json({ files: [] })
  }
}
