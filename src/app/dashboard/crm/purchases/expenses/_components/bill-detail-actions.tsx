'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  Banknote,
  Copy,
  CircleX,
  FileMinus,
  Mail,
  Pencil,
  Printer,
  Receipt,
  Trash2,
  } from 'lucide-react';

/**
 * <BillDetailActions> — top-right action group on the bill detail page.
 * Renders 10 actions per CRM_REBUILD_PLAN §1D: Edit, Mark Paid, Record
 * Payout, Convert to Debit Note, Email, Print, Duplicate, Archive,
 * Delete, Activity. Status pill is a clickable dropdown.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  deleteBillAction,
  updateBillStatus,
} from '@/app/actions/crm/bills.actions';
import type { CrmBillStatus } from '@/lib/rust-client/crm-bills';

import { BillEmailDialog, BillMarkPaidDialog } from './bill-dialogs';

const STATUS_OPTIONS: { value: CrmBillStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface BillDetailActionsProps {
  billId: string;
  billNo: string;
  status?: string;
  vendorEmail?: string | null;
}

export function BillDetailActions({
  billId,
  billNo,
  status,
  vendorEmail,
}: BillDetailActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = React.useState(status ?? 'draft');
  const [, startTransition] = React.useTransition();

  const [emailOpen, setEmailOpen] = React.useState(false);
  const [markPaidOpen, setMarkPaidOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => setCurrentStatus(status ?? 'draft'), [status]);

  const moveTo = (next: string) => {
    if (next === currentStatus) return;
    const prev = currentStatus;
    setCurrentStatus(next);
    startTransition(async () => {
      const res = await updateBillStatus(billId, next);
      if (!res.success) {
        setCurrentStatus(prev);
        toast({
          title: 'Status change failed',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Status updated',
        description: `Now ${next.replace(/_/g, ' ')}`,
      });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
            aria-label="Change status"
          >
            <StatusPill
              label={currentStatus.replace(/_/g, ' ')}
              tone={statusToTone(currentStatus)}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {STATUS_OPTIONS.map((s) => (
            <DropdownMenuItem
              key={s.value}
              onSelect={() => moveTo(s.value)}
            >
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/purchases/expenses/${billId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setMarkPaidOpen(true)}>
        <Banknote className="h-3.5 w-3.5" /> Mark paid
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/purchases/payouts/new?fromKind=bill&fromId=${billId}`}
        >
          <Receipt className="h-3.5 w-3.5" /> Record payout
        </Link>
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/purchases/debit-notes/new?fromKind=bill&fromId=${billId}`}
        >
          <FileMinus className="h-3.5 w-3.5" /> Convert to debit note
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
        <Mail className="h-3.5 w-3.5" /> Email
      </Button>

      <Button size="sm" variant="outline" asChild>
        <a
          href={`/dashboard/crm/purchases/expenses/${billId}?print=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </a>
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/purchases/expenses/new?fromKind=bill&fromId=${billId}`}
        >
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
        <Archive className="h-3.5 w-3.5" /> Archive
      </Button>

      <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>

      <Button size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/purchases/expenses/${billId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </Button>

      <BillEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        billId={billId}
        billNo={billNo}
        initialTo={vendorEmail ?? ''}
      />
      <BillMarkPaidDialog
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        billId={billId}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this bill?"
        description="The bill is marked cancelled and hidden from default views. You can restore it later."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => {
          const res = await updateBillStatus(billId, 'cancelled');
          if (res.success) {
            toast({ title: 'Archived' });
            router.refresh();
          } else {
            toast({
              title: 'Archive failed',
              description: res.error,
              variant: 'destructive',
            });
          }
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this bill?"
        description="This permanently removes the bill. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await deleteBillAction(billId);
          if (res.success) {
            toast({ title: 'Deleted' });
            router.push('/dashboard/crm/purchases/expenses');
          } else {
            toast({
              title: 'Delete failed',
              description: res.error,
              variant: 'destructive',
            });
            throw new Error(res.error);
          }
        }}
      />

      <span aria-hidden className="sr-only">
        <CircleX />
      </span>
    </div>
  );
}
