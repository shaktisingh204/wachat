'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge, Button, Checkbox } from '@/components/zoruui';
import { CheckCheck, LoaderCircle } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { HrmTaskReport } from '@/app/actions/hrm-task-reports.actions.types';

interface ReportsInboxTableProps {
  reports: HrmTaskReport[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onAcknowledge: (id: string) => void;
  acknowledging: Set<string>;
}



function workerInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-zoru-surface-2 text-zoru-ink',
  'bg-zoru-surface-2 text-zoru-ink',
  'bg-zoru-surface-2 text-zoru-ink',
  'bg-zoru-surface-2 text-zoru-ink',
  'bg-zoru-surface-2 text-zoru-ink',
  'bg-zoru-surface-2 text-zoru-ink',
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
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: reports.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // Approx row height
    overscan: 5,
  });

  const allSelected = reports.length > 0 && reports.every((r) => selectedIds.has(r._id));
  const someSelected = reports.some((r) => selectedIds.has(r._id));

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center border border-zoru-line rounded-lg">
        <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zoru-ink-muted border border-zoru-line rounded-lg">
        No reports match your filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zoru-line flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-[3rem_minmax(120px,1.5fr)_minmax(120px,1fr)_minmax(100px,1fr)_minmax(80px,0.8fr)_minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,1fr)] items-center px-4 py-3 border-b border-zoru-line bg-zoru-surface-2 text-[13px] font-medium text-zoru-ink-muted">
        <div className="flex justify-center">
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={onToggleAll}
            aria-label="Select all"
          />
        </div>
        <div>Task Title</div>
        <div>Worker</div>
        <div>Roadmap</div>
        <div>Phase</div>
        <div>Completed At</div>
        <div>Status</div>
        <div className="text-right">Actions</div>
      </div>

      {/* Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '400px' }} // Fixed height for virtualizer
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const report = reports[virtualRow.index];
            const isAcked = !!report.acknowledgedAt;
            const isPending = acknowledging.has(report._id);

            return (
              <div
                key={report._id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="grid grid-cols-[3rem_minmax(120px,1.5fr)_minmax(120px,1fr)_minmax(100px,1fr)_minmax(80px,0.8fr)_minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,1fr)] items-center px-4 border-b border-zoru-line hover:bg-zoru-surface-2/50 transition-colors bg-zoru-surface text-[13px]"
              >
                <div className="flex justify-center">
                  <Checkbox
                    checked={selectedIds.has(report._id)}
                    onCheckedChange={() => onToggleSelect(report._id)}
                    aria-label={`Select ${report.taskTitle}`}
                  />
                </div>
                <div className="font-medium text-zoru-ink pr-2 truncate">
                  {report.taskTitle}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${avatarColor(report.workerName)}`}
                      aria-hidden="true"
                    >
                      {workerInitials(report.workerName)}
                    </span>
                    <span className="text-zoru-ink truncate">{report.workerName}</span>
                  </div>
                </div>
                <div>
                  <Link
                    href={`/dashboard/hrm/portal/roadmaps/${report.roadmapId}`}
                    className="hover:underline text-zoru-ink truncate"
                  >
                    View roadmap
                  </Link>
                </div>
                <div className="text-zoru-ink truncate">
                  {report.phaseId || '—'}
                </div>
                <div className="text-zoru-ink truncate" suppressHydrationWarning>
                  {fmtDate(report.completedAt)}
                </div>
                <div>
                  {isAcked ? (
                    <Badge variant="success">Acknowledged</Badge>
                  ) : (
                    <Badge variant="warning">Unacknowledged</Badge>
                  )}
                </div>
                <div className="text-right flex justify-end">
                  {!isAcked && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => onAcknowledge(report._id)}
                      className="gap-1.5 h-8"
                    >
                      {isPending ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCheck className="h-3.5 w-3.5" />
                      )}
                      Acknowledge
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
