'use client';

/**
 * Client side of the Leave Requests list — owns the table and the
 * hard-delete confirmation dialog. The Rust applications endpoint
 * doesn't yet expose a free-text search, so the toolbar surfaces only
 * the new-request button (mounted at the page level) and pagination.
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
import { deleteLeaveAction } from '@/app/actions/crm/leaves.actions';
import type {
  CrmLeaveDoc,
  CrmLeaveStatus,
  CrmLeaveTypeOption,
} from '@/lib/rust-client/crm-leaves';

interface LeaveListClientProps {
  leaves: CrmLeaveDoc[];
  leaveTypes: CrmLeaveTypeOption[];
  page: number;
  limit: number;
  hasMore: boolean;
  error?: string;
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const STATUS_VARIANT: Record<
  CrmLeaveStatus,
  'warning' | 'success' | 'danger' | 'secondary'
> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'secondary',
};

const STATUS_LABEL: Record<CrmLeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export function LeaveListClient({
  leaves,
  leaveTypes,
  page,
  limit,
  hasMore,
  error,
}: LeaveListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();

  const [pendingDelete, setPendingDelete] =
    React.useState<CrmLeaveDoc | null>(null);
  const [deleting, startDelete] = React.useTransition();

  // Build a code/name index once per render of the leaveTypes prop so
  // the table cell lookup stays O(1) rather than scanning the array on
  // every row.
  const leaveTypeIndex = React.useMemo(() => {
    const map = new Map<string, CrmLeaveTypeOption>();
    for (const lt of leaveTypes) map.set(lt._id, lt);
    return map;
  }, [leaveTypes]);

  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    startDelete(async () => {
      const res = await deleteLeaveAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: 'Leave request removed.' });
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
            <ZoruTableHead>Leave type</ZoruTableHead>
            <ZoruTableHead>From</ZoruTableHead>
            <ZoruTableHead>To</ZoruTableHead>
            <ZoruTableHead>Days</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Submitted</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {leaves.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell
                colSpan={8}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                No leave requests yet — click &ldquo;New leave request&rdquo; to add one.
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            leaves.map((leave) => {
              const id = String(leave._id);
              const lt = leaveTypeIndex.get(leave.leaveTypeId);
              const ltLabel = lt
                ? `${lt.code} · ${lt.name}`
                : leave.leaveTypeId;
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <EntityPickerChip
                      entity="employee"
                      id={leave.assignedTo}
                      fallback="—"
                    />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge variant="secondary" className="font-mono text-[11px]">
                      {ltLabel}
                    </ZoruBadge>
                    {leave.halfDay ? (
                      <ZoruBadge variant="outline" className="ml-1 text-[11px]">
                        ½ day
                      </ZoruBadge>
                    ) : null}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(leave.from)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(leave.to)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink">
                    {leave.days}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge variant={STATUS_VARIANT[leave.status]}>
                      {STATUS_LABEL[leave.status]}
                    </ZoruBadge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(leave.createdAt)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/crm/hr-payroll/leave/${id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(leave)}
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
            <ZoruAlertDialogTitle>Delete leave request?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes the leave request from the database.
              The action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>Cancel</ZoruAlertDialogCancel>
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
