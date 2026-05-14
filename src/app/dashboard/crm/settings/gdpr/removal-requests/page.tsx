'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import {
  UserMinus,
  CheckCircle2,
  XCircle,
  CircleCheckBig,
  LoaderCircle,
  Trash2,
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
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruLabel,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getRemovalRequests,
  getRemovalRequestLeads,
  approveRemovalRequest,
  rejectRemovalRequest,
  completeRemovalRequest,
  deleteRemovalRequest,
  deleteRemovalRequestLead,
} from '@/app/actions/worksuite/gdpr.actions';
import type {
  WsRemovalRequest,
  WsRemovalRequestLead,
  WsRemovalRequestStatus,
} from '@/lib/worksuite/gdpr-types';

type UserRow = WsRemovalRequest & { _id: string };
type LeadRow = WsRemovalRequestLead & { _id: string };

const STATUS_VARIANT: Record<
  WsRemovalRequestStatus,
  'warning' | 'success' | 'danger' | 'info'
> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  completed: 'info',
};

function formatDate(value?: Date | string) {
  if (!value) return '—';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export default function RemovalRequestsPage() {
  const { toast } = useZoruToast();
  const [tab, setTab] = useState<'users' | 'leads'>('users');
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [leadRows, setLeadRows] = useState<LeadRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [pending, startPending] = useTransition();
  const [rejecting, setRejecting] = useState<{
    id: string;
    variant: 'user' | 'lead';
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleting, setDeleting] = useState<{
    id: string;
    variant: 'user' | 'lead';
  } | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const [users, leads] = await Promise.all([
          getRemovalRequests() as Promise<UserRow[]>,
          getRemovalRequestLeads() as Promise<LeadRow[]>,
        ]);
        setUserRows(Array.isArray(users) ? users : []);
        setLeadRows(Array.isArray(leads) ? leads : []);
      } catch (e) {
        console.error('Failed to load removal requests:', e);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handle = (
    action: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string,
  ) => {
    startPending(async () => {
      const res = await action();
      if (res.success) {
        toast({ title: 'Updated', description: successMessage });
        refresh();
      } else {
        toast({
          title: 'Error',
          description: res.error || 'Failed',
          variant: 'destructive',
        });
      }
    });
  };

  const onApprove = (id: string, variant: 'user' | 'lead') =>
    handle(
      () => approveRemovalRequest(id, variant),
      'Removal request approved.',
    );

  const onComplete = (id: string, variant: 'user' | 'lead') =>
    handle(
      () => completeRemovalRequest(id, variant),
      'Removal request marked complete.',
    );

  const confirmReject = () => {
    if (!rejecting) return;
    handle(
      () =>
        rejectRemovalRequest(rejecting.id, rejectReason, rejecting.variant),
      'Removal request rejected.',
    );
    setRejecting(null);
    setRejectReason('');
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const res =
      deleting.variant === 'lead'
        ? await deleteRemovalRequestLead(deleting.id)
        : await deleteRemovalRequest(deleting.id);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Removal request removed.' });
      setDeleting(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const renderActions = (
    status: WsRemovalRequestStatus,
    id: string,
    variant: 'user' | 'lead',
  ) => (
    <div className="flex flex-wrap justify-end gap-1">
      {status === 'pending' ? (
        <>
          <ZoruButton
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => onApprove(id, variant)}
            aria-label="Approve"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-zoru-success-ink" />
          </ZoruButton>
          <ZoruButton
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setRejecting({ id, variant })}
            aria-label="Reject"
          >
            <XCircle className="h-3.5 w-3.5 text-zoru-danger-ink" />
          </ZoruButton>
        </>
      ) : null}
      {status === 'approved' ? (
        <ZoruButton
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => onComplete(id, variant)}
          aria-label="Complete"
        >
          <CircleCheckBig className="h-3.5 w-3.5 text-zoru-info-ink" />
        </ZoruButton>
      ) : null}
      <ZoruButton
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setDeleting({ id, variant })}
        aria-label="Delete"
      >
        <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
      </ZoruButton>
    </div>
  );

  const emptyRow = (cols: number, label: string) => (
    <ZoruTableRow>
      <ZoruTableCell
        colSpan={cols}
        className="h-24 text-center text-[13px] text-zoru-ink-muted"
      >
        {label}
      </ZoruTableCell>
    </ZoruTableRow>
  );

  const loadingRows = (cols: number) =>
    [...Array(3)].map((_, i) => (
      <ZoruTableRow key={i}>
        <ZoruTableCell colSpan={cols}>
          <ZoruSkeleton className="h-8 w-full" />
        </ZoruTableCell>
      </ZoruTableRow>
    ));

  // KPI strip: Pending · Completed · Rejected (across users + leads)
  const allRows = [...userRows, ...leadRows];
  const pendingCount = allRows.filter((r) => r.status === 'pending').length;
  const completedCount = allRows.filter((r) => r.status === 'completed').length;
  const rejectedCount = allRows.filter((r) => r.status === 'rejected').length;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Removal Requests"
        subtitle="GDPR right-to-be-forgotten submissions from users and leads."
        icon={UserMinus}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ZoruStatCard label="Pending" value={pendingCount.toLocaleString()} />
        <ZoruStatCard label="Completed" value={completedCount.toLocaleString()} />
        <ZoruStatCard label="Rejected" value={rejectedCount.toLocaleString()} />
      </div>

      <ZoruCard className="p-6">
        <div className="mb-4 inline-flex gap-1 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-1">
          {(['users', 'leads'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors',
                tab === id
                  ? 'bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)]'
                  : 'text-zoru-ink-muted hover:text-zoru-ink',
              )}
            >
              {id === 'users'
                ? `User Requests (${userRows.length})`
                : `Lead Requests (${leadRows.length})`}
            </button>
          ))}
        </div>

        {tab === 'users' ? (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead className="text-zoru-ink-muted">User ID</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Reason</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Submitted</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Handled</ZoruTableHead>
                  <ZoruTableHead className="w-[160px] text-right text-zoru-ink-muted">
                    Actions
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading && userRows.length === 0
                  ? loadingRows(6)
                  : userRows.length === 0
                    ? emptyRow(6, 'No user removal requests yet.')
                    : userRows.map((row) => (
                        <ZoruTableRow key={row._id}>
                          <ZoruTableCell className="text-[13px] text-zoru-ink">
                            {row.user_id || '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="max-w-[280px] truncate text-[13px] text-zoru-ink-muted">
                            {row.reason || '—'}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge variant={STATUS_VARIANT[row.status]}>
                              {row.status.charAt(0).toUpperCase() +
                                row.status.slice(1)}
                            </ZoruBadge>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                            {formatDate(row.submitted_at)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                            {formatDate(row.handled_at)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            {renderActions(row.status, row._id, 'user')}
                          </ZoruTableCell>
                        </ZoruTableRow>
                      ))}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead className="text-zoru-ink-muted">Lead ID</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Email</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Reason</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Submitted</ZoruTableHead>
                  <ZoruTableHead className="w-[160px] text-right text-zoru-ink-muted">
                    Actions
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading && leadRows.length === 0
                  ? loadingRows(6)
                  : leadRows.length === 0
                    ? emptyRow(6, 'No lead removal requests yet.')
                    : leadRows.map((row) => (
                        <ZoruTableRow key={row._id}>
                          <ZoruTableCell className="text-[13px] text-zoru-ink">
                            {row.lead_id || '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                            {row.requester_email || '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="max-w-[260px] truncate text-[13px] text-zoru-ink-muted">
                            {row.reason || '—'}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge variant={STATUS_VARIANT[row.status]}>
                              {row.status.charAt(0).toUpperCase() +
                                row.status.slice(1)}
                            </ZoruBadge>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                            {formatDate(row.submitted_at)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            {renderActions(row.status, row._id, 'lead')}
                          </ZoruTableCell>
                        </ZoruTableRow>
                      ))}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        )}
      </ZoruCard>

      <ZoruDialog
        open={rejecting !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(null);
            setRejectReason('');
          }
        }}
      >
        <ZoruDialogContent className="max-w-lg">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Reject Removal Request</ZoruDialogTitle>
            <ZoruDialogDescription>
              Provide a reason the requester will see.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-2">
            <ZoruLabel htmlFor="reject-reason">Reason</ZoruLabel>
            <ZoruTextarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Outstanding legal obligation…"
            />
          </div>
          <ZoruDialogFooter className="gap-2">
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => {
                setRejecting(null);
                setRejectReason('');
              }}
            >
              Cancel
            </ZoruButton>
            <ZoruButton
              type="button"
              disabled={pending}
              onClick={confirmReject}
            >
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Reject
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      <ZoruAlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete request?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={confirmDelete}>
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
