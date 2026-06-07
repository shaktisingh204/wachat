'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronRight, Download, RefreshCw, Inbox } from 'lucide-react';
import type { FlowSession } from '@/app/actions/sabflow-results.types';
import {
  Button,
  Badge,
  type BadgeTone,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Pagination,
  DatePicker,
  Tag,
  type DateRange,
} from '@/components/sabcrm/20ui';

/* helpers */

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function truncateId(id: string, len = 12) {
  return id.length > len ? `${id.slice(0, len)}...` : id;
}

function statusLabel(session: FlowSession): 'completed' | 'active' | 'abandoned' {
  if (session.isCompleted) return 'completed';
  const updatedMs = new Date(session.updatedAt).getTime();
  const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
  return updatedMs > thirtyMinAgo ? 'active' : 'abandoned';
}

const STATUS_TONE: Record<string, BadgeTone> = {
  completed: 'success',
  active: 'info',
  abandoned: 'neutral',
};

/** Convert a Date to a local YYYY-MM-DD string for day-level comparison. */
function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function exportToCsv(sessions: FlowSession[]) {
  const header = ['Session ID', 'Started At', 'Status', 'Messages', 'Last Message', 'Updated At'];
  const rows = sessions.map((s) => [
    s.sessionId,
    s.createdAt,
    statusLabel(s),
    String(s.messageCount ?? 0),
    s.lastMessage ?? '',
    s.updatedAt,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sabflow-results.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* Variable chat history row */

function ExpandedRow({ session }: { session: FlowSession }) {
  const entries = Object.entries(session.variables).filter(([, v]) => v !== '');

  return (
    <Tr>
      <Td colSpan={5} className="bg-[var(--st-bg-secondary)]">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-[var(--st-text)] uppercase tracking-wide mb-2">
            Collected variables
          </p>
          {entries.length === 0 ? (
            <p className="text-sm text-[var(--st-text-secondary)] italic">No variables collected.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entries.map(([key, val]) => (
                <Tag key={key}>
                  <span className="font-mono text-xs text-[var(--st-text)]">{key}</span>
                  <span className="text-[var(--st-text-secondary)]"> = </span>
                  <span className="text-[var(--st-text)] max-w-[200px] truncate">{val}</span>
                </Tag>
              ))}
            </div>
          )}
          <div className="mt-3 text-xs text-[var(--st-text-secondary)] space-y-0.5">
            <div>
              Session ID: <span className="font-mono">{session.sessionId}</span>
            </div>
            <div>Last updated: {fmtDate(session.updatedAt)}</div>
          </div>
        </div>
      </Td>
    </Tr>
  );
}

/* ResultsTable */

type Props = {
  sessions: FlowSession[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  isLoading: boolean;
};

export function ResultsTable({
  sessions,
  total,
  page,
  pageSize,
  onPageChange,
  onRefresh,
  isLoading,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fromKey = dateRange?.from ? toDayKey(dateRange.from) : '';
  const toKey = dateRange?.to ? toDayKey(dateRange.to) : '';

  const filtered =
    fromKey || toKey
      ? sessions.filter((s) => {
          const d = s.createdAt.slice(0, 10);
          if (fromKey && d < fromKey) return false;
          if (toKey && d > toKey) return false;
          return true;
        })
      : sessions;

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <DatePicker
          mode="range"
          value={dateRange}
          onChange={setDateRange}
          placeholder="Filter by date range"
          aria-label="Filter sessions by date range"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            iconLeft={RefreshCw}
            loading={isLoading}
            onClick={() => startTransition(onRefresh)}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Download}
            disabled={filtered.length === 0}
            onClick={() => exportToCsv(filtered)}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] overflow-hidden">
        <Table hover>
          <THead>
            <Tr>
              <Th width={32} aria-label="Expand row" />
              <Th>Session ID</Th>
              <Th>Started</Th>
              <Th>Status</Th>
              <Th>Messages</Th>
            </Tr>
          </THead>
          <TBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Tr key={i} className="animate-pulse">
                  <Td>
                    <div className="h-4 w-4 rounded bg-[var(--st-bg-secondary)]" />
                  </Td>
                  <Td>
                    <div className="h-4 w-28 rounded bg-[var(--st-bg-secondary)]" />
                  </Td>
                  <Td>
                    <div className="h-4 w-32 rounded bg-[var(--st-bg-secondary)]" />
                  </Td>
                  <Td>
                    <div className="h-4 w-20 rounded bg-[var(--st-bg-secondary)]" />
                  </Td>
                  <Td>
                    <div className="h-4 w-8 rounded bg-[var(--st-bg-secondary)]" />
                  </Td>
                </Tr>
              ))
            ) : filtered.length === 0 ? (
              <Tr>
                <Td colSpan={5}>
                  <EmptyState
                    icon={Inbox}
                    title="No sessions found"
                    description="Sessions matching your filters will appear here."
                  />
                </Td>
              </Tr>
            ) : (
              filtered.flatMap((session) => {
                const status = statusLabel(session);
                const isExpanded = expandedId === session.sessionId;
                return [
                  <Tr
                    key={session.sessionId}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleRow(session.sessionId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleRow(session.sessionId);
                      }
                    }}
                  >
                    <Td className="text-[var(--st-text-secondary)]">
                      {isExpanded ? (
                        <ChevronDown size={16} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={16} aria-hidden="true" />
                      )}
                    </Td>
                    <Td className="font-mono text-[var(--st-text)]">
                      {truncateId(session.sessionId)}
                    </Td>
                    <Td className="text-[var(--st-text)]">{fmtDate(session.createdAt)}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[status]} className="capitalize">
                        {status}
                      </Badge>
                    </Td>
                    <Td className="text-[var(--st-text)]">{session.messageCount ?? 0}</Td>
                  </Tr>,
                  ...(isExpanded
                    ? [<ExpandedRow key={`${session.sessionId}-exp`} session={session} />]
                    : []),
                ];
              })
            )}
          </TBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--st-text-secondary)]">
            {total} session{total !== 1 ? 's' : ''} total
          </span>
          <Pagination page={page} pageCount={totalPages} onPageChange={onPageChange} size="compact" />
        </div>
      )}
    </div>
  );
}
