'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';

/**
 * Budget detail dialogs:
 *   • <BudgetRejectDialog> — capture reason, call rejectBudget.
 *   • <BudgetRecordActualDialog> — capture actual amount, call recordBudgetActual.
 */

import * as React from 'react';

import {
  recordBudgetActual,
  rejectBudget,
} from '@/app/actions/crm-budgets.actions';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
}

export function BudgetRejectDialog({
  open,
  onOpenChange,
  budgetId,
}: BaseDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [reason, setReason] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const onSubmit = () => {
    startTransition(async () => {
      const res = await rejectBudget(budgetId, reason);
      if (res.success) {
        toast({ title: 'Rejected' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Reject failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this budget?</DialogTitle>
          <DialogDescription>
            Marks the budget rejected and stores the reason in audit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="bj-reason">Reason</Label>
            <Textarea
              id="bj-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Numbers don't match the FY25 plan"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={pending}
          >
            {pending ? 'Saving…' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BudgetRecordActualDialog({
  open,
  onOpenChange,
  budgetId,
}: BaseDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [amount, setAmount] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) setAmount('');
  }, [open]);

  const onSubmit = () => {
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed)) {
      toast({
        title: 'Amount required',
        description: 'Enter a numeric amount (positive or negative).',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await recordBudgetActual(budgetId, parsed);
      if (res.success) {
        toast({ title: 'Actual posted' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Post failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record actual spend</DialogTitle>
          <DialogDescription>
            Adds the amount to the running actual and recomputes variance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="ba-amount">Amount</Label>
            <Input
              id="ba-amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5"
              placeholder="0.00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Post actual'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
