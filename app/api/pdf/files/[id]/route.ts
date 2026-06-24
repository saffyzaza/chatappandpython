import { NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const resp = await fetch(`${PYTHON_API_URL}/pdf/files/${id}`, {
      method: 'DELETE',
    })
    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json({ error: text }, { status: resp.status })
    }
    const data = await resp.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('PDF delete error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
