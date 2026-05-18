'use client';

import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
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
  const { toast } = useZoruToast();
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
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Email bill</ZoruDialogTitle>
          <ZoruDialogDescription>
            Opens your mail client with the bill details prefilled.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="email-to">Recipient</ZoruLabel>
            <ZoruInput
              id="email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1.5"
              placeholder="vendor@example.com"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="email-subject">Subject</ZoruLabel>
            <ZoruInput
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="email-message">Message</ZoruLabel>
            <ZoruTextarea
              id="email-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={onSubmit}>Open email</ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
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
  const { toast } = useZoruToast();
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
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Mark this bill paid?</ZoruDialogTitle>
          <ZoruDialogDescription>
            Sets the status to <strong>paid</strong>. Use Record payout if
            you need to capture amount, method, and a receipt number.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <ZoruDialogFooter>
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={onConfirm} disabled={pending}>
            {pending ? 'Saving…' : 'Mark paid'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
