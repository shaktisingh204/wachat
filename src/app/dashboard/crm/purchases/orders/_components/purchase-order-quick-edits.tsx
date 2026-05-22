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
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';

/**
 * <PurchaseOrderQuickEdits> — inline status / buyer / approver / vendor
 * chips on the PO detail "At a glance" card. Each chip opens a small
 * dropdown/dialog, mutates via `updatePurchaseOrderStatus` /
 * `patchPurchaseOrder`, and refreshes the page on success.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
  patchPurchaseOrder,
  updatePurchaseOrderStatus,
} from '@/app/actions/crm/purchase-orders.actions';
import type { CrmPurchaseOrderStatus } from '@/lib/rust-client/crm-purchase-orders';

const STATUS_OPTIONS: { value: CrmPurchaseOrderStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'received', label: 'Received' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface PurchaseOrderQuickEditsProps {
  poId: string;
  status?: string;
  vendorId?: string | null;
  buyerId?: string | null;
  approverId?: string | null;
}

export function PurchaseOrderQuickEdits({
  poId,
  status,
  vendorId,
  buyerId,
  approverId,
}: PurchaseOrderQuickEditsProps) {
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
    updatePurchaseOrderStatus(poId, next).then((res) => {
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
        description: 'Purchase orders must have a vendor.',
        variant: 'destructive',
      });
      return;
    }
    const prev = currentVendor;
    setCurrentVendor(draftVendor);
    setVendorOpen(false);
    patchPurchaseOrder(poId, { vendorId: draftVendor }).then((res) => {
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
            <ZoruDropdownMenu>
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
            </ZoruDropdownMenu>
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
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zoru-ink-muted">Buyer</dt>
          <dd>
            {buyerId ? (
              <EntityPickerChip entity="user" id={buyerId} />
            ) : (
              <span className="text-zoru-ink-muted">—</span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zoru-ink-muted">Approver</dt>
          <dd>
            {approverId ? (
              <EntityPickerChip entity="user" id={approverId} />
            ) : (
              <span className="text-zoru-ink-muted">—</span>
            )}
          </dd>
        </div>
      </dl>

      <ZoruDialog open={vendorOpen} onOpenChange={setVendorOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Change vendor</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-2 py-2">
            <ZoruLabel>Vendor</ZoruLabel>
            <EntityFormField
              entity="vendor"
              name="_vendor"
              initialId={draftVendor}
              onChange={(next) => setDraftVendor(next)}
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setVendorOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={commitVendor}>Save</ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </>
  );
}
