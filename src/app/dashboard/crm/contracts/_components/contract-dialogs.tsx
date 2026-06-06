'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';

/**
 * Contract detail-page dialogs.
 *
 *   • <ContractSendDialog> — collect signer name/email, call
 *     sendContractForSignature.
 *   • <ContractRenewDialog> — collect new end date, call renewContract.
 *   • <ContractVoidDialog>  — collect reason, call voidContract.
 */

import * as React from 'react';

import {
  renewContract,
  sendContractForSignature,
  voidContract,
} from '@/app/actions/crm-services.actions';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
}

interface ContractSendDialogProps extends BaseDialogProps {
  initialEmail?: string;
}

export function ContractSendDialog({
  open,
  onOpenChange,
  contractId,
  initialEmail,
}: ContractSendDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState(initialEmail ?? '');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setName('');
      setEmail(initialEmail ?? '');
    }
  }, [open, initialEmail]);

  const onSubmit = () => {
    if (!email.includes('@')) {
      toast({
        title: 'Email required',
        description: 'Enter a valid signer email.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await sendContractForSignature(contractId, [{ name, email }]);
      if (res.success) {
        toast({ title: 'Sent for signature', description: `Signer: ${email}` });
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
          <DialogTitle>Send contract for signature</DialogTitle>
          <DialogDescription>
            Marks the contract as <strong>sent</strong> and stores the signer
            on record.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="signer-name">Signer name</Label>
            <Input
              id="signer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <Label htmlFor="signer-email">Signer email</Label>
            <Input
              id="signer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
              placeholder="jane@example.com"
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

interface ContractRenewDialogProps extends BaseDialogProps {
  initialEndDate?: string;
}

export function ContractRenewDialog({
  open,
  onOpenChange,
  contractId,
  initialEndDate,
}: ContractRenewDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [endDate, setEndDate] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      // Derive a "next year" hint from current end date if available.
      if (initialEndDate) {
        const d = new Date(initialEndDate);
        if (!Number.isNaN(d.getTime())) {
          d.setFullYear(d.getFullYear() + 1);
          setEndDate(d.toISOString().slice(0, 10));
          return;
        }
      }
      const fallback = new Date();
      fallback.setFullYear(fallback.getFullYear() + 1);
      setEndDate(fallback.toISOString().slice(0, 10));
    }
  }, [open, initialEndDate]);

  const onSubmit = () => {
    if (!endDate) {
      toast({
        title: 'Date required',
        description: 'Pick a new end date.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await renewContract(contractId, endDate);
      if (res.success) {
        toast({ title: 'Renewed', description: `New end date: ${endDate}` });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Renew failed',
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
          <DialogTitle>Renew contract</DialogTitle>
          <DialogDescription>
            Extends the contract's end date and resets the status to draft.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="renew-end-date">New end date</Label>
            <Input
              id="renew-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Renew'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContractVoidDialog({
  open,
  onOpenChange,
  contractId,
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
      const res = await voidContract(contractId, reason);
      if (res.success) {
        toast({ title: 'Voided' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Void failed',
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
          <DialogTitle>Void this contract?</DialogTitle>
          <DialogDescription>
            Marks the contract <strong>terminated</strong>. Note the reason so
            the audit log captures it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea
              id="void-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Replaced by amended contract C-2026-014"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={pending}
          >
            {pending ? 'Voiding…' : 'Void'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
