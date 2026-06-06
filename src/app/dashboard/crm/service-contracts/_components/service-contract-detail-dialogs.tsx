'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';

/**
 * Service-contract detail dialogs:
 *   • <ServiceContractScheduleDialog> — pick date + technician.
 *   • <ServiceContractRenewDialog>    — pick new period.
 *   • <ServiceContractSendDialog>     — open mail-client with prefilled message.
 */

import * as React from 'react';

import {
  renewServiceContract,
  scheduleServiceVisit,
} from '@/app/actions/crm-service-contracts.actions';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
}

export function ServiceContractScheduleDialog({
  open,
  onOpenChange,
  contractId,
}: BaseDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [date, setDate] = React.useState('');
  const [technician, setTechnician] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setDate(d.toISOString().slice(0, 16));
      setTechnician('');
    }
  }, [open]);

  const onSubmit = () => {
    if (!date) {
      toast({
        title: 'Date required',
        description: 'Pick the visit date.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await scheduleServiceVisit(
        contractId,
        new Date(date).toISOString(),
        technician,
      );
      if (res.success) {
        toast({ title: 'Visit scheduled' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Schedule failed',
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
          <DialogTitle>Schedule a service visit</DialogTitle>
          <DialogDescription>
            Adds the visit to the contract&apos;s visit schedule.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="sched-date">Visit date</Label>
            <Input
              id="sched-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="sched-tech">Technician</Label>
            <Input
              id="sched-tech"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              className="mt-1.5"
              placeholder="Technician name"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ServiceContractRenewDialogProps extends BaseDialogProps {
  initialEnd?: string;
}

export function ServiceContractRenewDialog({
  open,
  onOpenChange,
  contractId,
  initialEnd,
}: ServiceContractRenewDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      const start = initialEnd ? new Date(initialEnd) : new Date();
      if (Number.isNaN(start.getTime())) start.setTime(Date.now());
      setStartDate(start.toISOString().slice(0, 10));
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      setEndDate(end.toISOString().slice(0, 10));
    }
  }, [open, initialEnd]);

  const onSubmit = () => {
    if (!startDate || !endDate) {
      toast({
        title: 'Date range required',
        description: 'Pick both dates.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await renewServiceContract(contractId, {
        startDate,
        endDate,
      });
      if (res.success) {
        toast({ title: 'Renewed' });
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
          <DialogTitle>Renew service contract</DialogTitle>
          <DialogDescription>
            Extends the coverage window. The contract is marked active again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="renew-start">New start date</Label>
            <Input
              id="renew-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="renew-end">New end date</Label>
            <Input
              id="renew-end"
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

interface ServiceContractSendDialogProps extends BaseDialogProps {
  initialEmail?: string;
}

export function ServiceContractSendDialog({
  open,
  onOpenChange,
  contractId,
  initialEmail,
}: ServiceContractSendDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = React.useState(initialEmail ?? '');
  const [message, setMessage] = React.useState(
    'Please find your service contract details attached.',
  );

  React.useEffect(() => {
    if (open) setTo(initialEmail ?? '');
  }, [open, initialEmail]);

  const onSubmit = () => {
    if (!to) {
      toast({
        title: 'Recipient required',
        description: 'Enter an email.',
        variant: 'destructive',
      });
      return;
    }
    const subject = `Service contract #${contractId.slice(-6)}`;
    window.open(
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
    onOpenChange(false);
    /* TODO 1D.2: transactional service-contract email needs server-side endpoint */
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send contract to customer</DialogTitle>
          <DialogDescription>
            Opens your mail client with the message pre-filled.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="sc-to">Recipient email</Label>
            <Input
              id="sc-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1.5"
              placeholder="customer@example.com"
            />
          </div>
          <div>
            <Label htmlFor="sc-msg">Message</Label>
            <Textarea
              id="sc-msg"
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
          <Button onClick={onSubmit}>Open mail client</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
