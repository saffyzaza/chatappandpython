import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const resp = await fetch(`${PYTHON_API_URL}/pdf/vault/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  if (!resp.ok) return NextResponse.json(data, { status: resp.status })
  return NextResponse.json(data)
}
