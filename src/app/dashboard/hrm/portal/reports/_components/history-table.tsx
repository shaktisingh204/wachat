'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/zoruui';
import { LoaderCircle } from 'lucide-react';
import type { HrmTaskReport } from '@/app/actions/hrm-task-reports.actions';
import { useVirtualizer } from '@tanstack/react-virtual';

interface HistoryTableProps {
  reportsPromise: Promise<HrmTaskReport[]>;
}



export function HistoryTable({ reportsPromise }: HistoryTableProps) {
  const reports = React.use(reportsPromise);
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: reports.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });

  if (reports.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zoru-ink-muted border border-zoru-line rounded-lg">
        No completed tasks in this range.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zoru-line flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-[minmax(150px,2fr)_minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,1fr)_minmax(150px,1fr)] items-center px-4 py-3 border-b border-zoru-line bg-zoru-surface-2 text-[13px] font-medium text-zoru-ink-muted">
        <div>Task Title</div>
        <div>Roadmap</div>
        <div>Phase</div>
        <div>Completed At</div>
        <div>Manager Acknowledged</div>
      </div>

      {/* Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '400px' }}
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
                className="grid grid-cols-[minmax(150px,2fr)_minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,1fr)_minmax(150px,1fr)] items-center px-4 border-b border-zoru-line hover:bg-zoru-surface-2/50 transition-colors bg-zoru-surface text-[13px]"
              >
                <div className="font-medium text-zoru-ink pr-2 truncate">
                  {report.taskTitle}
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
                    <Badge variant="success">Yes</Badge>
                  ) : (
                    <Badge variant="ghost">Pending</Badge>
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

export function HistoryTableSkeleton() {
  return (
    <div className="flex h-40 items-center justify-center border border-zoru-line rounded-lg">
      <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
    </div>
  );
}
