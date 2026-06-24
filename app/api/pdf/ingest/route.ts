import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      file_id: string
      original_name?: string
      province?: string | null
      district?: string | null
      folder_name?: string | null
    }
    const { file_id, original_name = 'document.pdf', province, district, folder_name } = body

    if (!file_id) {
      return NextResponse.json({ error: 'file_id is required' }, { status: 400 })
    }

    let url = `${PYTHON_API_URL}/pdf/ingest/${encodeURIComponent(file_id)}?original_name=${encodeURIComponent(original_name)}`
    if (province) url += `&province=${encodeURIComponent(province)}`
    if (district) url += `&district=${encodeURIComponent(district)}`
    if (folder_name) url += `&folder_name=${encodeURIComponent(folder_name)}`

    const resp = await fetch(url, { method: 'POST' })

    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json({ error: text }, { status: resp.status })
    }

    const data = await resp.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('PDF ingest proxy error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ingest failed' },
      { status: 500 }
    )
  }
}
