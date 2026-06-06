'use client';

import { Button, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  ClipboardCheck,
  FileSearch,
  Pencil,
  Printer,
  Receipt,
  Wallet,
  } from 'lucide-react';

/**
 * <PettyCashDetailActions> — 8 actions: Edit · Top up · Record voucher ·
 * Reconcile · Print register · Archive · Audit · Activity.
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { deletePettyCash } from '@/app/actions/crm-petty-cash.actions';

import {
  PettyCashReconcileDialog,
  PettyCashTopUpDialog,
  PettyCashVoucherDialog,
} from './petty-cash-detail-dialogs';

interface PettyCashDetailActionsProps {
  floatId: string;
  disabled?: boolean;
}

export function PettyCashDetailActions({
  floatId,
  disabled = false,
}: PettyCashDetailActionsProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [topUpOpen, setTopUpOpen] = React.useState(false);
  const [voucherOpen, setVoucherOpen] = React.useState(false);
  const [reconcileOpen, setReconcileOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild disabled={disabled}>
        {disabled ? (
          <span className="flex items-center"><Pencil className="mr-2 h-3.5 w-3.5" /> Edit</span>
        ) : (
          <Link href={`/dashboard/crm/petty-cash/${floatId}/edit`}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
          </Link>
        )}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setTopUpOpen(true)}
        disabled={disabled}
      >
        <Wallet className="mr-2 h-3.5 w-3.5" /> Top up
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setVoucherOpen(true)}
        disabled={disabled}
      >
        <Receipt className="mr-2 h-3.5 w-3.5" /> Record voucher
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setReconcileOpen(true)}
        disabled={disabled}
      >
        <ClipboardCheck className="mr-2 h-3.5 w-3.5" /> Reconcile
      </Button>

      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="mr-2 h-3.5 w-3.5" /> Print register
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setArchiveOpen(true)}
        disabled={disabled}
      >
        <Archive className="mr-2 h-3.5 w-3.5" /> Archive
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/petty-cash/${floatId}/audit`}>
          <FileSearch className="mr-2 h-3.5 w-3.5" /> Audit
        </Link>
      </Button>

      <Button size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/petty-cash/${floatId}/activity`}>
          <Activity className="mr-2 h-3.5 w-3.5" /> Activity
        </Link>
      </Button>

      <PettyCashTopUpDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        floatId={floatId}
      />
      <PettyCashVoucherDialog
        open={voucherOpen}
        onOpenChange={setVoucherOpen}
        floatId={floatId}
      />
      <PettyCashReconcileDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        floatId={floatId}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this float?"
        description="This permanently removes the petty cash float."
        requireTyped="ARCHIVE"
        confirmLabel="Archive"
        onConfirm={async () => {
          const res = await deletePettyCash(floatId);
          if (res.success) {
            toast({ title: 'Archived' });
            router.push('/dashboard/crm/petty-cash');
          } else {
            toast({
              title: 'Archive failed',
              description: res.error,
              variant: 'destructive',
            });
            throw new Error(res.error);
          }
        }}
      />
    </div>
  );
}
