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

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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

const STATUS_TONE: Record<
  WsRemovalRequestStatus,
  'amber' | 'green' | 'red' | 'blue'
> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  completed: 'blue',
};

function formatDate(value?: Date | string) {
  if (!value) return '—';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export default function RemovalRequestsPage() {
  const { toast } = useToast();
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
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => onApprove(id, variant)}
            aria-label="Approve"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setRejecting({ id, variant })}
            aria-label="Reject"
          >
            <XCircle className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </>
      ) : null}
      {status === 'approved' ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => onComplete(id, variant)}
          aria-label="Complete"
        >
          <CircleCheckBig className="h-3.5 w-3.5 text-sky-500" />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setDeleting({ id, variant })}
        aria-label="Delete"
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );

  const emptyRow = (cols: number, label: string) => (
    <TableRow className="border-border">
      <TableCell
        colSpan={cols}
        className="h-24 text-center text-[13px] text-muted-foreground"
      >
        {label}
      </TableCell>
    </TableRow>
  );

  const loadingRows = (cols: number) =>
    [...Array(3)].map((_, i) => (
      <TableRow key={i} className="border-border">
        <TableCell colSpan={cols}>
          <Skeleton className="h-8 w-full" />
        </TableCell>
      </TableRow>
    ));

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Removal Requests"
        subtitle="GDPR right-to-be-forgotten submissions from users and leads."
        icon={UserMinus}
      />

      <ClayCard>
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="users">
              User Requests ({userRows.length})
            </TabsTrigger>
            <TabsTrigger value="leads">
              Lead Requests ({leadRows.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">
                      User ID
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Reason
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Submitted
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Handled
                    </TableHead>
                    <TableHead className="w-[160px] text-right text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && userRows.length === 0
                    ? loadingRows(6)
                    : userRows.length === 0
                      ? emptyRow(6, 'No user removal requests yet.')
                      : userRows.map((row) => (
                          <TableRow
                            key={row._id}
                            className="border-border"
                          >
                            <TableCell className="text-[13px] text-foreground">
                              {row.user_id || '—'}
                            </TableCell>
                            <TableCell className="max-w-[280px] truncate text-[13px] text-muted-foreground">
                              {row.reason || '—'}
                            </TableCell>
                            <TableCell>
                              <ClayBadge tone={STATUS_TONE[row.status]}>
                                {row.status.charAt(0).toUpperCase() +
                                  row.status.slice(1)}
                              </ClayBadge>
                            </TableCell>
                            <TableCell className="text-[13px] text-muted-foreground">
                              {formatDate(row.submitted_at)}
                            </TableCell>
                            <TableCell className="text-[13px] text-muted-foreground">
                              {formatDate(row.handled_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              {renderActions(row.status, row._id, 'user')}
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="leads">
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">
                      Lead ID
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Email
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Reason
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Submitted
                    </TableHead>
                    <TableHead className="w-[160px] text-right text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && leadRows.length === 0
                    ? loadingRows(6)
                    : leadRows.length === 0
                      ? emptyRow(6, 'No lead removal requests yet.')
                      : leadRows.map((row) => (
                          <TableRow
                            key={row._id}
                            className="border-border"
                          >
                            <TableCell className="text-[13px] text-foreground">
                              {row.lead_id || '—'}
                            </TableCell>
                            <TableCell className="text-[13px] text-muted-foreground">
                              {row.requester_email || '—'}
                            </TableCell>
                            <TableCell className="max-w-[260px] truncate text-[13px] text-muted-foreground">
                              {row.reason || '—'}
                            </TableCell>
                            <TableCell>
                              <ClayBadge tone={STATUS_TONE[row.status]}>
                                {row.status.charAt(0).toUpperCase() +
                                  row.status.slice(1)}
                              </ClayBadge>
                            </TableCell>
                            <TableCell className="text-[13px] text-muted-foreground">
                              {formatDate(row.submitted_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              {renderActions(row.status, row._id, 'lead')}
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </ClayCard>

      <Dialog
        open={rejecting !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Reject Removal Request
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Provide a reason the requester will see.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason" className="text-foreground">
              Reason
            </Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Outstanding legal obligation…"
              className="rounded-lg border-border bg-card text-[13px]"
            />
          </div>
          <DialogFooter className="gap-2">
            <ClayButton
              type="button"
              variant="pill"
              onClick={() => {
                setRejecting(null);
                setRejectReason('');
              }}
            >
              Cancel
            </ClayButton>
            <ClayButton
              type="button"
              variant="obsidian"
              disabled={pending}
              onClick={confirmReject}
              leading={
                pending ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : null
              }
            >
              Reject
            </ClayButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete request?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
