'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  BarChart3,
  CheckCircle2,
  Copy,
  Download,
  Lock,
  Pencil,
  XCircle,
  } from 'lucide-react';

/**
 * <BudgetDetailActions> — 8 actions: Edit · Approve · Reject · Lock ·
 * Compare scenarios · Export variance · Archive · Activity.
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  approveBudget,
  deleteBudget,
  lockBudget,
  cloneBudget,
} from '@/app/actions/crm-budgets.actions';

import {
  BudgetRecordActualDialog,
  BudgetRejectDialog,
} from './budget-detail-dialogs';

interface BudgetDetailActionsProps {
  budgetId: string;
  status?: string;
  locked?: boolean;
  scenario?: string;
}

export function BudgetDetailActions({
  budgetId,
  status,
  locked,
  scenario,
}: BudgetDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [, startTransition] = React.useTransition();

  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [actualOpen, setActualOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [cloning, setCloning] = React.useState(false);

  const runApprove = () => {
    startTransition(async () => {
      const res = await approveBudget(budgetId);
      if (res.success) {
        toast({ title: 'Approved' });
        router.refresh();
      } else {
        toast({
          title: 'Approve failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const runLock = () => {
    startTransition(async () => {
      const res = await lockBudget(budgetId);
      if (res.success) {
        toast({ title: 'Locked' });
        router.refresh();
      } else {
        toast({
          title: 'Lock failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const runClone = () => {
    setCloning(true);
    startTransition(async () => {
      const res = await cloneBudget(budgetId);
      setCloning(false);
      if (res.success && res.newId) {
        toast({ title: 'Budget cloned successfully' });
        router.push(`/dashboard/crm/budgets/${res.newId}/edit`);
      } else {
        toast({
          title: 'Clone failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/budgets/${budgetId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={runClone}
        disabled={cloning}
      >
        <Copy className="h-3.5 w-3.5" /> Clone
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={runApprove}
        disabled={status === 'approved' || locked}
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setRejectOpen(true)}
        disabled={status === 'rejected' || locked}
      >
        <XCircle className="h-3.5 w-3.5" /> Reject
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={runLock}
        disabled={locked}
      >
        <Lock className="h-3.5 w-3.5" /> Lock
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setActualOpen(true)}
        disabled={locked}
      >
        <BarChart3 className="h-3.5 w-3.5" /> Record actual
      </Button>

      <Button size="sm" variant="outline" asChild>
        {/* TODO 1D.2: scenario comparison view not yet implemented */}
        <Link
          href={`/dashboard/crm/budgets?scenario=${scenario || 'base'}&compare=1`}
        >
          <BarChart3 className="h-3.5 w-3.5" /> Compare scenarios
        </Link>
      </Button>

      <Button size="sm" variant="outline" asChild>
        {/* TODO 1D.2: variance export endpoint not yet implemented */}
        <a
          href={`/api/crm/budgets/${budgetId}/variance.csv`}
          download
        >
          <Download className="h-3.5 w-3.5" /> Export variance
        </a>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setArchiveOpen(true)}
      >
        <Archive className="h-3.5 w-3.5" /> Archive
      </Button>

      <Button size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/budgets/${budgetId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </Button>

      <BudgetRejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        budgetId={budgetId}
      />
      <BudgetRecordActualDialog
        open={actualOpen}
        onOpenChange={setActualOpen}
        budgetId={budgetId}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this budget?"
        description="This permanently removes the budget."
        requireTyped="ARCHIVE"
        confirmLabel="Archive"
        onConfirm={async () => {
          const res = await deleteBudget(budgetId);
          if (res.success) {
            toast({ title: 'Archived' });
            router.push('/dashboard/crm/budgets');
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
