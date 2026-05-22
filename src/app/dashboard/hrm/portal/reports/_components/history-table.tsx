'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Badge,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { LoaderCircle } from 'lucide-react';
import type { HrmTaskReport } from '@/app/actions/hrm-task-reports.actions';

interface HistoryTableProps {
  reports: HrmTaskReport[];
  loading: boolean;
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

export function HistoryTable({ reports, loading }: HistoryTableProps) {
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
        No completed tasks in this range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zoru-line">
      <Table>
        <ZoruTableHeader>
          <ZoruTableRow className="border-zoru-line hover:bg-transparent">
            <ZoruTableHead className="text-zoru-ink-muted">Task Title</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Roadmap</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Phase</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Completed At</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Manager Acknowledged</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {reports.map((report) => {
            const isAcked = !!report.acknowledgedAt;
            return (
              <ZoruTableRow key={report._id} className="border-zoru-line">
                <ZoruTableCell className="font-medium text-zoru-ink">
                  {report.taskTitle}
                </ZoruTableCell>
                <ZoruTableCell>
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
                    <Badge variant="success">Yes</Badge>
                  ) : (
                    <Badge variant="ghost">Pending</Badge>
                  )}
                </ZoruTableCell>
              </ZoruTableRow>
            );
          })}
        </ZoruTableBody>
      </Table>
    </div>
  );
}
