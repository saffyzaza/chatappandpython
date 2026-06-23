import { NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function GET() {
  try {
    const resp = await fetch(`${PYTHON_API_URL}/pdf/vault/files`)
    if (!resp.ok) {
      return NextResponse.json({ zone10: [], root_files: [], provinces: [] })
    }
    const data = await resp.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ zone10: [], root_files: [], provinces: [] })
  }
}
