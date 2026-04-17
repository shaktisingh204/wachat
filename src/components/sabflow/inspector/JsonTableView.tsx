'use client';

/**
 * JsonTableView — renders an array-of-objects as a paginated table.
 *
 *   • Dynamic columns — the union of all object keys (insertion order).
 *   • 50 rows per page.
 *   • Click a row → inline JSON detail expands beneath it.
 *   • Falls back to a message when `data` is not an array of objects.
 *
 * Scalars inside cells are pretty-printed with type-aware colour.
 */

import { Fragment, memo, useMemo, useState } from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { JsonTreeView } from './JsonTreeView';

const PAGE_SIZE = 50;

interface Props {
  data: unknown;
}

type Row = Record<string, unknown>;

/* ── Helpers ─────────────────────────────────────────────────────── */

function isObjectRow(v: unknown): v is Row {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function formatCell(v: unknown): { text: string; cls: string } {
  if (v === null) return { text: 'null', cls: 'text-[var(--gray-8)] italic' };
  if (v === undefined) return { text: '—', cls: 'text-[var(--gray-7)]' };
  if (typeof v === 'string') {
    return {
      text: v.length > 120 ? `${v.slice(0, 117)}…` : v,
      cls: 'text-emerald-600 dark:text-emerald-400',
    };
  }
  if (typeof v === 'number') {
    return { text: String(v), cls: 'text-sky-600 dark:text-sky-400' };
  }
  if (typeof v === 'boolean') {
    return { text: String(v), cls: 'text-[#f76808]' };
  }
  if (Array.isArray(v)) {
    return { text: `Array(${v.length})`, cls: 'text-[var(--gray-9)] italic' };
  }
  if (typeof v === 'object') {
    return { text: '{…}', cls: 'text-[var(--gray-9)] italic' };
  }
  return { text: String(v), cls: '' };
}

/* ── Component ───────────────────────────────────────────────────── */

function JsonTableViewImpl({ data }: Props) {
  const [page, setPage] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  /* ── Validate shape ─────────────────────────────────────────── */
  const rows = useMemo<Row[] | null>(() => {
    if (!Array.isArray(data)) return null;
    if (data.length === 0) return [];
    if (!data.every(isObjectRow)) return null;
    return data as Row[];
  }, [data]);

  const columns = useMemo<string[]>(() => {
    if (!rows || rows.length === 0) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of rows) {
      for (const k of Object.keys(row)) {
        if (!seen.has(k)) {
          seen.add(k);
          out.push(k);
        }
      }
    }
    return out;
  }, [rows]);

  const totalPages = rows ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) : 1;
  const clampedPage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(() => {
    if (!rows) return [];
    const start = clampedPage * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, clampedPage]);

  /* ── Unsupported shape ──────────────────────────────────────── */
  if (rows === null) {
    return (
      <div className="rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 text-[12px] text-[var(--gray-10)]">
        Table view requires an array of objects.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 text-[12px] italic text-[var(--gray-9)]">
        Empty array.
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-auto rounded-md border border-[var(--gray-5)]">
        <table className="w-full text-[12px] font-mono">
          <thead className="bg-[var(--gray-3)]">
            <tr>
              <th className="w-10 px-2 py-1.5 text-left font-medium text-[var(--gray-10)]">
                #
              </th>
              {columns.map((c) => (
                <th
                  key={c}
                  className="px-2 py-1.5 text-left font-medium text-[var(--gray-11)] whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, idx) => {
              const absoluteIdx = clampedPage * PAGE_SIZE + idx;
              const isExpanded = expandedIndex === absoluteIdx;
              return (
                <Fragment key={absoluteIdx}>
                  <tr
                    onClick={() =>
                      setExpandedIndex((cur) =>
                        cur === absoluteIdx ? null : absoluteIdx,
                      )
                    }
                    className={`cursor-pointer border-t border-[var(--gray-4)] hover:bg-[var(--gray-3)] ${
                      isExpanded ? 'bg-[var(--gray-3)]' : ''
                    }`}
                  >
                    <td className="px-2 py-1 text-[var(--gray-9)] tabular-nums">
                      {absoluteIdx}
                    </td>
                    {columns.map((c) => {
                      const cell = formatCell(row[c]);
                      return (
                        <td
                          key={c}
                          className={`px-2 py-1 whitespace-nowrap ${cell.cls}`}
                        >
                          {cell.text}
                        </td>
                      );
                    })}
                  </tr>
                  {isExpanded && (
                    <tr className="bg-[var(--gray-2)]">
                      <td
                        colSpan={columns.length + 1}
                        className="px-3 py-2 border-t border-[var(--gray-4)]"
                      >
                        <JsonTreeView data={row} rootLabel={`$[${absoluteIdx}]`} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[11.5px] text-[var(--gray-10)]">
          <span>
            {clampedPage * PAGE_SIZE + 1}–
            {Math.min(rows.length, (clampedPage + 1) * PAGE_SIZE)} of{' '}
            {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={clampedPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="flex h-6 w-6 items-center justify-center rounded border border-[var(--gray-5)] text-[var(--gray-11)] disabled:opacity-40 hover:bg-[var(--gray-3)]"
              aria-label="Previous page"
            >
              <LuChevronLeft className="h-3 w-3" strokeWidth={2} />
            </button>
            <span className="tabular-nums px-1">
              {clampedPage + 1}/{totalPages}
            </span>
            <button
              type="button"
              disabled={clampedPage >= totalPages - 1}
              onClick={() =>
                setPage((p) => Math.min(totalPages - 1, p + 1))
              }
              className="flex h-6 w-6 items-center justify-center rounded border border-[var(--gray-5)] text-[var(--gray-11)] disabled:opacity-40 hover:bg-[var(--gray-3)]"
              aria-label="Next page"
            >
              <LuChevronRight className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const JsonTableView = memo(JsonTableViewImpl);
