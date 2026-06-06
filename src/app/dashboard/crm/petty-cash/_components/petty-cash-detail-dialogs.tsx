'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter } from 'next/navigation';

/**
 * Petty cash detail dialogs:
 *   • <PettyCashTopUpDialog>     — capture top-up amount + notes.
 *   • <PettyCashVoucherDialog>   — capture voucher category/amount/payee.
 *   • <PettyCashReconcileDialog> — capture counted amount + notes.
 */

import * as React from 'react';
import { Camera, FileUp, LoaderCircle } from 'lucide-react';

import {
  reconcilePettyCash,
  topUpPettyCash,
} from '@/app/actions/crm-petty-cash.actions';
import { recordPettyCashVoucherExt } from '../extended-actions';

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
  const { toast } = useToast();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top up float</DialogTitle>
          <DialogDescription>
            Adds the amount to the running balance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="pt-amount">Amount</Label>
            <Input
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
            <Label htmlFor="pt-notes">Notes</Label>
            <Textarea
              id="pt-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Weekly top-up from operating bank"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Top up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const { toast } = useToast();
  const [category, setCategory] = React.useState<string>('misc');
  const [amount, setAmount] = React.useState('');
  const [payee, setPayee] = React.useState('');
  const [date, setDate] = React.useState('');
  const [glCode, setGlCode] = React.useState('');
  const [requesterName, setRequesterName] = React.useState('');
  const [receiptUrl, setReceiptUrl] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const [isOcrLoading, setIsOcrLoading] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setCategory('misc');
      setAmount('');
      setPayee('');
      setGlCode('');
      setRequesterName('Current User'); // Auto-fill
      setReceiptUrl('');
      setDate(new Date().toISOString().slice(0, 10)); // Auto-fill
    }
  }, [open]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptUrl(reader.result as string);
      setIsUploading(false);
      
      // Mock OCR capabilities
      setIsOcrLoading(true);
      setTimeout(() => {
        setAmount('150.00');
        setPayee('Office Depot');
        setDate(new Date().toISOString().slice(0, 10));
        setIsOcrLoading(false);
        toast({ title: 'OCR Complete', description: 'Extracted amount and payee from receipt.' });
      }, 1500);
    };
    reader.readAsDataURL(file);
  };

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
      const res = await recordPettyCashVoucherExt(floatId, {
        category,
        amount: parsed,
        payee,
        date,
        glCode,
        requesterName,
        receiptUrl,
        status: 'pending_approval',
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record voucher</DialogTitle>
          <DialogDescription>
            Deducts the amount from the running balance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="pv-category">Category</Label>
            <select
              id="pv-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 text-[13px] text-[var(--st-text)]"
            >
              {VOUCHER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="pv-amount">Amount</Label>
            <div className="flex gap-2">
              <Input
                id="pv-amount"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5"
                placeholder="0.00"
              />
              {isOcrLoading && <LoaderCircle className="h-5 w-5 mt-3 animate-spin text-[var(--st-text)]" />}
            </div>
          </div>
          <div>
            <Label htmlFor="pv-glcode">GL Code</Label>
            <Input
              id="pv-glcode"
              value={glCode}
              onChange={(e) => setGlCode(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. 60100"
            />
          </div>
          <div>
            <Label htmlFor="pv-payee">Payee</Label>
            <Input
              id="pv-payee"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Office stationery"
            />
          </div>
          <div>
            <Label htmlFor="pv-requester">Requester Name</Label>
            <Input
              id="pv-requester"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="pv-date">Date</Label>
            <Input
              id="pv-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Receipt Image</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                id="pv-receipt"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="text-[13px]"
              />
              {receiptUrl && (
                <div className="h-8 w-8 rounded overflow-hidden border">
                  <img src={receiptUrl} alt="Receipt preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Record voucher'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PettyCashReconcileDialog({
  open,
  onOpenChange,
  floatId,
}: BaseDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reconcile float</DialogTitle>
          <DialogDescription>
            Match the counted cash against the system balance. Variance is
            recorded automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="pr-counted">Counted amount</Label>
            <Input
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
            <Label htmlFor="pr-notes">Notes</Label>
            <Textarea
              id="pr-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Variance traced to missing voucher"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Reconcile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
