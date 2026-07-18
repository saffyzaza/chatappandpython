import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

/**
 * Proxy: POST /api/pdf/vault/migrate-from-filesystem
 * Triggers a one-time migration of all .md files from the Obsidian vault
 * filesystem into the obsidian_notes database table.
 */
export async function POST(req: NextRequest) {
  try {
    const resp = await fetch(`${PYTHON_API_URL}/pdf/vault/migrate-from-filesystem`, {
      method: 'POST',
    })
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
