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
 * PO detail-page dialogs.
 *
 *   • <PurchaseOrderEmailDialog> — compose + send. Wires
 *     `sendPurchaseOrderEmail` server action which marks the PO `sent`
 *     and writes an audit row.
 *   • <PurchaseOrderWhatsAppDialog> — opens wa.me deep link with
 *     prefilled text. No server-side state change.
 *   • <PurchaseOrderApproveDialog> — convenience for the "Approve"
 *     header action; advances status to `approved`.
 */

import * as React from 'react';

import {
  approvePurchaseOrder,
  sendPurchaseOrderEmail,
} from '@/app/actions/crm/purchase-orders.actions';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string;
}

interface PurchaseOrderEmailDialogProps extends BaseDialogProps {
  poNo: string;
  initialTo?: string;
}

export function PurchaseOrderEmailDialog({
  open,
  onOpenChange,
  poId,
  poNo,
  initialTo,
}: PurchaseOrderEmailDialogProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [to, setTo] = React.useState(initialTo ?? '');
  const [subject, setSubject] = React.useState(`Purchase order ${poNo}`);
  const [message, setMessage] = React.useState(
    `Hi,\n\nPlease find attached purchase order ${poNo}.\n\nThanks.`,
  );
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setTo(initialTo ?? '');
      setSubject(`Purchase order ${poNo}`);
    }
  }, [open, initialTo, poNo]);

  const onSubmit = () => {
    if (!to || !subject) {
      toast({
        title: 'Missing field',
        description: 'Recipient and subject are required.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await sendPurchaseOrderEmail({ poId, to, subject, message });
      if (res.success) {
        toast({ title: 'Email queued', description: `Sent to ${to}` });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Send failed',
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
          <ZoruDialogTitle>Email purchase order</ZoruDialogTitle>
          <ZoruDialogDescription>
            Marks this purchase order as sent and queues the email.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="po-email-to">Recipient</ZoruLabel>
            <ZoruInput
              id="po-email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1.5"
              placeholder="vendor@example.com"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="po-email-subject">Subject</ZoruLabel>
            <ZoruInput
              id="po-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="po-email-message">Message</ZoruLabel>
            <ZoruTextarea
              id="po-email-message"
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
          <ZoruButton onClick={onSubmit} disabled={pending}>
            {pending ? 'Sending…' : 'Send'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

interface PurchaseOrderWhatsAppDialogProps extends BaseDialogProps {
  poNo: string;
  initialPhone?: string;
}

export function PurchaseOrderWhatsAppDialog({
  open,
  onOpenChange,
  poNo,
  initialPhone,
}: PurchaseOrderWhatsAppDialogProps) {
  const [phone, setPhone] = React.useState(initialPhone ?? '');
  const [message, setMessage] = React.useState(
    `Hi! Please find purchase order ${poNo} for your reference.`,
  );

  React.useEffect(() => {
    if (open) setPhone(initialPhone ?? '');
  }, [open, initialPhone]);

  const onSubmit = () => {
    const clean = phone.replace(/[^\d]/g, '');
    if (!clean) return;
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onOpenChange(false);
  };

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Send via WhatsApp</ZoruDialogTitle>
          <ZoruDialogDescription>
            Opens wa.me with the message prefilled.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="po-wa-phone">
              Phone (with country code)
            </ZoruLabel>
            <ZoruInput
              id="po-wa-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5"
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="po-wa-message">Message</ZoruLabel>
            <ZoruTextarea
              id="po-wa-message"
              rows={3}
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
          <ZoruButton onClick={onSubmit}>Open WhatsApp</ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

interface PurchaseOrderApproveDialogProps extends BaseDialogProps {
  onCompleted?: () => void;
}

export function PurchaseOrderApproveDialog({
  open,
  onOpenChange,
  poId,
  onCompleted,
}: PurchaseOrderApproveDialogProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [pending, startTransition] = React.useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const res = await approvePurchaseOrder(poId);
      if (res.success) {
        toast({ title: 'Approved' });
        onOpenChange(false);
        onCompleted?.();
        router.refresh();
      } else {
        toast({
          title: 'Approval failed',
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
          <ZoruDialogTitle>Approve this purchase order?</ZoruDialogTitle>
          <ZoruDialogDescription>
            Advances the status to <strong>approved</strong>, signalling
            that procurement is cleared to send the PO to the vendor.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <ZoruDialogFooter>
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={onConfirm} disabled={pending}>
            {pending ? 'Saving…' : 'Approve'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
