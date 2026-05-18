"use client"
import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { IoChevronBackCircleSharp, IoAddOutline, IoSearchOutline, IoChatbubblesOutline, IoPersonCircleOutline, IoTimeOutline, IoChevronDown, IoEllipsisHorizontal } from "react-icons/io5"
import { FiDatabase, FiFile, FiFolder } from "react-icons/fi"
import clsx from "clsx"

import { getAllFiles, type StoredFile } from "../fileapa/fileStorage"

const HISTORY_ITEMS = [
    'What is React?',
    'Next.js 14 features',
    'Tailwind UI example',
    'API Integration'
];

const MENU_ITEMS = [
    {
        label: 'New chat',
        href: '/',
        shortcut: '',
        icon: IoAddOutline,
        iconSize: 16,
        iconContainerClass: 'bg-[#eb6f45f1] text-white w-6 h-6 rounded-full flex items-center justify-center shrink-0',
        badge: '',
        badgeClass: 'ml-auto bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full text-[10px]'
    },
    {
        label: 'Search',
        shortcut: '',
        icon: IoSearchOutline,
        iconSize: 16,
        iconContainerClass: 'w-6 h-6 flex items-center justify-center shrink-0',
        badge: '',
        badgeClass: 'ml-auto bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full text-[10px]'
    },
    {
        label: 'Chats',
        shortcut: '',
        icon: IoChatbubblesOutline,
        iconSize: 16,
        iconContainerClass: 'w-6 h-6 flex items-center justify-center shrink-0',
        badge: '',
        badgeClass: 'ml-auto bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full text-[10px]'
    }
];

type SidebarProps = {
    showDatabaseExplorer?: boolean
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
    const [isExpanded, setIsExpanded] = useState(false);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
    const [isExplorerExpanded, setIsExplorerExpanded] = useState(true);
    const [searchQuery, setSearchQuery] = useState("")
    const [databaseItems, setDatabaseItems] = useState<StoredFile[]>([])
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set())
    const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState | null>(null)
    const explorerTree = useMemo(() => buildExplorerTree(databaseItems), [databaseItems])
    const trimmedSearchQuery = searchQuery.trim().toLowerCase()
    const filteredExplorerTree = useMemo(
        () => filterExplorerTree(explorerTree, trimmedSearchQuery),
        [explorerTree, trimmedSearchQuery],
    )
    const sidebarExpanded = isExpanded

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

    const handleToggleSidebar = () => {
        setIsExpanded((current) => !current)
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
            <div className={clsx("h-screen overflow-hidden bg-[#f7f4f3f1] p-3 rounded-lg border border-gray-100 transition-all duration-300 flex flex-col", sidebarExpanded ? "w-64" : "w-14")}>

                <div className="flex items-center justify-between mb-4">
                    {/* life icons + right buttons */}
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
                        {HISTORY_ITEMS.map((text, i) => (
                            <button key={i} className="text-xs text-gray-700 hover:bg-[#f79d7f] hover:shadow-2xl hover:shadow-[#f79d7f] hover:text-gray-900 w-full text-left px-2 py-1.5 rounded-lg truncate transition-colors">
                                {text}
                            </button>
                        ))}
                    </div>

                    {showDatabaseExplorer ? (
                        <div className="mt-5 border-t border-[#f0dfd8] pt-4">
                            <button
                                type="button"
                                onClick={() => setIsExplorerExpanded(!isExplorerExpanded)}
                                className="text-xs font-semibold text-gray-500 mb-2 px-2 flex items-center justify-between w-full hover:text-gray-700 transition-colors"
                            >
                                <div className="flex items-center gap-1.5">
                                    <FiDatabase size={13} className="text-[#eb6f45]" /> Explorer
                                </div>
                                <IoChevronDown size={14} className={clsx("transition-transform duration-300", !isExplorerExpanded && "-rotate-90")} />
                            </button>

                            <div className={clsx("transition-all duration-300", isExplorerExpanded ? "max-h-112 overflow-y-auto overscroll-contain pr-1 opacity-100" : "max-h-0 overflow-hidden opacity-0")}>
                                <div className="rounded-2xl border border-[#f2ddd5] bg-[#fffaf8] p-2">
                                    <div className="flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold text-[#6b4f45]">
                                        <FiFolder size={14} className="text-[#eb6f45]" />
                                        <span className="flex-1 truncate">workspace</span>
                                        <span className="text-[10px] text-[#b28878]">{databaseItems.length}</span>
                                    </div>

                                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#f2ddd5] bg-white px-2 py-2 text-xs text-gray-600 focus-within:border-[#eb6f45]">
                                        <IoSearchOutline size={14} className="text-[#eb6f45]" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(event) => setSearchQuery(event.target.value)}
                                            placeholder="ค้นหาไฟล์หรือโฟลเดอร์"
                                            className="w-full bg-transparent outline-none placeholder:text-gray-400"
                                        />
                                    </div>

                                    <div className="mt-1 space-y-0.5">
                                        {filteredExplorerTree.length ? (
                                            renderExplorerNodes(filteredExplorerTree)
                                        ) : (
                                            <div className="px-2 py-2 text-[11px] text-gray-500">
                                                {trimmedSearchQuery ? "ไม่พบไฟล์หรือโฟลเดอร์ที่ค้นหา" : "ยังไม่มีไฟล์ในฐานข้อมูล"}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* user */}
                <div className="mt-auto pt-3 border-t border-gray-200">
                    <button className="group relative flex items-center gap-3 px-0.1 py-0.1 hover:bg-[#ffece5] rounded-xl transition-colors w-full text-left">
                        <div className="bg-[#eb6f45f1] w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                            <IoPersonCircleOutline size={26} className="text-gray-200" />
                        </div>
                        <div className={clsx("flex flex-1 items-center justify-between text-sm font-semibold text-gray-800 whitespace-nowrap overflow-hidden transition-all duration-300", sidebarExpanded ? "opacity-100 w-auto" : "opacity-0 w-0")}>
                            <span>Joja User</span>
                            <div className="hover:bg-gray-200 p-1 rounded-md transition-colors cursor-pointer">
                                <IoEllipsisHorizontal size={18} className="text-gray-500" />
                            </div>
                        </div>
                        

                        {/* Tooltip for collapsed state */}
                        {!sidebarExpanded && (
                            <div className="absolute left-full ml-3 px-3 py-2 bg-[#2d2d2d] text-white text-xs font-semibold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-md flex items-center gap-2">
                                <div>
                                    Joja User
                                </div>
                                
                            </div>
                        )}
                        
                                
                    </button>
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
