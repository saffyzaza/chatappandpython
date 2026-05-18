'use client'

import React, { useEffect, useState } from 'react'
import { FiDownload, FiFileText, FiMaximize2, FiMinimize2 } from 'react-icons/fi'

type ViewerEntry = {
	id: string
	name: string
	path: string
	extension: string
	size: number
	previewKind: 'pdf' | 'csv' | 'xlsx' | 'text' | 'unsupported'
	objectUrl: string
}

type PreviewState =
	| {
			kind: 'pdf'
		}
	| {
			kind: 'table'
			title: string
			rows: string[][]
			truncated: boolean
		}
	| {
			kind: 'text'
			text: string
			truncated: boolean
			compacted: boolean
		}
	| {
			kind: 'unsupported'
			message: string
		}

type ViewfileProps = {
	entry: ViewerEntry | null
	isFullscreen: boolean
	onToggleFullscreen: () => void
}

function formatBytes(size: number) {
	if (size < 1024) {
		return `${size} B`
	}

	if (size < 1024 * 1024) {
		return `${(size / 1024).toFixed(1)} KB`
	}

	return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function parseCsv(text: string) {
	const rows: string[][] = []
	let currentRow: string[] = []
	let currentCell = ''
	let quoted = false

	for (let index = 0; index < text.length; index += 1) {
		const char = text[index]
		const nextChar = text[index + 1]

		if (char === '"') {
			if (quoted && nextChar === '"') {
				currentCell += '"'
				index += 1
			} else {
				quoted = !quoted
			}
			continue
		}

		if (!quoted && char === ',') {
			currentRow.push(currentCell)
			currentCell = ''
			continue
		}

		if (!quoted && (char === '\n' || char === '\r')) {
			if (char === '\r' && nextChar === '\n') {
				index += 1
			}

			currentRow.push(currentCell)
			rows.push(currentRow)
			currentRow = []
			currentCell = ''
			continue
		}

		currentCell += char
	}

	if (currentCell.length > 0 || currentRow.length > 0) {
		currentRow.push(currentCell)
		rows.push(currentRow)
	}

	return rows
}

function truncateTable(rows: string[][], maxRows = 2000, maxCols = 200) {
	return {
		rows: rows.slice(0, maxRows).map((row) => row.slice(0, maxCols).map((cell) => `${cell}`)),
		truncated: rows.length > maxRows || rows.some((row) => row.length > maxCols),
	}
}

function compactPreviewText(text: string) {
	const normalized = text.replace(/\r\n/g, '\n')
	const nextLines: string[] = []
	let blankLineCount = 0
	let compacted = false

	for (const line of normalized.split('\n')) {
		if (line.trim().length === 0) {
			blankLineCount += 1

			if (blankLineCount > 1) {
				compacted = true
				continue
			}
		} else {
			blankLineCount = 0
		}

		nextLines.push(line)
	}

	return {
		text: nextLines.join('\n'),
		compacted,
	}
}

export default function Viewfile({ entry, isFullscreen, onToggleFullscreen }: ViewfileProps) {
	const [preview, setPreview] = useState<PreviewState | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const textPreviewLines = preview?.kind === 'text' ? preview.text.split('\n') : []

	useEffect(() => {
		let active = true

		if (!entry) {
			return () => {
				active = false
			}
		}

		const loadPreview = async () => {
			setLoading(true)
			setError(null)

			try {
				if (entry.previewKind === 'pdf') {
					if (active) {
						setPreview({ kind: 'pdf' })
					}
					return
				}

				if (entry.previewKind === 'csv') {
					const text = await fetch(entry.objectUrl).then((r) => r.text())
					const parsed = truncateTable(parseCsv(text))

					if (active) {
						setPreview({
							kind: 'table',
							title: 'CSV Preview',
							rows: parsed.rows,
							truncated: parsed.truncated,
						})
					}
					return
				}

				if (entry.previewKind === 'xlsx') {
					const [{ read, utils }, buffer] = await Promise.all([
						import('xlsx'),
						fetch(entry.objectUrl).then((r) => r.arrayBuffer()),
					])

					const workbook = read(buffer, { type: 'array' })
					const firstSheetName = workbook.SheetNames[0]
					const firstSheet = workbook.Sheets[firstSheetName]
					const rawRows = utils.sheet_to_json<(string | number | boolean | null)[]>(firstSheet, {
						header: 1,
						blankrows: false,
					})

					const normalizedRows = rawRows.map((row) => row.map((cell) => `${cell ?? ''}`))
					const parsed = truncateTable(normalizedRows)

					if (active) {
						setPreview({
							kind: 'table',
							title: `Excel Preview • ${firstSheetName}`,
							rows: parsed.rows,
							truncated: parsed.truncated,
						})
					}
					return
				}

				if (entry.previewKind === 'text') {
					const text = await fetch(entry.objectUrl).then((r) => r.text())
					const limit = 8000
					const compactedText = compactPreviewText(text.slice(0, limit))

					if (active) {
						setPreview({
							kind: 'text',
							text: compactedText.text,
							truncated: text.length > limit,
							compacted: compactedText.compacted,
						})
					}
					return
				}

				if (active) {
					setPreview({
						kind: 'unsupported',
						message: 'ชนิดไฟล์นี้ยังไม่มี inline preview แต่สามารถดาวน์โหลดหรือเปิดภายนอกได้',
					})
				}
			} catch {
				if (active) {
					setError('ไม่สามารถอ่านไฟล์นี้ได้')
				}
			} finally {
				if (active) {
					setLoading(false)
				}
			}
		}

		loadPreview()

		return () => {
			active = false
		}
	}, [entry])

	if (!entry) {
		return (
			<section className="flex h-full min-h-0 items-center justify-center bg-[#f7f4f3f1] p-8">
				<div className="max-w-md text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eb6f45f1] text-white">
						<FiFileText className="text-2xl" />
					</div>
					<h2 className="mt-5 text-3xl font-semibold text-gray-800">Ready to Preview</h2>
					<p className="mt-3 text-sm leading-6 text-gray-500">
						เลือกไฟล์จาก explorer ด้านซ้ายเพื่อเปิดดูเอกสาร รองรับ PDF, CSV, XLSX และ text-based files
					</p>
				</div>
			</section>
		)
	}

	return (
		<section className="flex h-full min-h-0 flex-1 flex-col bg-[#f7f4f3f1]">
			<header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#eb6f45f1]">Preview</p>
					<h2 className="mt-0.5 text-base font-semibold text-gray-800">{entry.name}</h2>
					<p className="mt-0.5 text-sm text-gray-500">
						{entry.path} • {entry.previewKind.toUpperCase()} • {formatBytes(entry.size)}
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={onToggleFullscreen}
						className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-[#ffece5]"
					>
						{isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
						{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
					</button>
					<a
						href={`${entry.objectUrl}?download=1`}
						download={entry.name}
						className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-[#ffece5]"
					>
						<FiDownload />
						Download
					</a>
				</div>
			</header>

			<div className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
					{loading ? (
						<div className="flex flex-1 items-center justify-center text-sm text-gray-500">Loading preview...</div>
					) : error ? (
						<div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-rose-600">
							{error}
						</div>
					) : preview?.kind === 'pdf' ? (
						<object data={entry.objectUrl} type="application/pdf" className="min-h-[52vh] w-full flex-1">
							<div className="flex h-full min-h-[52vh] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-gray-600">
								<p>เบราว์เซอร์นี้ไม่สามารถแสดง PDF ในหน้าได้</p>
								<div className="flex flex-wrap justify-center gap-2">
									<a
										href={entry.objectUrl}
										target="_blank"
										rel="noreferrer"
										className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-[#fff3ee]"
									>
										เปิด PDF
									</a>
									<a
										href={`${entry.objectUrl}?download=1`}
										download={entry.name}
										className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-[#fff3ee]"
									>
										ดาวน์โหลด PDF
									</a>
								</div>
							</div>
						</object>
					) : preview?.kind === 'table' ? (
						<>
							<div className="border-b border-gray-200 bg-[#f7f4f3f1] px-4 py-3 text-sm font-medium text-gray-700">
								{preview.title}
							</div>
							<div className="min-h-0 flex-1 overflow-auto">
								<table className="min-w-full border-collapse text-sm">
									<tbody>
										{preview.rows.map((row, rowIndex) => (
											<tr key={`${entry.id}-${rowIndex}`} className="border-b border-gray-100 align-top">
												{row.map((cell, cellIndex) => (
													<td
														key={`${entry.id}-${rowIndex}-${cellIndex}`}
														className={`whitespace-pre-wrap px-3 py-2 text-gray-700 ${
															rowIndex === 0 ? 'bg-[#fff3ee] font-semibold text-gray-900' : ''
														}`}
													>
														{cell || ' '}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
							{preview.truncated ? (
								<div className="border-t border-gray-200 bg-[#f7f4f3f1] px-4 py-3 text-xs text-gray-500">
									แสดงเฉพาะบางส่วนของข้อมูลเพื่อให้ preview เร็วขึ้น
								</div>
							) : null}
						</>
					) : preview?.kind === 'text' ? (
						<>
							<div className="flex items-center justify-between border-b border-gray-200 bg-[#f7f4f3f1] px-4 py-3 text-sm font-medium text-gray-700">
								<span>Text Preview</span>
								<span className="text-xs font-normal text-gray-500">{textPreviewLines.length} lines</span>
							</div>
							<div className="min-h-0 flex-1 overflow-auto bg-[#232323]">
								<div className="min-w-full py-3 font-mono text-[13px] leading-6 text-gray-100">
									{textPreviewLines.map((line, index) => (
										<div
											key={`${entry.id}-line-${index + 1}`}
											className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 px-4 py-0.5 hover:bg-white/5"
										>
											<div className="select-none text-right text-[11px] text-gray-500">{index + 1}</div>
											<div className="min-w-0 whitespace-pre-wrap wrap-break-word">{line || ' '}</div>
										</div>
									))}
								</div>
							</div>
							{preview.truncated || preview.compacted ? (
								<div className="border-t border-gray-200 bg-[#f7f4f3f1] px-4 py-3 text-xs text-gray-500">
									{preview.truncated ? 'เนื้อหาถูกตัดบางส่วนเพื่อให้แสดงผลได้ลื่นขึ้น' : null}
									{preview.truncated && preview.compacted ? ' • ' : null}
									{preview.compacted ? 'ย่อบรรทัดว่างที่ซ้ำกันใน preview เพื่อให้อ่านง่ายขึ้น' : null}
								</div>
							) : null}
						</>
					) : (
						<div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-500">
							{preview?.message ?? 'ยังไม่มี preview สำหรับไฟล์นี้'}
						</div>
					)}
				</div>
			</div>
		</section>
	)
}
