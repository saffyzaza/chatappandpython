import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') || ''
  const resp = await fetch(`${PYTHON_API_URL}/pdf/vault/file?path=${encodeURIComponent(path)}`)
  const data = await resp.json()
  if (!resp.ok) return NextResponse.json(data, { status: resp.status })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') || ''
  const body = await req.json()
  const resp = await fetch(`${PYTHON_API_URL}/pdf/vault/file?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  if (!resp.ok) return NextResponse.json(data, { status: resp.status })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') || ''
  const resp = await fetch(`${PYTHON_API_URL}/pdf/vault/file?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  })
  const data = await resp.json()
  if (!resp.ok) return NextResponse.json(data, { status: resp.status })
  return NextResponse.json(data)
}
