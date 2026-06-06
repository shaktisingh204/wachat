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
 * <InvoiceQuickEdits> — inline status / sales-agent / customer chips
 * on the invoice detail "At a glance" card. Each chip opens a small
 * dropdown/dialog, mutates via `updateInvoiceStatus` / `patchInvoice`,
 * and refreshes the page on success.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
  patchInvoice,
  updateInvoiceStatus,
} from '@/app/actions/crm/invoices.actions';
import type { CrmInvoiceStatus } from '@/lib/rust-client/crm-invoices';

const STATUS_OPTIONS: { value: CrmInvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface InvoiceQuickEditsProps {
  invoiceId: string;
  status?: string;
  customerId?: string | null;
  salesAgentId?: string | null;
}

export function InvoiceQuickEdits({
  invoiceId,
  status,
  customerId,
  salesAgentId,
}: InvoiceQuickEditsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

  const [currentStatus, setCurrentStatus] = React.useState(status ?? 'draft');
  const [currentCustomer, setCurrentCustomer] = React.useState<string | null>(
    customerId ?? null,
  );
  const [customerOpen, setCustomerOpen] = React.useState(false);
  const [draftCustomer, setDraftCustomer] = React.useState<string | null>(
    customerId ?? null,
  );

  React.useEffect(
    () => setCurrentStatus(status ?? 'draft'),
    [status],
  );
  React.useEffect(
    () => setCurrentCustomer(customerId ?? null),
    [customerId],
  );

  const changeStatus = (next: string) => {
    if (next === currentStatus) return;
    const prev = currentStatus;
    setCurrentStatus(next);
    updateInvoiceStatus(invoiceId, next).then((res) => {
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

  const commitCustomer = () => {
    if (!draftCustomer) {
      toast({
        title: 'Customer required',
        description: 'Invoices must have a customer.',
        variant: 'destructive',
      });
      return;
    }
    const prev = currentCustomer;
    setCurrentCustomer(draftCustomer);
    setCustomerOpen(false);
    patchInvoice(invoiceId, { clientId: draftCustomer }).then((res) => {
      if (!res.success) {
        setCurrentCustomer(prev);
        toast({
          title: 'Customer change failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Customer updated' });
      router.refresh();
    });
  };

  return (
    <>
      <dl className="space-y-2 text-[12.5px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--st-text-secondary)]">Status</dt>
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
          <dt className="text-[var(--st-text-secondary)]">Customer</dt>
          <dd>
            <button
              type="button"
              className="rounded transition-opacity hover:opacity-80"
              onClick={() => {
                setDraftCustomer(currentCustomer);
                setCustomerOpen(true);
              }}
              aria-label="Change customer"
            >
              {currentCustomer ? (
                <EntityPickerChip entity="client" id={currentCustomer} />
              ) : (
                <span className="text-[var(--st-text-secondary)] underline-offset-2 hover:underline">
                  — set customer
                </span>
              )}
            </button>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--st-text-secondary)]">Sales agent</dt>
          <dd>
            {salesAgentId ? (
              <EntityPickerChip entity="user" id={salesAgentId} />
            ) : (
              <span className="text-[var(--st-text-secondary)]">—</span>
            )}
          </dd>
        </div>
      </dl>

      <Dialog open={customerOpen} onOpenChange={setCustomerOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Change customer</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Customer</Label>
            <EntityFormField
              entity="client"
              name="_customer"
              initialId={draftCustomer}
              onChange={(next) => setDraftCustomer(next)}
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setCustomerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={commitCustomer}>Save</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </>
  );
}
