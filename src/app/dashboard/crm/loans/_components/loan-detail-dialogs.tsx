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
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';

/**
 * Loan detail dialogs:
 *   • <LoanRecordPaymentDialog> — capture amount, date, mode, txn id.
 *     Calls recordLoanPayment.
 */

import * as React from 'react';

import { recordLoanPayment } from '@/app/actions/crm-loans.actions';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
}

const PAYMENT_MODES = ['cash', 'bank_transfer', 'cheque', 'upi', 'card'] as const;

export function LoanRecordPaymentDialog({
  open,
  onOpenChange,
  loanId,
}: BaseDialogProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState('');
  const [mode, setMode] = React.useState<string>('bank_transfer');
  const [txnId, setTxnId] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setAmount('');
      setDate(new Date().toISOString().slice(0, 10));
      setMode('bank_transfer');
      setTxnId('');
    }
  }, [open]);

  const onSubmit = () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      toast({
        title: 'Amount required',
        description: 'Enter a positive payment amount.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await recordLoanPayment(loanId, {
        amount: parsed,
        date,
        mode,
        txnId,
      });
      if (res.success) {
        toast({ title: 'Payment recorded' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Record failed',
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
          <ZoruDialogTitle>Record loan payment</ZoruDialogTitle>
          <ZoruDialogDescription>
            Reduces the outstanding principal. The loan auto-closes when the
            balance reaches zero.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="lp-amount">Amount</ZoruLabel>
            <ZoruInput
              id="lp-amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5"
              placeholder="0.00"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="lp-date">Payment date</ZoruLabel>
            <ZoruInput
              id="lp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="lp-mode">Mode</ZoruLabel>
            <select
              id="lp-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-zoru-line bg-zoru-surface px-3 text-[13px] text-zoru-ink"
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <ZoruLabel htmlFor="lp-txn">Txn / reference (optional)</ZoruLabel>
            <ZoruInput
              id="lp-txn"
              value={txnId}
              onChange={(e) => setTxnId(e.target.value)}
              className="mt-1.5"
              placeholder="UTR / cheque no / reference"
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Record payment'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
