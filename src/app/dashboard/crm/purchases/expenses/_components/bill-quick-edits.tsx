'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Label,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';

/**
 * <BillQuickEdits> — inline status + vendor chips on the bill detail
 * "At a glance" card.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { patchBill, updateBillStatus } from '@/app/actions/crm/bills.actions';
import type { CrmBillStatus } from '@/lib/rust-client/crm-bills';

const STATUS_OPTIONS: { value: CrmBillStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface BillQuickEditsProps {
  billId: string;
  status?: string;
  vendorId?: string | null;
}

export function BillQuickEdits({
  billId,
  status,
  vendorId,
}: BillQuickEditsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

  const [currentStatus, setCurrentStatus] = React.useState(status ?? 'draft');
  const [currentVendor, setCurrentVendor] = React.useState<string | null>(
    vendorId ?? null,
  );
  const [vendorOpen, setVendorOpen] = React.useState(false);
  const [draftVendor, setDraftVendor] = React.useState<string | null>(
    vendorId ?? null,
  );

  React.useEffect(() => setCurrentStatus(status ?? 'draft'), [status]);
  React.useEffect(() => setCurrentVendor(vendorId ?? null), [vendorId]);

  const changeStatus = (next: string) => {
    if (next === currentStatus) return;
    const prev = currentStatus;
    setCurrentStatus(next);
    updateBillStatus(billId, next).then((res) => {
      if (!res.success) {
        setCurrentStatus(prev);
        toast({
          title: 'Status change failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: `Status set to ${next.replace(/_/g, ' ')}` });
      router.refresh();
    });
  };

  const commitVendor = () => {
    if (!draftVendor) {
      toast({
        title: 'Vendor required',
        description: 'Bills must have a vendor.',
        variant: 'destructive',
      });
      return;
    }
    const prev = currentVendor;
    setCurrentVendor(draftVendor);
    setVendorOpen(false);
    patchBill(billId, { vendorId: draftVendor }).then((res) => {
      if (!res.success) {
        setCurrentVendor(prev);
        toast({
          title: 'Vendor change failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Vendor updated' });
      router.refresh();
    });
  };

  return (
    <>
      <dl className="space-y-2 text-[12.5px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zoru-ink-muted">Status</dt>
          <dd>
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full transition-opacity hover:opacity-80"
                  aria-label="Change status"
                >
                  <StatusPill
                    label={currentStatus.replace(/_/g, ' ')}
                    tone={statusToTone(currentStatus)}
                  />
                </button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent>
                {STATUS_OPTIONS.map((s) => (
                  <ZoruDropdownMenuItem
                    key={s.value}
                    onSelect={() => changeStatus(s.value)}
                  >
                    {s.label}
                  </ZoruDropdownMenuItem>
                ))}
              </ZoruDropdownMenuContent>
            </DropdownMenu>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zoru-ink-muted">Vendor</dt>
          <dd>
            <button
              type="button"
              className="rounded transition-opacity hover:opacity-80"
              onClick={() => {
                setDraftVendor(currentVendor);
                setVendorOpen(true);
              }}
              aria-label="Change vendor"
            >
              {currentVendor ? (
                <EntityPickerChip entity="vendor" id={currentVendor} />
              ) : (
                <span className="text-zoru-ink-muted underline-offset-2 hover:underline">
                  — set vendor
                </span>
              )}
            </button>
          </dd>
        </div>
      </dl>

      <Dialog open={vendorOpen} onOpenChange={setVendorOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Change vendor</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Vendor</Label>
            <EntityFormField
              entity="vendor"
              name="_vendor"
              initialId={draftVendor}
              onChange={(next) => setDraftVendor(next)}
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setVendorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={commitVendor}>Save</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </>
  );
}
