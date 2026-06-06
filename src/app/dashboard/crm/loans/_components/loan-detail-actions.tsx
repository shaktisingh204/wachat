'use client';

import { Button, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  BadgeAlert,
  Calculator,
  CircleDollarSign,
  Pencil,
  Printer,
  Receipt,
  Send,
  } from 'lucide-react';

/**
 * <LoanDetailActions> — 8 actions: Edit · Disburse · Record Payment ·
 * Generate EMI Schedule · Mark NPA · Print Statement · Archive · Activity.
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  deleteLoan,
  disburseLoan,
  generateLoanEmiSchedule,
  markLoanNpa,
} from '@/app/actions/crm-loans.actions';

import { LoanRecordPaymentDialog } from './loan-detail-dialogs';

interface LoanDetailActionsProps {
  loanId: string;
  status?: string;
}

export function LoanDetailActions({ loanId, status }: LoanDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [, startTransition] = React.useTransition();

  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [npaOpen, setNpaOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  const runDisburse = () => {
    startTransition(async () => {
      const res = await disburseLoan(loanId);
      if (res.success) {
        toast({ title: 'Disbursed' });
        router.refresh();
      } else {
        toast({
          title: 'Disburse failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const runGenerate = () => {
    startTransition(async () => {
      const res = await generateLoanEmiSchedule(loanId);
      if (res.success) {
        toast({
          title: 'EMI schedule generated',
          description: `${res.schedule?.length ?? 0} instalments`,
        });
        router.refresh();
      } else {
        toast({
          title: 'Generate failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/loans/${loanId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={runDisburse}
        disabled={status === 'closed' || status === 'npa'}
      >
        <Send className="h-3.5 w-3.5" /> Disburse
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setPaymentOpen(true)}
      >
        <Receipt className="h-3.5 w-3.5" /> Record payment
      </Button>

      <Button size="sm" variant="outline" onClick={runGenerate}>
        <Calculator className="h-3.5 w-3.5" /> Generate EMI schedule
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setNpaOpen(true)}
        disabled={status === 'npa' || status === 'closed'}
      >
        <BadgeAlert className="h-3.5 w-3.5" /> Mark NPA
      </Button>

      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" /> Print statement
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setArchiveOpen(true)}
      >
        <Archive className="h-3.5 w-3.5" /> Archive
      </Button>

      <Button size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/loans/${loanId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </Button>

      <span aria-hidden className="sr-only">
        <CircleDollarSign />
      </span>

      <LoanRecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        loanId={loanId}
      />
      <ConfirmDialog
        open={npaOpen}
        onOpenChange={setNpaOpen}
        title="Mark loan as NPA?"
        description="Flags the loan as a Non-Performing Asset and locks payment workflows."
        confirmLabel="Mark NPA"
        confirmTone="danger"
        onConfirm={async () => {
          const res = await markLoanNpa(loanId);
          if (res.success) {
            toast({ title: 'Marked NPA' });
            router.refresh();
          } else {
            toast({
              title: 'NPA failed',
              description: res.error,
              variant: 'destructive',
            });
            throw new Error(res.error);
          }
        }}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this loan?"
        description="The loan is removed from active views."
        requireTyped="ARCHIVE"
        confirmLabel="Archive"
        onConfirm={async () => {
          const res = await deleteLoan(loanId);
          if (res.success) {
            toast({ title: 'Archived' });
            router.push('/dashboard/crm/loans');
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
