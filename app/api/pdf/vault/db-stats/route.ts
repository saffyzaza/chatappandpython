import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function GET(req: NextRequest) {
  try {
    const resp = await fetch(`${PYTHON_API_URL}/pdf/vault/db-stats`)
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
