"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TableInfo  { name: string; row_count: number; }
interface ColInfo    { name: string; data_type: string; }
interface RowsResp   { rows: Record<string, unknown>[]; total: number; page: number; page_size: number; }

// ── Helpers ────────────────────────────────────────────────────────────────────
const TYPE_MAP: Record<string, string> = {
  "character varying": "varchar", "timestamp without time zone": "timestamp",
  "timestamp with time zone": "timestamptz", "double precision": "float8",
  "integer": "int", "bigint": "bigint", "boolean": "bool",
  "text": "text", "numeric": "numeric", "jsonb": "jsonb", "json": "json",
};
const shortType = (t: string) => TYPE_MAP[t] ?? t.split("(")[0].slice(0, 10);
const fmt = (n: number) => Number(n).toLocaleString();

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function DbExplorerPage() {
  // Sidebar
  const [tables, setTables]           = useState<TableInfo[]>([]);
  const [sideSearch, setSideSearch]   = useState("");
  const [sideLoading, setSideLoading] = useState(true);
  const [sideError, setSideError]     = useState(false);

  // Selected table
  const [table, setTable]   = useState<string | null>(null);
  const [cols, setCols]     = useState<ColInfo[]>([]);

  // Grid
  const [rows, setRows]     = useState<Record<string, unknown>[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pgSz, setPgSz]     = useState(50);

  // Pending filter (controlled inputs, not yet applied)
  const [pFCol, setPFCol]   = useState("");
  const [pFVal, setPFVal]   = useState("");
  // Applied filter
  const [fCol, setFCol]     = useState("");
  const [fVal, setFVal]     = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Expanded cells: "rowIdx|colName"
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Scroll sync refs
  const topRef   = useRef<HTMLDivElement>(null);
  const bodyRef  = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const syncT    = useRef(false);
  const syncB    = useRef(false);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadSidebar(); }, []);

  // ── Scroll sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    const top = topRef.current;
    const body = bodyRef.current;
    if (!top || !body) return;

    const onTop = () => {
      if (syncB.current) return;
      syncT.current = true;
      body.scrollLeft = top.scrollLeft;
      syncT.current = false;
    };
    const onBody = () => {
      if (syncT.current) return;
      syncB.current = true;
      top.scrollLeft = body.scrollLeft;
      const inner = top.firstElementChild as HTMLElement | null;
      if (inner && tableRef.current) inner.style.width = tableRef.current.scrollWidth + "px";
      syncB.current = false;
    };

    top.addEventListener("scroll", onTop);
    body.addEventListener("scroll", onBody);
    return () => { top.removeEventListener("scroll", onTop); body.removeEventListener("scroll", onBody); };
  }, []);

  // Sync top scrollbar width after rows / cols change
  useEffect(() => {
    requestAnimationFrame(() => {
      const inner = topRef.current?.firstElementChild as HTMLElement | null;
      if (inner && tableRef.current) inner.style.width = tableRef.current.scrollWidth + "px";
    });
  }, [rows, cols]);

  // ── API ───────────────────────────────────────────────────────────────────
  async function loadSidebar() {
    setSideLoading(true); setSideError(false);
    try {
      const d = await fetch("/api/db/tables").then(r => r.json());
      setTables(d.tables ?? []);
    } catch { setSideError(true); }
    finally { setSideLoading(false); }
  }

  async function selectTable(name: string) {
    setTable(name); setPage(1);
    setPFCol(""); setPFVal(""); setFCol(""); setFVal("");
    setCols([]); setRows([]); setTotal(0); setError(null); setExpanded(new Set());

    try {
      const d = await fetch(`/api/db/tables/${encodeURIComponent(name)}/columns`).then(r => r.json());
      setCols(d.columns ?? []);
    } catch {}

    await fetchRows(name, 1, pgSz, "", "");
  }

  async function fetchRows(tbl: string, pg: number, sz: number, fc: string, fv: string) {
    setLoading(true); setError(null);
    const p = new URLSearchParams({ page: String(pg), page_size: String(sz) });
    if (fc && fv !== "") { p.set("filter_col", fc); p.set("filter_val", fv); }
    try {
      const res = await fetch(`/api/db/tables/${encodeURIComponent(tbl)}/rows?${p}`);
      if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error((e as { detail?: string }).detail ?? res.statusText);
      }
      const d: RowsResp = await res.json();
      setRows(d.rows ?? []); setTotal(d.total); setPage(d.page); setPgSz(d.page_size);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function applyFilter() {
    if (!table) return;
    setFCol(pFCol); setFVal(pFVal); setPage(1);
    fetchRows(table, 1, pgSz, pFCol, pFVal);
  }

  function clearFilter() {
    setPFCol(""); setPFVal(""); setFCol(""); setFVal(""); setPage(1);
    if (table) fetchRows(table, 1, pgSz, "", "");
  }

  function goPage(delta: number) {
    if (!table) return;
    const tot = Math.ceil(total / pgSz);
    const next = page + delta;
    if (next < 1 || next > tot) return;
    setPage(next);
    fetchRows(table, next, pgSz, fCol, fVal);
  }

  function changePageSize(val: string) {
    const sz = parseInt(val, 10);
    setPgSz(sz); setPage(1);
    if (table) fetchRows(table, 1, sz, fCol, fVal);
  }

  function toggleCell(key: string) {
    setExpanded(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const visibleTables = sideSearch
    ? tables.filter(t => t.name.includes(sideSearch.toLowerCase()))
    : tables;

  const totalPages = Math.max(1, Math.ceil(total / pgSz));
  const colNames   = cols.length ? cols.map(c => c.name) : (rows[0] ? Object.keys(rows[0]) : []);
  const typeMap: Record<string, string> = {};
  cols.forEach(c => { typeMap[c.name] = shortType(c.data_type); });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="px-4 h-14 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm select-none">
            M
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Database Explorer</h1>
            <p className="text-xs text-gray-400">musyadata · PostgreSQL</p>
          </div>
          <div className="ml-auto text-xs text-gray-500">
            {tables.length > 0 && <span>{tables.length} tables</span>}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>

        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-3 pt-3 pb-1">
            <input
              type="search" placeholder="Filter tables…"
              value={sideSearch} onChange={e => setSideSearch(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {sideLoading && <div className="text-xs text-gray-400 px-4 py-6 text-center">Loading…</div>}
            {sideError  && <div className="text-xs text-red-500 px-4 py-4">Failed to load tables</div>}
            {visibleTables.map(t => (
              <div
                key={t.name} onClick={() => selectTable(t.name)}
                className={`flex items-center justify-between px-3 py-2 rounded mx-1 mb-0.5 text-sm cursor-pointer transition-colors ${
                  table === t.name ? "bg-indigo-600 text-white" : "hover:bg-indigo-100"
                }`}
              >
                <span className="truncate font-mono text-xs font-medium">{t.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ml-1 flex-shrink-0 ${
                  table === t.name ? "bg-white/25 text-white" : "bg-indigo-100 text-indigo-700"
                }`}>{fmt(t.row_count)}</span>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-400 tabular-nums">
            {tables.length > 0 ? `${tables.length} tables` : ""}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">

          {/* Empty state */}
          {!table && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
              <svg className="w-14 h-14 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7h16M4 12h16M4 17h7" />
              </svg>
              <p className="text-sm">Select a table from the sidebar</p>
            </div>
          )}

          {/* Data panel */}
          {table && (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Toolbar */}
              <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800 font-mono">{table}</h2>
                {fCol && <span className="text-xs text-gray-400">filtered by {fCol} = &ldquo;{fVal}&rdquo;</span>}
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  <select
                    value={pFCol} onChange={e => setPFCol(e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    <option value="">— column —</option>
                    {cols.map(c => (
                      <option key={c.name} value={c.name}>{c.name} ({c.data_type})</option>
                    ))}
                  </select>
                  <input
                    type="text" placeholder="value…"
                    value={pFVal} onChange={e => setPFVal(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && applyFilter()}
                    className="text-xs border border-gray-200 rounded px-2 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <button onClick={applyFilter} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded font-medium">Apply</button>
                  <button onClick={clearFilter} className="text-xs bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1.5 rounded font-medium">Clear</button>
                </div>
              </div>

              {/* Schema bar */}
              {cols.length > 0 && (
                <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 overflow-x-auto">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs font-semibold text-indigo-400 mr-1 flex-shrink-0">Columns:</span>
                    {cols.map(c => (
                      <span key={c.name} title={c.data_type}
                        className="inline-block bg-gray-100 border border-gray-200 rounded px-1.5 py-px text-[11px] text-gray-600 font-mono whitespace-nowrap">
                        {c.name}<span className="text-gray-400"> {shortType(c.data_type)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top mirror scrollbar */}
              <div ref={topRef} className="overflow-x-auto overflow-y-hidden h-3 border-b border-gray-200 bg-gray-50">
                <div style={{ height: 1 }} />
              </div>

              {/* Table */}
              <div ref={bodyRef} className="flex-1 overflow-auto">
                {loading && (
                  <div className="px-6 py-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                    <Spinner size={20} /> Loading…
                  </div>
                )}
                {error && (
                  <div className="px-6 py-4 text-sm text-red-500 bg-red-50 border-b border-red-100">Error: {error}</div>
                )}
                {!loading && (
                  <table ref={tableRef} className="border-collapse text-xs" style={{ width: "max-content", minWidth: "100%" }}>
                    <thead>
                      {colNames.length > 0 && (
                        <tr>
                          {colNames.map(col => (
                            <th
                              key={col}
                              onClick={() => setPFCol(col)}
                              title={`Click to filter · type: ${typeMap[col] ?? ""}`}
                              className="bg-gray-100 sticky top-0 z-10 border-b-2 border-gray-200 px-2.5 py-1.5 text-left whitespace-nowrap cursor-pointer select-none hover:bg-indigo-100"
                              style={{ minWidth: 80 }}
                            >
                              {col}
                              <span className="block text-gray-400 font-normal text-[10px]">{typeMap[col] ?? ""}</span>
                            </th>
                          ))}
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={99} className="px-4 py-8 text-center text-gray-400">No rows found</td>
                        </tr>
                      )}
                      {rows.map((row, ri) => (
                        <tr key={ri} className="hover:bg-gray-50">
                          {colNames.map(col => {
                            const v = row[col];
                            const key = `${ri}|${col}`;
                            const isExpanded = expanded.has(key);

                            if (v === null || v === undefined) {
                              return (
                                <td key={col} className="border-b border-gray-100 px-2.5 py-1 align-top">
                                  <span className="text-gray-400 italic text-[11px]">NULL</span>
                                </td>
                              );
                            }
                            const s = String(v);
                            if (s === "[…vector…]") {
                              return (
                                <td key={col} className="border-b border-gray-100 px-2.5 py-1 align-top">
                                  <span className="text-purple-500 text-[10px]">[…vector…]</span>
                                </td>
                              );
                            }
                            const display = !isExpanded && s.length > 140 ? s.slice(0, 140) + "…" : s;
                            return (
                              <td
                                key={col} title={s}
                                onDoubleClick={() => toggleCell(key)}
                                className={`border-b border-gray-100 px-2.5 py-1 align-top max-w-[360px] overflow-hidden text-ellipsis ${
                                  isExpanded ? "whitespace-normal break-all" : "whitespace-nowrap"
                                }`}
                              >
                                {display}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-3 text-xs text-gray-600">
                <button onClick={() => goPage(-1)} disabled={page <= 1}
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                  ← Prev
                </button>
                <span className="tabular-nums">Page {page} of {totalPages}</span>
                <button onClick={() => goPage(1)} disabled={page >= totalPages}
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                  Next →
                </button>
                <span className="ml-auto text-gray-400 tabular-nums">
                  {total > 0
                    ? `Rows ${fmt((page - 1) * pgSz + 1)}–${fmt(Math.min(page * pgSz, total))} of ${fmt(total)}`
                    : "0 rows"}
                </span>
                <select value={pgSz} onChange={e => changePageSize(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={200}>200 / page</option>
                </select>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
