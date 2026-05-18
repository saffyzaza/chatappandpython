'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
	FiChevronDown,
	FiChevronRight,
	FiDownload,
	FiEdit3,
	FiMaximize2,
	FiFile,
	FiFolder,
	FiTrash2,
	FiPlus,
	FiUpload,
} from 'react-icons/fi'

type ExplorerItem = {
	id: string
	name: string
	path: string
	extension: string
	size: number
	previewKind: 'pdf' | 'csv' | 'xlsx' | 'text' | 'unsupported'
	objectUrl: string
}

type VirtualFolder = {
	id: string
	name: string
	path: string
}

type TreeNode = {
	id: string
	name: string
	path: string
	kind: 'folder' | 'file'
	item?: ExplorerItem
	children?: TreeNode[]
	isVirtual?: boolean
}

type SidelistProps = {
	items: ExplorerItem[]
	virtualFolders: VirtualFolder[]
	selectedId: string | null
	onSelect: (id: string) => void
	onRemove: (id: string) => void
	onRename: (id: string) => void
	onMoveItem: (itemId: string, targetFolderPath: string) => void
	onCreateFolder: (parentPath: string) => void
	onUploadToFolder: (folderPath: string) => void
}

type ContextMenuState = 
	| {
			x: number
			y: number
			type: 'file'
			item: ExplorerItem
	  }
	| {
			x: number
			y: number
			type: 'folder'
			folderPath: string
			folderName: string
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

function buildTree(items: ExplorerItem[], virtualFolders: VirtualFolder[]): TreeNode[] {
	const root: TreeNode[] = []

	// Add virtual folders first
	for (const vFolder of virtualFolders) {
		const segments = vFolder.path.split('/').filter(Boolean)
		let currentLevel = root
		let currentPath = ''

		segments.forEach((segment, index) => {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment
			const isLast = index === segments.length - 1

			let node = currentLevel.find((entry) => entry.name === segment)

			if (!node) {
				node = {
					id: isLast ? vFolder.id : currentPath,
					name: segment,
					path: currentPath,
					kind: 'folder',
					children: [],
					isVirtual: isLast,
				}
				currentLevel.push(node)
			}

			currentLevel = node.children ?? []
			node.children = currentLevel
		})
	}

	// Add files
	for (const item of items) {
		const segments = item.path.split('/').filter(Boolean)
		let currentLevel = root
		let currentPath = ''

		segments.forEach((segment, index) => {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment
			const isFile = index === segments.length - 1

			let node = currentLevel.find((entry) => entry.name === segment)

			if (!node) {
				node = {
					id: isFile ? item.id : currentPath,
					name: segment,
					path: currentPath,
					kind: isFile ? 'file' : 'folder',
					children: isFile ? undefined : [],
					item: isFile ? item : undefined,
				}
				currentLevel.push(node)
			}

			if (!isFile) {
				currentLevel = node.children ?? []
				node.children = currentLevel
			}
		})
	}

	const sortNodes = (nodes: TreeNode[]) => {
		nodes.sort((left, right) => {
			if (left.kind !== right.kind) {
				return left.kind === 'folder' ? -1 : 1
			}

			return left.name.localeCompare(right.name)
		})

		nodes.forEach((node) => {
			if (node.children) {
				sortNodes(node.children)
			}
		})
	}

	sortNodes(root)
	return root
}

function countItems(node: TreeNode): { files: number; folders: number } {
	if (node.kind === 'file') {
		return { files: 1, folders: 0 }
	}

	let totalFiles = 0
	let totalFolders = 0

	if (node.children) {
		for (const child of node.children) {
			const counts = countItems(child)
			totalFiles += counts.files
			totalFolders += counts.folders
			if (child.kind === 'folder') {
				totalFolders += 1
			}
		}
	}

	return { files: totalFiles, folders: totalFolders }
}

function renderIndent(depth: number) {
	return Array.from({ length: depth }).map((_, index) => (
		<span key={`indent-${depth}-${index}`} className="relative h-6 w-4 shrink-0">
			<span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-200" />
		</span>
	))
}

export default function Sidelist({
	items,
	virtualFolders,
	selectedId,
	onSelect,
	onRemove,
	onRename,
	onMoveItem,
	onCreateFolder,
	onUploadToFolder,
}: SidelistProps) {
	const tree = useMemo(() => buildTree(items, virtualFolders), [items, virtualFolders])
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(['root']))
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
	const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
	const [dropTargetPath, setDropTargetPath] = useState<string | null>(null)

	useEffect(() => {
		if (!contextMenu) {
			return
		}

		const closeMenu = () => {
			setContextMenu(null)
		}

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setContextMenu(null)
			}
		}

		window.addEventListener('click', closeMenu)
		window.addEventListener('contextmenu', closeMenu)
		window.addEventListener('keydown', handleEscape)

		return () => {
			window.removeEventListener('click', closeMenu)
			window.removeEventListener('contextmenu', closeMenu)
			window.removeEventListener('keydown', handleEscape)
		}
	}, [contextMenu])

	const toggleFolder = (path: string) => {
		setExpandedFolders((current) => {
			const next = new Set(current)

			if (next.has(path)) {
				next.delete(path)
			} else {
				next.add(path)
			}

			return next
		})
	}

	const handleDownload = (item: ExplorerItem) => {
		const link = document.createElement('a')
		link.href = item.objectUrl
		link.download = item.name
		link.click()
		setContextMenu(null)
	}

	const handleContextMenu = (event: React.MouseEvent, item: ExplorerItem) => {
		event.preventDefault()
		event.stopPropagation()
		onSelect(item.id)
		setContextMenu({
			x: event.clientX,
			y: event.clientY,
			type: 'file',
			item,
		})
	}

	const handleFolderContextMenu = (event: React.MouseEvent, folderPath: string, folderName: string) => {
		event.preventDefault()
		event.stopPropagation()
		setContextMenu({
			x: event.clientX,
			y: event.clientY,
			type: 'folder',
			folderPath,
			folderName,
		})
	}

	const handleDragStart = (event: React.DragEvent, itemId: string) => {
		event.stopPropagation()
		setDraggedItemId(itemId)
		event.dataTransfer.effectAllowed = 'move'
		event.dataTransfer.setData('text/plain', itemId)
	}

	const handleDragEnd = () => {
		setDraggedItemId(null)
		setDropTargetPath(null)
	}

	const handleDragOver = (event: React.DragEvent, folderPath: string) => {
		event.preventDefault()
		event.stopPropagation()
		setDropTargetPath(folderPath)
		event.dataTransfer.dropEffect = 'move'
	}

	const handleDragLeave = (event: React.DragEvent) => {
		event.preventDefault()
		event.stopPropagation()
		setDropTargetPath(null)
	}

	const handleDrop = (event: React.DragEvent, folderPath: string) => {
		event.preventDefault()
		event.stopPropagation()

		if (draggedItemId) {
			onMoveItem(draggedItemId, folderPath)
		}

		setDraggedItemId(null)
		setDropTargetPath(null)
	}

	const renderNodes = (nodes: TreeNode[], depth = 0): React.ReactNode => {
		return nodes.map((node) => {
			if (node.kind === 'folder') {
				const isOpen = expandedFolders.has(node.path)
				const counts = countItems(node)
				const totalItems = counts.files + counts.folders
				const isDropTarget = dropTargetPath === node.path

				return (
					<div key={node.path} className="space-y-0.5">
						<button
							type="button"
							onClick={() => toggleFolder(node.path)}
							onContextMenu={(event) => handleFolderContextMenu(event, node.path, node.name)}
							onDragOver={(event) => handleDragOver(event, node.path)}
							onDragLeave={handleDragLeave}
							onDrop={(event) => handleDrop(event, node.path)}
							className={`flex w-full items-center rounded-md px-2 py-1 text-left text-[13px] text-gray-700 transition hover:bg-[#fff1eb] ${
								isDropTarget ? 'bg-[#fff3ee] ring-1 ring-[#eb6f45f1]' : ''
							}`}
						>
							<div className="flex h-6 shrink-0 items-center">{renderIndent(depth)}</div>
							{isOpen ? (
								<FiChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" />
							) : (
								<FiChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-500" />
							)}
							<FiFolder className="ml-1 h-4 w-4 shrink-0 text-[#eb6f45f1]" />
							<span className="min-w-0 flex-1 truncate pl-2 font-medium text-gray-800">
								{node.name}
							</span>
							<span className="ml-3 shrink-0 text-[11px] text-gray-400">{totalItems}</span>
						</button>

						{isOpen && node.children ? <div className="space-y-0.5">{renderNodes(node.children, depth + 1)}</div> : null}
					</div>
				)
			}

			const isActive = node.item?.id === selectedId
			const isDragging = draggedItemId === node.id

			return (
				<button
					key={node.id}
					type="button"
					draggable
					onDragStart={(event) => handleDragStart(event, node.id)}
					onDragEnd={handleDragEnd}
					onClick={(event) => {
						event.stopPropagation()
						if (node.item) onSelect(node.item.id)
					}}
					onContextMenu={(event) => node.item && handleContextMenu(event, node.item)}
				className={`flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[13px] transition ${
					isDragging
						? 'opacity-50'
						: isActive
							? 'bg-blue-50 text-blue-800'
							: 'text-gray-700 hover:bg-gray-100'
				}`}
			>
				<div className="flex shrink-0 items-center">{renderIndent(depth)}</div>
				<span className="h-3 w-3 shrink-0" />
				<FiFile className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
				<div className="min-w-0 flex-1 pl-1">
					<div className="truncate font-normal">{node.name}</div>
				</div>
				<div className="ml-2 shrink-0 text-[10px] text-gray-400">
					{formatBytes(node.item?.size ?? 0)}
					</div>
				</button>
			)
		})
	}

	return (
		<aside className="flex min-h-0 flex-1 flex-col bg-[#f7f4f3f1]">
			<div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
				<p className="text-sm font-semibold text-gray-800">Explorer</p>
				<p className="text-xs text-gray-500">workspace</p>
			</div>

			{items.length === 0 && virtualFolders.length === 0 ? (
				<div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-500">
					ยังไม่มีไฟล์ใน workspace นี้ ลองอัปโหลดไฟล์หรือทั้งโฟลเดอร์เพื่อสร้าง tree ด้านซ้าย
				</div>
			) : (
				<div className="min-h-0 flex-1 overflow-auto px-2 py-2">
					<button
						type="button"
						onClick={() => toggleFolder('root')}
						onContextMenu={(event) => handleFolderContextMenu(event, '', 'workspace')}
						onDragOver={(event) => handleDragOver(event, '')}
						onDragLeave={handleDragLeave}
						onDrop={(event) => handleDrop(event, '')}
						className={`mb-1 flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[13px] text-gray-700 transition ${
							dropTargetPath === ''
								? 'bg-blue-50 ring-1 ring-blue-300'
								: 'hover:bg-gray-100'
						}`}
					>
						{expandedFolders.has('root') ? (
							<FiChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
						) : (
							<FiChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
						)}
						<FiFolder className="h-3.5 w-3.5 shrink-0" style={{ color: '#FDB82B' }} />
						<span className="min-w-0 flex-1 truncate pl-1 font-normal">
							workspace
						</span>
						<span className="ml-2 shrink-0 text-[11px] text-gray-400">{items.length + virtualFolders.length}</span>
					</button>

					{expandedFolders.has('root') ? <div className="space-y-0.5">{renderNodes(tree, 0)}</div> : null}
				</div>
			)}

			{contextMenu ? (
				<div
					className="fixed z-50 min-w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
					style={{ left: contextMenu.x, top: contextMenu.y }}
					onClick={(event) => event.stopPropagation()}
				>
					{contextMenu.type === 'file' ? (
						<>
							<Link
								href={`/fileapa/${contextMenu.item.id}`}
								onClick={() => setContextMenu(null)}
								className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-[#ffece5]"
							>
								<FiFile className="text-gray-500" />
								Open file
							</Link>
							<Link
								href={`/fileapa/${contextMenu.item.id}`}
								onClick={() => setContextMenu(null)}
								className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-[#ffece5]"
							>
								<FiMaximize2 className="text-gray-500" />
								View in page
							</Link>
							<button
								type="button"
								onClick={() => {
									onRename(contextMenu.item.id)
									setContextMenu(null)
								}}
								className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-[#ffece5]"
							>
								<FiEdit3 className="text-gray-500" />
								Rename
							</button>
							<button
								type="button"
								onClick={() => handleDownload(contextMenu.item)}
								className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-[#ffece5]"
							>
								<FiDownload className="text-gray-500" />
								Download
							</button>
							<button
								type="button"
								onClick={() => {
									onRemove(contextMenu.item.id)
									setContextMenu(null)
								}}
								className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
							>
								<FiTrash2 />
								Remove from workspace
							</button>
						</>
					) : (
						<>
							<button
								type="button"
								onClick={() => {
									onUploadToFolder(contextMenu.folderPath)
									setContextMenu(null)
								}}
								className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-[#ffece5]"
							>
								<FiUpload className="text-gray-500" />
								Upload File
							</button>
							<button
								type="button"
								onClick={() => {
									onCreateFolder(contextMenu.folderPath)
									setContextMenu(null)
								}}
								className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-[#ffece5]"
							>
								<FiPlus className="text-gray-500" />
								New Folder
							</button>
						</>
					)}
				</div>
			) : null}
		</aside>
	)
}
