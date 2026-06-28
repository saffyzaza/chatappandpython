"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { IoChevronBackCircleSharp, IoAddOutline, IoSearchOutline, IoChatbubblesOutline, IoPersonCircleOutline, IoTimeOutline, IoChevronDown, IoEllipsisHorizontal, IoLogOutOutline, IoPersonOutline, IoLibraryOutline } from "react-icons/io5"
import { FiDatabase, FiFile, FiFolder } from "react-icons/fi"
import clsx from "clsx"

import { getAllFiles, type StoredFile } from "../fileapa/fileStorage"
import { DatabaseExplorer } from "./DatabaseExplorer"
import { clearDraft } from "../chat/chatDraftStore"
import { clearAttachedFiles } from "../chat/attachedFilesStore"
import { createEmptyChatSessionState, generateChatSessionId, saveChatSessionState } from "../chat/chatSessionStore"
import { clearStreamingState } from "../chat/streamingStore"
import { clearThaijoReport, clearThaijoSearchState } from "../chat/thaijoStore"

type ChatHistoryItem = {
    sessionId: string
    title: string
    status: "idle" | "running" | "completed" | "failed"
    updatedAt: string
}

const MENU_ITEMS = [
    {
        key: 'journal-library',
        label: 'Journal Library',
        href: '/journal',
        shortcut: '',
        icon: IoLibraryOutline,
        iconSize: 16,
        iconContainerClass: 'w-6 h-6 flex items-center justify-center shrink-0',
        badge: '',
        badgeClass: 'ml-auto bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full text-[10px]'
    },
    {
        key: 'new-chat',
        label: 'New chat',
        href: '/chat',
        shortcut: '',
        icon: IoAddOutline,
        iconSize: 16,
        iconContainerClass: 'bg-[#eb6f45f1] text-white w-6 h-6 rounded-full flex items-center justify-center shrink-0',
        badge: '',
        badgeClass: 'ml-auto bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full text-[10px]'
    },
    {
        key: 'search',
        label: 'Search',
        shortcut: '',
        icon: IoSearchOutline,
        iconSize: 16,
        iconContainerClass: 'w-6 h-6 flex items-center justify-center shrink-0',
        badge: '',
        badgeClass: 'ml-auto bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full text-[10px]'
    },
    {
        key: 'chats',
        label: 'Chats',
        shortcut: '',
        icon: IoChatbubblesOutline,
        iconSize: 16,
        iconContainerClass: 'w-6 h-6 flex items-center justify-center shrink-0',
        badge: '',
        badgeClass: 'ml-auto bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full text-[10px]'
    },
];

type SidebarProps = {
    showDatabaseExplorer?: boolean
}

type AuthUser = {
    id: string
    name: string
    email: string
    role: string
}

type ExplorerNode = {
    id: string
    name: string
    path: string
    kind: "folder" | "file"
    children?: ExplorerNode[]
}

type ExplorerContextMenuState = {
    x: number
    y: number
    node: ExplorerNode
}

type UserMenuPosition = {
    left: number
    top: number
}

function buildExplorerTree(items: StoredFile[]): ExplorerNode[] {
    const root: ExplorerNode[] = []

    for (const item of items) {
        const segments = item.path.split('/').filter(Boolean)
        let currentLevel = root
        let currentPath = ''

        segments.forEach((segment, index) => {
            currentPath = currentPath ? `${currentPath}/${segment}` : segment
            const isFile = index === segments.length - 1

            let node = currentLevel.find((entry) => entry.path === currentPath)

            if (!node) {
                node = {
                    id: isFile ? item.id : currentPath,
                    name: segment,
                    path: currentPath,
                    kind: isFile ? "file" : "folder",
                    children: isFile ? undefined : [],
                }
                currentLevel.push(node)
            }

            if (!isFile) {
                currentLevel = node.children ?? []
                node.children = currentLevel
            }
        })
    }

    const sortNodes = (nodes: ExplorerNode[]) => {
        nodes.sort((left, right) => {
            if (left.kind !== right.kind) {
                return left.kind === "folder" ? -1 : 1
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

function collectNodePaths(node: ExplorerNode): string[] {
    if (!node.children?.length) {
        return [node.path]
    }

    return [node.path, ...node.children.flatMap(collectNodePaths)]
}

function countDescendants(node: ExplorerNode): number {
    if (!node.children?.length) {
        return 0
    }

    return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0)
}

function getFolderPaths(nodes: ExplorerNode[]): string[] {
    return nodes.flatMap((node) => {
        if (node.kind !== "folder") {
            return []
        }

        return [node.path, ...getFolderPaths(node.children ?? [])]
    })
}

function filterExplorerTree(nodes: ExplorerNode[], query: string): ExplorerNode[] {
    if (!query) {
        return nodes
    }

    return nodes.reduce<ExplorerNode[]>((filteredNodes, node) => {
        const matchesSelf = node.name.toLowerCase().includes(query)

        if (node.kind === "file") {
            if (matchesSelf) {
                filteredNodes.push(node)
            }

            return filteredNodes
        }

        const filteredChildren = filterExplorerTree(node.children ?? [], query)

        if (matchesSelf || filteredChildren.length > 0) {
            filteredNodes.push({
                ...node,
                children: filteredChildren,
            })
        }

        return filteredNodes
    }, [])
}

export const Sidebar = ({ showDatabaseExplorer = false }: SidebarProps) => {
    const router = useRouter()
    const pathname = usePathname()
    const [isExpanded, setIsExpanded] = useState(false);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
    const [isExplorerExpanded, setIsExplorerExpanded] = useState(true);
    const [searchQuery, setSearchQuery] = useState("")
    const [databaseItems, setDatabaseItems] = useState<StoredFile[]>([])
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set())
    const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState | null>(null)
    const [authUser, setAuthUser] = useState<AuthUser | null>(null)
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const [userMenuPosition, setUserMenuPosition] = useState<UserMenuPosition | null>(null)
    const [historyItems, setHistoryItems] = useState<ChatHistoryItem[]>([])
    const [isHistoryLoading, setIsHistoryLoading] = useState(false)
    const userMenuRef = useRef<HTMLDivElement>(null)
    const explorerTree = useMemo(() => buildExplorerTree(databaseItems), [databaseItems])
    const trimmedSearchQuery = searchQuery.trim().toLowerCase()
    const filteredExplorerTree = useMemo(
        () => filterExplorerTree(explorerTree, trimmedSearchQuery),
        [explorerTree, trimmedSearchQuery],
    )
    const sidebarExpanded = isExpanded

    const currentSessionId = pathname.match(/^\/chat\/sessions\/([^/]+)$/)?.[1] ?? null

    const formatHistoryTime = (iso: string) => {
        const date = new Date(iso)
        if (Number.isNaN(date.getTime())) {
            return ''
        }

        const now = new Date()
        const isSameDay =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()

        if (isSameDay) {
            return new Intl.DateTimeFormat('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
            }).format(date)
        }

        return new Intl.DateTimeFormat('th-TH', {
            day: '2-digit',
            month: '2-digit',
        }).format(date)
    }

    const loadHistory = async () => {
        setIsHistoryLoading(true)

        try {
            const response = await fetch('/api/chat/history')
            if (!response.ok) {
                setHistoryItems([])
                return
            }

            const payload = (await response.json()) as { sessions?: ChatHistoryItem[] }
            setHistoryItems(Array.isArray(payload.sessions) ? payload.sessions : [])
        } catch {
            setHistoryItems([])
        } finally {
            setIsHistoryLoading(false)
        }
    }

    useEffect(() => {
        if (!showDatabaseExplorer) {
            const resetContextMenu = window.setTimeout(() => {
                setContextMenu(null)
            }, 0)

            return () => {
                window.clearTimeout(resetContextMenu)
            }
        }

        const expandSidebar = window.setTimeout(() => {
            setIsExpanded(true)
            setIsExplorerExpanded(true)
        }, 0)

        const loadFiles = async () => {
            try {
                const items = await getAllFiles()
                setDatabaseItems(items)
                setExpandedFolders(new Set(getFolderPaths(buildExplorerTree(items))))
            } catch (error) {
                console.error("Error loading database explorer:", error)
                setDatabaseItems([])
            }
        }

        void loadFiles()

        return () => {
            window.clearTimeout(expandSidebar)
        }
    }, [showDatabaseExplorer])

    useEffect(() => {
        if (!contextMenu) {
            return
        }

        const closeMenu = () => {
            setContextMenu(null)
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setContextMenu(null)
            }
        }

        window.addEventListener("mousedown", closeMenu)
        window.addEventListener("keydown", handleEscape)

        return () => {
            window.removeEventListener("mousedown", closeMenu)
            window.removeEventListener("keydown", handleEscape)
        }
    }, [contextMenu])

    useEffect(() => {
        fetch('/api/auth/me')
            .then((r) => r.json())
            .then((d) => { if (d.user) setAuthUser(d.user) })
            .catch(() => {})
    }, [])

    useEffect(() => {
        void loadHistory()

        const handleHistoryUpdated = () => {
            void loadHistory()
        }

        window.addEventListener('chat-history-updated', handleHistoryUpdated)
        return () => window.removeEventListener('chat-history-updated', handleHistoryUpdated)
    }, [])

    useEffect(() => {
        if (!currentSessionId) {
            return
        }

        void loadHistory()
    }, [currentSessionId])

    useEffect(() => {
        if (!userMenuOpen) return
        const close = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setUserMenuOpen(false)
            }
        }
        window.addEventListener('mousedown', close)
        return () => window.removeEventListener('mousedown', close)
    }, [userMenuOpen])

    useEffect(() => {
        if (!userMenuOpen) {
            setUserMenuPosition(null)
            return
        }

        const updatePosition = () => {
            if (!userMenuRef.current) {
                return
            }

            const rect = userMenuRef.current.getBoundingClientRect()
            const menuWidth = 208
            const viewportPadding = 8
            const desiredLeft = sidebarExpanded ? rect.left : rect.right + 8
            const clampedLeft = Math.min(
                Math.max(desiredLeft, viewportPadding),
                window.innerWidth - menuWidth - viewportPadding,
            )

            setUserMenuPosition({
                left: clampedLeft,
                top: rect.top - 8,
            })
        }

        updatePosition()
        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)

        return () => {
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
        }
    }, [userMenuOpen, sidebarExpanded])

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
        router.refresh()
    }

    const handleToggleSidebar = () => {
        setIsExpanded((current) => !current)
    }

    const handleStartNewChat = () => {
        const currentSessionId = pathname.match(/^\/chat\/sessions\/([^/]+)$/)?.[1]

        if (currentSessionId) {
            clearStreamingState(currentSessionId)
        }

        clearDraft()
        clearAttachedFiles()
        clearThaijoReport()
        clearThaijoSearchState()

        const nextSessionId = generateChatSessionId()
        saveChatSessionState(nextSessionId, createEmptyChatSessionState(nextSessionId))
        window.dispatchEvent(new CustomEvent("chat-new-session", { detail: { sessionId: nextSessionId } }))

        router.push(`/chat/sessions/${nextSessionId}`)
    }

    const toggleExplorerFolder = (path: string) => {
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

    const toggleCheckedPath = (node: ExplorerNode) => {
        const relatedPaths = collectNodePaths(node)

        setCheckedPaths((current) => {
            const next = new Set(current)
            const shouldSelect = !relatedPaths.every((path) => next.has(path))

            relatedPaths.forEach((path) => {
                if (shouldSelect) {
                    next.add(path)
                } else {
                    next.delete(path)
                }
            })

            return next
        })
    }

    const handleViewFile = (node: ExplorerNode) => {
        if (node.kind !== "file") {
            return
        }

        setContextMenu(null)
        router.push(`/fileapa/${node.id}`)
    }

    const renderExplorerNodes = (nodes: ExplorerNode[], depth = 0): React.ReactNode => {
        return nodes.map((node) => {
            const isFolder = node.kind === "folder"
            const isOpen = isFolder && (trimmedSearchQuery.length > 0 || expandedFolders.has(node.path))
            const descendantCount = isFolder ? countDescendants(node) : 0

            return (
                <div key={node.path} className="select-none">
                    <div
                        onContextMenu={(event) => {
                            if (node.kind !== "file") {
                                return
                            }

                            event.preventDefault()
                            setContextMenu({
                                x: event.clientX,
                                y: event.clientY,
                                node,
                            })
                        }}
                        className="group flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs text-gray-700 transition-colors hover:bg-[#fff1eb]"
                        style={{ paddingLeft: `${depth * 14 + 8}px` }}
                    >
                        <input
                            type="checkbox"
                            checked={checkedPaths.has(node.path)}
                            onChange={() => toggleCheckedPath(node)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-[#eb6f45] focus:ring-[#eb6f45]"
                        />
                        {isFolder ? (
                            <button
                                type="button"
                                onClick={() => toggleExplorerFolder(node.path)}
                                className="flex items-center gap-1 text-gray-500 hover:text-[#eb6f45]"
                            >
                                <IoChevronDown size={12} className={clsx("transition-transform", !isOpen && "-rotate-90")} />
                                <FiFolder size={13} className="text-[#eb6f45]" />
                            </button>
                        ) : (
                            <span className="flex items-center gap-1 pl-4.5 text-gray-500">
                                <FiFile size={13} className="text-[#eb6f45]" />
                            </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-left">{node.name}</span>
                        {isFolder ? (
                            <span className="shrink-0 text-[10px] text-gray-400">{descendantCount}</span>
                        ) : null}
                    </div>

                    {isFolder && isOpen && node.children?.length ? renderExplorerNodes(node.children, depth + 1) : null}
                </div>
            )
        })
    }

    return (
        <>
            <div className={clsx("relative z-30 h-screen overflow-hidden bg-[#f7f4f3f1] p-3 rounded-lg border border-gray-100 transition-all duration-300 flex flex-col", sidebarExpanded ? "w-64" : "w-14")}>
                {/* ⚠️ relative + z-30: ทำให้ sidebar มี stacking context ของตัวเอง และอยู่
                    "เหนือ" เนื้อหาหลัก/องค์ประกอบทั่วไปที่ไม่ได้ตั้ง z-index (รวมถึง
                    z-10/z-20 ที่บางหน้าใช้กับปุ่ม/ตัว resizer ภายในพื้นที่เนื้อหา)
                    เดิม div นี้ไม่มี position/z-index เลย จึงอาจถูกองค์ประกอบอื่นที่ตั้ง
                    z-index ไว้ (แม้ค่าน้อย) render ทับบางส่วนจนดูเหมือนถูกบีบ/ซ้อนกัน —
                    z-30 ยังต่ำกว่า dropdown/tooltip ภายใน sidebar เอง (z-50, 9999) และ
                    modal ทั่วทั้งแอป (z-40/z-50) จึงไม่ดันสิ่งเหล่านั้นให้ลอยต่ำกว่า sidebar */}

                <div className="flex items-center justify-between mb-4">
                    <Image
                        src="/Thai_Health.png"
                        alt="Thai Health Logo"
                        width={32}
                        height={32}
                        className="transition-all duration-300 overflow-hidden"
                        style={{
                            width: sidebarExpanded ? 32 : 0,
                            height: sidebarExpanded ? 32 : 0,
                            opacity: sidebarExpanded ? 1 : 0,
                        }}
                    />
                    <button onClick={handleToggleSidebar} className={clsx("transition-transform duration-300", !sidebarExpanded && "rotate-180 mx-auto")}>
                        <IoChevronBackCircleSharp size={28} className="text-[#eb6f45f1] hover:text-[#fc632c] hover:scale-110 transition-transform duration-300" />
                    </button>
                </div>
                
                <div className="flex flex-col mt-2 space-y-1 text-gray-800">
                    {MENU_ITEMS.map((item, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => {
                                if (item.key === 'new-chat') {
                                    handleStartNewChat()
                                    return
                                }

                                if (item.href) {
                                    router.push(item.href)
                                }
                            }}
                            className="group relative flex items-center gap-2 px-1 py-1 hover:bg-[#f79d7f] rounded-lg transition-colors w-full text-left"
                        >
                            <div className={item.iconContainerClass}>
                                <item.icon size={item.iconSize} className="" />
                            </div>

                            <span className={clsx("text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-300", sidebarExpanded ? "opacity-100 w-auto" : "opacity-0 w-0")}>
                                {item.label}
                            </span>

                            {item.badge && sidebarExpanded && (
                                <div className={item.badgeClass}>
                                    {item.badge}
                                </div>
                            )}

                            {/* Tooltip for collapsed state */}
                            {!sidebarExpanded && (
                                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2d2d2d] text-white text-[11px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-sm flex items-center gap-2">
                                    {item.label}
                                    {item.shortcut && <span className="text-gray-400 font-mono text-[10px] tracking-widest">{item.shortcut}</span>}
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* history + hidehistory */}
                <div className={clsx("mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 transition-all duration-300", sidebarExpanded ? "opacity-100" : "opacity-0 hidden")}>
                    <button
                        onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                        className="text-xs font-semibold text-gray-500 mb-2 px-2 flex items-center justify-between w-full hover:text-gray-700 transition-colors"
                    >
                        <div className="flex items-center gap-1">
                            <IoTimeOutline size={14} /> Recent
                        </div>
                        <IoChevronDown size={14} className={clsx("transition-transform duration-300", !isHistoryExpanded && "-rotate-90")} />
                    </button>

                    <div className={clsx("space-y-1 transition-all duration-300 overflow-hidden", isHistoryExpanded ? "max-h-64 opacity-100" : "max-h-0 opacity-0")}>
                        {isHistoryLoading ? (
                            <p className="px-2 py-1.5 text-[11px] text-gray-400">กำลังโหลดประวัติ...</p>
                        ) : historyItems.length === 0 ? (
                            <p className="px-2 py-1.5 text-[11px] text-gray-400">ยังไม่มีประวัติการสนทนา</p>
                        ) : (
                            historyItems.map((item) => {
                                const isActive = currentSessionId === item.sessionId

                                return (
                                    <button
                                        key={item.sessionId}
                                        type="button"
                                        onClick={() => router.push(`/chat/sessions/${item.sessionId}`)}
                                        className={clsx(
                                            "w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                                            isActive
                                                ? "bg-[#ffe4d8] text-[#9f3d1d]"
                                                : "text-gray-700 hover:bg-[#f79d7f] hover:text-gray-900",
                                        )}
                                        title={item.title}
                                    >
                                        <div className="truncate">{item.title}</div>
                                        <div className="mt-0.5 flex items-center justify-between text-[10px] text-gray-400">
                                            <span>{item.status}</span>
                                            <span>{formatHistoryTime(item.updatedAt)}</span>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>

                    {showDatabaseExplorer ? (
                        <div className="mt-5 border-t border-[#f0dfd8] pt-3 flex-1 min-h-0">
                            <DatabaseExplorer />
                        </div>
                    ) : null}
                </div>

                {/* user */}
                <div className="mt-auto pt-3 border-t border-gray-200 relative" ref={userMenuRef}>
                    <button
                        onClick={() => setUserMenuOpen((v) => !v)}
                        className="group relative flex items-center gap-3 px-0.5 py-0.5 hover:bg-[#ffece5] rounded-xl transition-colors w-full text-left"
                    >
                        <div className="bg-[#eb6f45f1] w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-sm font-bold uppercase">
                            {authUser ? authUser.name.charAt(0) : <IoPersonCircleOutline size={22} className="text-gray-200" />}
                        </div>
                        <div className={clsx("flex flex-1 items-center justify-between whitespace-nowrap overflow-hidden transition-all duration-300", sidebarExpanded ? "opacity-100 w-auto" : "opacity-0 w-0")}>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold text-gray-800 truncate">{authUser?.name ?? '...'}</span>
                                <span className="text-[10px] text-gray-400 truncate">{authUser?.email ?? ''}</span>
                            </div>
                            <div className="hover:bg-gray-200 p-1 rounded-md transition-colors ml-1">
                                <IoEllipsisHorizontal size={18} className="text-gray-500" />
                            </div>
                        </div>

                        {/* Tooltip for collapsed state */}
                        {!sidebarExpanded && (
                            <div className="absolute left-full ml-3 px-3 py-2 bg-[#2d2d2d] text-white text-xs font-semibold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-md">
                                {authUser?.name ?? 'ผู้ใช้งาน'}
                            </div>
                        )}
                    </button>

                    {/* User dropdown menu */}
                    {userMenuOpen && userMenuPosition && (
                        <div
                            className="fixed w-52 rounded-xl border border-[#f2ddd5] bg-white p-1.5 shadow-lg"
                            style={{
                                left: userMenuPosition.left,
                                top: userMenuPosition.top,
                                transform: 'translateY(-100%)',
                                zIndex: 9999,
                            }}
                        >
                            <div className="px-3 py-2 border-b border-gray-100 mb-1">
                                <p className="text-xs font-semibold text-gray-800 truncate">{authUser?.name}</p>
                                <p className="text-[10px] text-gray-400 truncate">{authUser?.email}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setUserMenuOpen(false); router.push('/account') }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-[#fff1eb] hover:text-[#eb6f45]"
                            >
                                <IoPersonOutline size={14} className="text-[#eb6f45]" />
                                <span>บัญชีของฉัน</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                            >
                                <IoLogOutOutline size={14} />
                                <span>ออกจากระบบ</span>
                            </button>
                        </div>
                    )}
                </div>

                {contextMenu ? (
                    <div
                        onMouseDown={(event) => event.stopPropagation()}
                        className="fixed z-50 min-w-32 rounded-xl border border-[#f2ddd5] bg-white p-1.5 shadow-lg"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        <button
                            type="button"
                            onClick={() => handleViewFile(contextMenu.node)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-[#fff1eb] hover:text-[#eb6f45]"
                        >
                            <FiFile size={13} className="text-[#eb6f45]" />
                            <span>View</span>
                        </button>
                    </div>
                ) : null}

            </div>
        </>
    )
}
