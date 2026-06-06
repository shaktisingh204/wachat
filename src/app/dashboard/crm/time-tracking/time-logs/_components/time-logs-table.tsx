'use client';

import { Badge, Button, Checkbox, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import {
  Check,
  Square,
  Trash2,
  X } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
  wsFormatDuration,
  type WsProjectTimeLog,
} from '@/lib/worksuite/time-types';
import { format, parseISO } from 'date-fns';

function fmt(value: unknown): string {
  if (!value) return '—';
  try {
    const date = typeof value === 'string' ? parseISO(value) : new Date(value as any);
    if (Number.isNaN(date.getTime())) return '—';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${minutes} UTC`;
  } catch {
    return '—';
  }
}

function badge(log: WsProjectTimeLog): { label: string; variant: string } {
  if (log.status === 'approved' || log.approved) {
    return { label: 'Approved', variant: 'success' };
  }
  if (log.status === 'rejected') return { label: 'Rejected', variant: 'danger' };
  if (!log.end_time) return { label: 'Running', variant: 'warning' };
  return { label: 'Pending', variant: 'ghost' };
}

function LiveElapsed({ start }: { start: string | Date }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);
  return <span>{wsFormatDuration(start, new Date())}</span>;
}

interface TimeLogsTableProps {
  rows: WsProjectTimeLog[];
  busy: boolean;
  onStop: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (log: WsProjectTimeLog) => void;
  onDelete: (id: string) => void;
  /** Optional selection state passed from the parent page for bulk operations. */
  selected?: Set<string>;
  onToggleRow?: (id: string) => void;
}

export function TimeLogsTable({
  rows,
  busy,
  onStop,
  onApprove,
  onReject,
  onDelete,
  selected,
  onToggleRow,
}: TimeLogsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--st-border)] p-6 text-center text-[13px] text-[var(--st-text-secondary)]">
        No time logs match the current filters.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
      <Table>
        <THead>
          <Tr className="border-[var(--st-border)] hover:bg-transparent">
            {selected !== undefined ? <Th className="w-10" /> : null}
            <Th>Memo</Th>
            <Th>Employee</Th>
            <Th>Project</Th>
            <Th>Task</Th>
            <Th>Date</Th>
            <Th className="text-right">Hours</Th>
            <Th>Billable</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((log) => {
            const s = badge(log);
            return (
              <Tr
                key={log._id}
                className="border-[var(--st-border)] transition-colors"
              >
                {selected !== undefined && log._id ? (
                  <Td>
                    <Checkbox
                      checked={selected.has(log._id)}
                      onCheckedChange={() => onToggleRow?.(log._id!)}
                      aria-label={`Select log ${log.memo || log._id}`}
                    />
                  </Td>
                ) : null}
                <Td>
                  <EntityRowLink
                    href={`/dashboard/crm/time-tracking/time-logs/${log._id}`}
                    label={log.memo || '—'}
                  />
                </Td>
                <Td>
                  {log.user_id ? (
                    <EntityPickerChip
                      entity="user"
                      id={String(log.user_id)}
                      fallback="—"
                    />
                  ) : (
                    <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
                  )}
                </Td>
                <Td>
                  {log.project_id ? (
                    <EntityPickerChip
                      entity="project"
                      id={String(log.project_id)}
                      fallback="—"
                    />
                  ) : (
                    <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
                  )}
                </Td>
                <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                  {log.task_id ? (
                    <span className="font-mono">
                      {String(log.task_id).slice(-8)}
                    </span>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                  {fmt(log.start_time)}
                </Td>
                <Td className="text-right text-[12.5px] tabular-nums text-[var(--st-text)]">
                  {log.end_time ? (
                    wsFormatDuration(log.start_time, log.end_time)
                  ) : (
                    <LiveElapsed start={log.start_time} />
                  )}
                </Td>
                <Td>
                  {(log as { billable?: boolean }).billable ? (
                    <Badge variant="success">Billable</Badge>
                  ) : (
                    <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
                  )}
                </Td>
                <Td>
                  <Badge
                    variant={s.variant as 'success' | 'danger' | 'warning' | 'ghost'}
                  >
                    {s.label}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {!log.end_time ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => log._id && onStop(log._id)}
                        disabled={busy}
                        aria-label="Stop timer"
                      >
                        <Square className="h-3.5 w-3.5" />
                      </Button>
                    ) : !log.approved && log.status !== 'approved' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => log._id && onApprove(log._id)}
                          aria-label="Approve"
                        >
                          <Check className="h-3.5 w-3.5 text-[var(--st-text)]" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReject(log)}
                          aria-label="Reject"
                        >
                          <X className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => log._id && onDelete(log._id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

export { LiveElapsed };
