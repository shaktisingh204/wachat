'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';

/**
 * Invoice detail-page dialogs.
 *
 *   • <InvoiceEmailDialog> — compose + send. Wires `sendInvoiceEmail`
 *     server action which marks the invoice `sent` and writes an audit
 *     row.
 *   • <InvoiceWhatsAppDialog> — opens wa.me deep link with prefilled
 *     text. No server-side state change.
 *   • <InvoiceMarkPaidDialog> — convenience for the "Mark paid" header
 *     action; sets status and toasts.
 */

import * as React from 'react';

import {
  sendInvoiceEmail,
  updateInvoiceStatus,
} from '@/app/actions/crm/invoices.actions';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
}

interface InvoiceEmailDialogProps extends BaseDialogProps {
  invoiceNo: string;
  initialTo?: string;
}

export function InvoiceEmailDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNo,
  initialTo,
}: InvoiceEmailDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [to, setTo] = React.useState(initialTo ?? '');
  const [subject, setSubject] = React.useState(`Invoice ${invoiceNo}`);
  const [message, setMessage] = React.useState(
    `Hi,\n\nPlease find attached invoice ${invoiceNo}.\n\nThanks.`,
  );
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setTo(initialTo ?? '');
      setSubject(`Invoice ${invoiceNo}`);
    }
  }, [open, initialTo, invoiceNo]);

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
      const res = await sendInvoiceEmail({ invoiceId, to, subject, message });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email invoice</DialogTitle>
          <DialogDescription>
            Marks this invoice as sent and queues the email.
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
              placeholder="customer@example.com"
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
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface InvoiceWhatsAppDialogProps extends BaseDialogProps {
  invoiceNo: string;
  initialPhone?: string;
}

export function InvoiceWhatsAppDialog({
  open,
  onOpenChange,
  invoiceNo,
  initialPhone,
}: InvoiceWhatsAppDialogProps) {
  const [phone, setPhone] = React.useState(initialPhone ?? '');
  const [message, setMessage] = React.useState(
    `Hi! Please find invoice ${invoiceNo} for your reference.`,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send via WhatsApp</DialogTitle>
          <DialogDescription>
            Opens wa.me with the message prefilled.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="wa-phone">Phone (with country code)</Label>
            <Input
              id="wa-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5"
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <Label htmlFor="wa-message">Message</Label>
            <Textarea
              id="wa-message"
              rows={3}
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
          <Button onClick={onSubmit}>Open WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface InvoiceMarkPaidDialogProps extends BaseDialogProps {
  onCompleted?: () => void;
}

export function InvoiceMarkPaidDialog({
  open,
  onOpenChange,
  invoiceId,
  onCompleted,
}: InvoiceMarkPaidDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const res = await updateInvoiceStatus(invoiceId, 'paid');
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
          <DialogTitle>Mark this invoice paid?</DialogTitle>
          <DialogDescription>
            Sets the status to <strong>paid</strong>. Use Record payment if you
            need to capture amount, method, and a receipt number.
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
