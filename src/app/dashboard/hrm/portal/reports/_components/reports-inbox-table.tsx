'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Checkbox,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { CheckCheck, LoaderCircle } from 'lucide-react';
import type { HrmTaskReport } from '@/app/actions/hrm-task-reports.actions';

interface ReportsInboxTableProps {
  reports: HrmTaskReport[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onAcknowledge: (id: string) => void;
  acknowledging: Set<string>;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function workerInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-cyan-100 text-cyan-700',
  'bg-rose-100 text-rose-700',
];

function avatarColor(name: string): string {
  const code = name.charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

export function ReportsInboxTable({
  reports,
  loading,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onAcknowledge,
  acknowledging,
}: ReportsInboxTableProps) {
  const allSelected = reports.length > 0 && reports.every((r) => selectedIds.has(r._id));
  const someSelected = reports.some((r) => selectedIds.has(r._id));

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zoru-ink-muted">
        No reports match your filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zoru-line">
      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow className="border-zoru-line hover:bg-transparent">
            <ZoruTableHead className="w-10 pl-4">
              <ZoruCheckbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={onToggleAll}
                aria-label="Select all"
              />
            </ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Task Title</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Worker</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Roadmap</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Phase</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Completed At</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
            <ZoruTableHead className="text-right text-zoru-ink-muted pr-4">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {reports.map((report) => {
            const isAcked = !!report.acknowledgedAt;
            const isPending = acknowledging.has(report._id);
            return (
              <ZoruTableRow key={report._id} className="border-zoru-line">
                <ZoruTableCell className="pl-4">
                  <ZoruCheckbox
                    checked={selectedIds.has(report._id)}
                    onCheckedChange={() => onToggleSelect(report._id)}
                    aria-label={`Select ${report.taskTitle}`}
                  />
                </ZoruTableCell>
                <ZoruTableCell className="font-medium text-zoru-ink">
                  {report.taskTitle}
                </ZoruTableCell>
                <ZoruTableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${avatarColor(report.workerName)}`}
                      aria-hidden="true"
                    >
                      {workerInitials(report.workerName)}
                    </span>
                    <span className="text-[13px] text-zoru-ink">{report.workerName}</span>
                  </div>
                </ZoruTableCell>
                <ZoruTableCell className="text-zoru-ink">
                  <Link
                    href={`/dashboard/hrm/portal/roadmaps/${report.roadmapId}`}
                    className="text-[13px] hover:underline text-zoru-ink"
                  >
                    View roadmap
                  </Link>
                </ZoruTableCell>
                <ZoruTableCell className="text-[13px] text-zoru-ink">
                  {report.phaseId || '—'}
                </ZoruTableCell>
                <ZoruTableCell className="text-[13px] text-zoru-ink">
                  {fmtDate(report.completedAt)}
                </ZoruTableCell>
                <ZoruTableCell>
                  {isAcked ? (
                    <ZoruBadge variant="success">Acknowledged</ZoruBadge>
                  ) : (
                    <ZoruBadge variant="warning">Unacknowledged</ZoruBadge>
                  )}
                </ZoruTableCell>
                <ZoruTableCell className="text-right pr-4">
                  {!isAcked && (
                    <ZoruButton
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => onAcknowledge(report._id)}
                      className="gap-1.5"
                    >
                      {isPending ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCheck className="h-3.5 w-3.5" />
                      )}
                      Acknowledge
                    </ZoruButton>
                  )}
                </ZoruTableCell>
              </ZoruTableRow>
            );
          })}
        </ZoruTableBody>
      </ZoruTable>
    </div>
  );
}
