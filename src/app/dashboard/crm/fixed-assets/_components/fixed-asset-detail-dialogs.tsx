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
 * Fixed-asset detail-page dialogs.
 *
 *   • <FixedAssetAssignDialog> — pick an employee, call assignFixedAsset.
 *   • <FixedAssetRetireDialog> — capture retirement date, sale value, and
 *     reason; call retireFixedAsset.
 */

import * as React from 'react';

import { EntityPicker } from '@/components/crm/entity-picker';
import {
  assignFixedAsset,
  retireFixedAsset,
} from '@/app/actions/crm/fixed-assets.actions';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
}

export function FixedAssetAssignDialog({
  open,
  onOpenChange,
  assetId,
}: BaseDialogProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [employeeId, setEmployeeId] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setEmployeeId('');
      setFrom(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const onSubmit = () => {
    if (!employeeId) {
      toast({
        title: 'Employee required',
        description: 'Pick an employee to assign to.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await assignFixedAsset(assetId, employeeId, from);
      if (res.success) {
        toast({ title: 'Assigned' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Assignment failed',
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
          <ZoruDialogTitle>Assign asset</ZoruDialogTitle>
          <ZoruDialogDescription>
            Hand the asset to an employee custodian. The change is audit-logged.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="assign-employee">Custodian</ZoruLabel>
            <div className="mt-1.5">
              <EntityPicker
                entity="employee"
                value={employeeId}
                onChange={(id) =>
                  setEmployeeId(
                    typeof id === 'string' ? id : Array.isArray(id) ? id[0] ?? '' : '',
                  )
                }
                placeholder="Pick an employee…"
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="assign-from">Effective from</ZoruLabel>
            <ZoruInput
              id="assign-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Assign'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

export function FixedAssetRetireDialog({
  open,
  onOpenChange,
  assetId,
}: BaseDialogProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [date, setDate] = React.useState('');
  const [saleValue, setSaleValue] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setSaleValue('');
      setReason('');
    }
  }, [open]);

  const onSubmit = () => {
    if (!date) {
      toast({
        title: 'Date required',
        description: 'Pick a retirement date.',
        variant: 'destructive',
      });
      return;
    }
    if (!reason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Capture the reason for retirement.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await retireFixedAsset(assetId, {
        date,
        saleValue: saleValue ? parseFloat(saleValue) : undefined,
        reason: reason.trim(),
      });
      if (res.success) {
        toast({ title: 'Asset retired' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Retire failed',
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
          <ZoruDialogTitle>Retire / dispose asset</ZoruDialogTitle>
          <ZoruDialogDescription>
            Marks condition <strong>retired</strong>. The accounting entry
            (gain/loss on sale) is posted by the depreciation job.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <ZoruLabel htmlFor="ret-date">Retirement date</ZoruLabel>
            <ZoruInput
              id="ret-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="ret-sale">Sale value (optional)</ZoruLabel>
            <ZoruInput
              id="ret-sale"
              type="number"
              inputMode="decimal"
              value={saleValue}
              onChange={(e) => setSaleValue(e.target.value)}
              className="mt-1.5"
              placeholder="0"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="ret-reason">Reason</ZoruLabel>
            <ZoruTextarea
              id="ret-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. End of useful life — scrapped"
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton
            variant="destructive"
            onClick={onSubmit}
            disabled={pending}
          >
            {pending ? 'Saving…' : 'Retire'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
