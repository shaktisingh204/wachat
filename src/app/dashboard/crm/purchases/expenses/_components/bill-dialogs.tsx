'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter } from 'next/navigation';

/**
 * Bill detail-page dialogs.
 *
 *   • <BillEmailDialog> — capture vendor reply address + remark; marks
 *     the bill `submitted` and writes an audit row. Email delivery is
 *     handled outside this action.
 *   • <BillMarkPaidDialog> — convenience for the header "Mark paid"
 *     action; sets status and toasts.
 */

import * as React from 'react';

import { updateBillStatus } from '@/app/actions/crm/bills.actions';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string;
}

interface BillEmailDialogProps extends BaseDialogProps {
  billNo: string;
  initialTo?: string;
}

export function BillEmailDialog({
  open,
  onOpenChange,
  billNo,
  initialTo,
}: BillEmailDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = React.useState(initialTo ?? '');
  const [subject, setSubject] = React.useState(`Bill ${billNo}`);
  const [message, setMessage] = React.useState(
    `Hi,\n\nFor your records, please find bill ${billNo}.\n\nThanks.`,
  );

  React.useEffect(() => {
    if (open) {
      setTo(initialTo ?? '');
      setSubject(`Bill ${billNo}`);
    }
  }, [open, initialTo, billNo]);

  const onSubmit = () => {
    if (!to || !subject) {
      toast({
        title: 'Missing field',
        description: 'Recipient and subject are required.',
        variant: 'destructive',
      });
      return;
    }
    // No server-side email endpoint for bills today — just open the
    // user's mail client with a prefilled mailto: link. Persisting +
    // audit-emailing is queued behind the SMTP work.
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = mailto;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email bill</DialogTitle>
          <DialogDescription>
            Opens your mail client with the bill details prefilled.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="email-to">Recipient</Label>
            <Input
              id="email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1.5"
              placeholder="vendor@example.com"
            />
          </div>
          <div>
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="email-message">Message</Label>
            <Textarea
              id="email-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>Open email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BillMarkPaidDialogProps extends BaseDialogProps {
  onCompleted?: () => void;
}

export function BillMarkPaidDialog({
  open,
  onOpenChange,
  billId,
  onCompleted,
}: BillMarkPaidDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const res = await updateBillStatus(billId, 'paid');
      if (res.success) {
        toast({ title: 'Marked paid' });
        onOpenChange(false);
        onCompleted?.();
        router.refresh();
      } else {
        toast({
          title: 'Update failed',
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
          <DialogTitle>Mark this bill paid?</DialogTitle>
          <DialogDescription>
            Sets the status to <strong>paid</strong>. Use Record payout if
            you need to capture amount, method, and a receipt number.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? 'Saving…' : 'Mark paid'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
