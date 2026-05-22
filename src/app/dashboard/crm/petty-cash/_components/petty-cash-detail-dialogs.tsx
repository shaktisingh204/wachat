'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';

/**
 * Petty cash detail dialogs:
 *   • <PettyCashTopUpDialog>     — capture top-up amount + notes.
 *   • <PettyCashVoucherDialog>   — capture voucher category/amount/payee.
 *   • <PettyCashReconcileDialog> — capture counted amount + notes.
 */

import * as React from 'react';

import {
  reconcilePettyCash,
  recordPettyCashVoucher,
  topUpPettyCash,
} from '@/app/actions/crm-petty-cash.actions';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floatId: string;
}

export function PettyCashTopUpDialog({
  open,
  onOpenChange,
  floatId,
}: BaseDialogProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [amount, setAmount] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setAmount('');
      setNotes('');
    }
  }, [open]);

  const onSubmit = () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      toast({
        title: 'Amount required',
        description: 'Enter a positive amount.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await topUpPettyCash(floatId, parsed, notes);
      if (res.success) {
        toast({ title: 'Top-up posted' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Top-up failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Top up float</ZoruDialogTitle>
          <ZoruDialogDescription>
            Adds the amount to the running balance.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="pt-amount">Amount</ZoruLabel>
            <ZoruInput
              id="pt-amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5"
              placeholder="0.00"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="pt-notes">Notes</ZoruLabel>
            <ZoruTextarea
              id="pt-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Weekly top-up from operating bank"
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Top up'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

const VOUCHER_CATEGORIES = [
  'travel',
  'meals',
  'office_supplies',
  'maintenance',
  'utilities',
  'misc',
] as const;

export function PettyCashVoucherDialog({
  open,
  onOpenChange,
  floatId,
}: BaseDialogProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [category, setCategory] = React.useState<string>('misc');
  const [amount, setAmount] = React.useState('');
  const [payee, setPayee] = React.useState('');
  const [date, setDate] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setCategory('misc');
      setAmount('');
      setPayee('');
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const onSubmit = () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      toast({
        title: 'Amount required',
        description: 'Enter a positive amount.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await recordPettyCashVoucher(floatId, {
        category,
        amount: parsed,
        payee,
        date,
      });
      if (res.success) {
        toast({ title: 'Voucher recorded' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Voucher failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Record voucher</ZoruDialogTitle>
          <ZoruDialogDescription>
            Deducts the amount from the running balance.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="pv-category">Category</ZoruLabel>
            <select
              id="pv-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-zoru-line bg-zoru-surface px-3 text-[13px] text-zoru-ink"
            >
              {VOUCHER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <ZoruLabel htmlFor="pv-amount">Amount</ZoruLabel>
            <ZoruInput
              id="pv-amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5"
              placeholder="0.00"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="pv-payee">Payee</ZoruLabel>
            <ZoruInput
              id="pv-payee"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Office stationery"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="pv-date">Date</ZoruLabel>
            <ZoruInput
              id="pv-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Record voucher'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

export function PettyCashReconcileDialog({
  open,
  onOpenChange,
  floatId,
}: BaseDialogProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [counted, setCounted] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setCounted('');
      setNotes('');
    }
  }, [open]);

  const onSubmit = () => {
    const parsed = parseFloat(counted);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({
        title: 'Counted amount required',
        description: 'Enter the cash counted (≥ 0).',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await reconcilePettyCash(floatId, parsed, notes);
      if (res.success) {
        toast({ title: 'Reconciled' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Reconcile failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Reconcile float</ZoruDialogTitle>
          <ZoruDialogDescription>
            Match the counted cash against the system balance. Variance is
            recorded automatically.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="pr-counted">Counted amount</ZoruLabel>
            <ZoruInput
              id="pr-counted"
              type="number"
              inputMode="decimal"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              className="mt-1.5"
              placeholder="0.00"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="pr-notes">Notes</ZoruLabel>
            <ZoruTextarea
              id="pr-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Variance traced to missing voucher"
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Reconcile'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
