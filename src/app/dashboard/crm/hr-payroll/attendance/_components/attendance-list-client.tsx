'use client';

/**
 * Client side of the Attendance list — owns the table and the
 * hard-delete confirmation dialog. There's no debounced search box
 * (the Rust endpoint filters on `employeeId` / date window, not free
 * text); future iterations can add a filter strip here.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Pencil,
  Trash2,
  LoaderCircle,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { deleteAttendanceAction } from '@/app/actions/crm/attendance.actions';
import type {
  CrmAttendanceDoc,
  CrmAttendanceStatus,
} from '@/lib/rust-client/crm-attendance';

interface AttendanceListClientProps {
  records: CrmAttendanceDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  error?: string;
}

const STATUS_LABEL: Record<CrmAttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half day',
  leave: 'Leave',
  holiday: 'Holiday',
  wfh: 'WFH',
};

/**
 * Map every status to a Zoru badge variant — `present` and `wfh`
 * are positive, `absent` is destructive, `leave`/`holiday` are
 * informational, `half_day` is a warning amber.
 */
const STATUS_VARIANT: Record<
  CrmAttendanceStatus,
  React.ComponentProps<typeof ZoruBadge>['variant']
> = {
  present: 'success',
  absent: 'danger',
  half_day: 'warning',
  leave: 'info',
  holiday: 'secondary',
  wfh: 'success',
};

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtHours(v?: number): string {
  if (typeof v !== 'number') return '—';
  return `${v.toFixed(2)}h`;
}

function recordLabel(r: CrmAttendanceDoc): string {
  return `the ${fmtDate(r.date)} record`;
}

export function AttendanceListClient({
  records,
  page,
  limit,
  hasMore,
  error,
}: AttendanceListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();

  const [pendingDelete, setPendingDelete] =
    React.useState<CrmAttendanceDoc | null>(null);
  const [deleting, startDelete] = React.useTransition();

  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const label = recordLabel(pendingDelete);
    startDelete(async () => {
      const res = await deleteAttendanceAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <ZoruCard className="overflow-hidden p-0">
      {error ? (
        <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Employee</ZoruTableHead>
            <ZoruTableHead>Date</ZoruTableHead>
            <ZoruTableHead>Check-in</ZoruTableHead>
            <ZoruTableHead>Check-out</ZoruTableHead>
            <ZoruTableHead>Hours</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Source</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {records.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell
                colSpan={8}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                No attendance records yet — click &quot;New record&quot; to add
                one.
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            records.map((record) => {
              const id = String(record._id);
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <Link
                      href={`/dashboard/crm/hr-payroll/attendance/${id}`}
                      className="font-medium text-zoru-ink hover:underline"
                    >
                      <EntityPickerChip
                        entity="employee"
                        id={record.employeeId}
                        fallback="Unknown employee"
                      />
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(record.date)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink-muted">
                    {fmtTime(record.punchIn?.at)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink-muted">
                    {fmtTime(record.punchOut?.at)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink">
                    {fmtHours(record.totalHours)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge variant={STATUS_VARIANT[record.status]}>
                      {STATUS_LABEL[record.status]}
                    </ZoruBadge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] capitalize text-zoru-ink-muted">
                    {record.source}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link
                          href={`/dashboard/crm/hr-payroll/attendance/${id}/edit`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(record)}
                        className="text-zoru-danger-ink"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </ZoruTable>

      <PaginationBar page={page} limit={limit} hasMore={hasMore} />

      <ZoruAlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete attendance record?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes{' '}
              <strong>
                {pendingDelete ? recordLabel(pendingDelete) : ''}
              </strong>{' '}
              from the database. The action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {deleting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </ZoruCard>
  );
}
