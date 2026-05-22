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
  const { toast } = useZoruToast();
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
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Schedule a service visit</ZoruDialogTitle>
          <ZoruDialogDescription>
            Adds the visit to the contract&apos;s visit schedule.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="sched-date">Visit date</ZoruLabel>
            <ZoruInput
              id="sched-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="sched-tech">Technician</ZoruLabel>
            <ZoruInput
              id="sched-tech"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              className="mt-1.5"
              placeholder="Technician name"
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Schedule'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
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
  const { toast } = useZoruToast();
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
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Renew service contract</ZoruDialogTitle>
          <ZoruDialogDescription>
            Extends the coverage window. The contract is marked active again.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="renew-start">New start date</ZoruLabel>
            <ZoruInput
              id="renew-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="renew-end">New end date</ZoruLabel>
            <ZoruInput
              id="renew-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Renew'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
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
  const { toast } = useZoruToast();
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
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Send contract to customer</ZoruDialogTitle>
          <ZoruDialogDescription>
            Opens your mail client with the message pre-filled.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="sc-to">Recipient email</ZoruLabel>
            <ZoruInput
              id="sc-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1.5"
              placeholder="customer@example.com"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="sc-msg">Message</ZoruLabel>
            <ZoruTextarea
              id="sc-msg"
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
          <ZoruButton onClick={onSubmit}>Open mail client</ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
