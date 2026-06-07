'use client';

/**
 * JsonTableView - renders an array-of-objects as a paginated table.
 *
 *   - Dynamic columns: the union of all object keys (insertion order).
 *   - 50 rows per page.
 *   - Click a row to expand an inline JSON detail beneath it.
 *   - Falls back to a message when `data` is not an array of objects.
 *
 * Scalars inside cells are pretty-printed with type-aware colour.
 */

import { Fragment, memo, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TableProperties } from 'lucide-react';
import {
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  IconButton,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { JsonTreeView } from './JsonTreeView';

const PAGE_SIZE = 50;

interface Props {
  data: unknown;
}

type Row = Record<string, unknown>;

/* -- Helpers ------------------------------------------------------------- */

function isObjectRow(v: unknown): v is Row {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function formatCell(v: unknown): { text: string; cls: string } {
  if (v === null) return { text: 'null', cls: 'text-[var(--st-text-tertiary)] italic' };
  if (v === undefined) return { text: '-', cls: 'text-[var(--st-text-tertiary)]' };
  if (typeof v === 'string') {
    return {
      text: v.length > 120 ? `${v.slice(0, 117)}...` : v,
      cls: 'text-[var(--st-text)]',
    };
  }
  if (typeof v === 'number') {
    return { text: String(v), cls: 'text-[var(--st-text)]' };
  }
  if (typeof v === 'boolean') {
    return { text: String(v), cls: 'text-[var(--st-text)]' };
  }
  if (Array.isArray(v)) {
    return { text: `Array(${v.length})`, cls: 'text-[var(--st-text-secondary)] italic' };
  }
  if (typeof v === 'object') {
    return { text: '{...}', cls: 'text-[var(--st-text-secondary)] italic' };
  }
  return { text: String(v), cls: '' };
}

/* -- Component ----------------------------------------------------------- */

function JsonTableViewImpl({ data }: Props) {
  const [page, setPage] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  /* -- Validate shape -------------------------------------------------- */
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

  /* -- Unsupported shape ----------------------------------------------- */
  if (rows === null) {
    return (
      <EmptyState
        size="sm"
        icon={TableProperties}
        title="Table view unavailable"
        description="Table view requires an array of objects."
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={TableProperties}
        title="Empty array"
        description="There are no rows to show."
      />
    );
  }

  /* -- Render ---------------------------------------------------------- */
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
        <Table density="compact" hover className="font-mono text-[12px]">
          <THead>
            <Tr>
              <Th className="w-10">#</Th>
              {columns.map((c) => (
                <Th key={c} className="whitespace-nowrap">
                  {c}
                </Th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {pageRows.map((row, idx) => {
              const absoluteIdx = clampedPage * PAGE_SIZE + idx;
              const isExpanded = expandedIndex === absoluteIdx;
              return (
                <Fragment key={absoluteIdx}>
                  <Tr
                    selected={isExpanded}
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedIndex((cur) =>
                        cur === absoluteIdx ? null : absoluteIdx,
                      )
                    }
                  >
                    <Td className="tabular-nums text-[var(--st-text-tertiary)]">
                      {absoluteIdx}
                    </Td>
                    {columns.map((c) => {
                      const cell = formatCell(row[c]);
                      return (
                        <Td key={c} className={`whitespace-nowrap ${cell.cls}`}>
                          {cell.text}
                        </Td>
                      );
                    })}
                  </Tr>
                  {isExpanded && (
                    <Tr>
                      <Td colSpan={columns.length + 1}>
                        <JsonTreeView data={row} rootLabel={`$[${absoluteIdx}]`} />
                      </Td>
                    </Tr>
                  )}
                </Fragment>
              );
            })}
          </TBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[11.5px] text-[var(--st-text-secondary)]">
          <span>
            {clampedPage * PAGE_SIZE + 1}-
            {Math.min(rows.length, (clampedPage + 1) * PAGE_SIZE)} of{' '}
            {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <IconButton
              label="Previous page"
              icon={ChevronLeft}
              size="sm"
              variant="outline"
              disabled={clampedPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            />
            <span className="px-1 tabular-nums">
              {clampedPage + 1}/{totalPages}
            </span>
            <IconButton
              label="Next page"
              icon={ChevronRight}
              size="sm"
              variant="outline"
              disabled={clampedPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const JsonTableView = memo(JsonTableViewImpl);
