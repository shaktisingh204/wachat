'use client';

import { Badge, Button, Checkbox, Table, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/sabcrm/20ui/compat';
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
      <div className="rounded-lg border border-zoru-line p-6 text-center text-[13px] text-zoru-ink-muted">
        No time logs match the current filters.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zoru-line">
      <Table>
        <ZoruTableHeader>
          <ZoruTableRow className="border-zoru-line hover:bg-transparent">
            {selected !== undefined ? <ZoruTableHead className="w-10" /> : null}
            <ZoruTableHead>Memo</ZoruTableHead>
            <ZoruTableHead>Employee</ZoruTableHead>
            <ZoruTableHead>Project</ZoruTableHead>
            <ZoruTableHead>Task</ZoruTableHead>
            <ZoruTableHead>Date</ZoruTableHead>
            <ZoruTableHead className="text-right">Hours</ZoruTableHead>
            <ZoruTableHead>Billable</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {rows.map((log) => {
            const s = badge(log);
            return (
              <ZoruTableRow
                key={log._id}
                className="border-zoru-line transition-colors"
              >
                {selected !== undefined && log._id ? (
                  <ZoruTableCell>
                    <Checkbox
                      checked={selected.has(log._id)}
                      onCheckedChange={() => onToggleRow?.(log._id!)}
                      aria-label={`Select log ${log.memo || log._id}`}
                    />
                  </ZoruTableCell>
                ) : null}
                <ZoruTableCell>
                  <EntityRowLink
                    href={`/dashboard/crm/time-tracking/time-logs/${log._id}`}
                    label={log.memo || '—'}
                  />
                </ZoruTableCell>
                <ZoruTableCell>
                  {log.user_id ? (
                    <EntityPickerChip
                      entity="user"
                      id={String(log.user_id)}
                      fallback="—"
                    />
                  ) : (
                    <span className="text-[12px] text-zoru-ink-muted">—</span>
                  )}
                </ZoruTableCell>
                <ZoruTableCell>
                  {log.project_id ? (
                    <EntityPickerChip
                      entity="project"
                      id={String(log.project_id)}
                      fallback="—"
                    />
                  ) : (
                    <span className="text-[12px] text-zoru-ink-muted">—</span>
                  )}
                </ZoruTableCell>
                <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                  {log.task_id ? (
                    <span className="font-mono">
                      {String(log.task_id).slice(-8)}
                    </span>
                  ) : (
                    '—'
                  )}
                </ZoruTableCell>
                <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                  {fmt(log.start_time)}
                </ZoruTableCell>
                <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                  {log.end_time ? (
                    wsFormatDuration(log.start_time, log.end_time)
                  ) : (
                    <LiveElapsed start={log.start_time} />
                  )}
                </ZoruTableCell>
                <ZoruTableCell>
                  {(log as { billable?: boolean }).billable ? (
                    <Badge variant="success">Billable</Badge>
                  ) : (
                    <span className="text-[12px] text-zoru-ink-muted">—</span>
                  )}
                </ZoruTableCell>
                <ZoruTableCell>
                  <Badge
                    variant={s.variant as 'success' | 'danger' | 'warning' | 'ghost'}
                  >
                    {s.label}
                  </Badge>
                </ZoruTableCell>
                <ZoruTableCell className="text-right">
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
                          <Check className="h-3.5 w-3.5 text-zoru-ink" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReject(log)}
                          aria-label="Reject"
                        >
                          <X className="h-3.5 w-3.5 text-zoru-danger-ink" />
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => log._id && onDelete(log._id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                    </Button>
                  </div>
                </ZoruTableCell>
              </ZoruTableRow>
            );
          })}
        </ZoruTableBody>
      </Table>
    </div>
  );
}

export { LiveElapsed };
