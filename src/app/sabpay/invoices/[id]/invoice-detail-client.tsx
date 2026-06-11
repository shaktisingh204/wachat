'use client';

/**
 * Header actions for `/sabpay/invoices/[id]` — the only mutating bits of the
 * detail page. Drafts get Issue + Delete; issued-but-unpaid invoices get
 * Cancel. Every action confirms via `ConfirmAction` before calling its server
 * action, then refreshes (or navigates back to the list after a delete).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Send, Trash2, XCircle } from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import type { SabpayInvoice } from '@/lib/sabpay/types';

import { ConfirmAction } from '../../_components/confirm-action';
import {
  cancelSabpayInvoice,
  deleteSabpayInvoice,
  issueSabpayInvoice,
} from '../../actions/invoices';

type InvoiceAction = 'issue' | 'delete' | 'cancel';

const CONFIRM_COPY: Record<
  InvoiceAction,
  { title: string; description: string; confirmLabel: string; tone: 'primary' | 'danger' }
> = {
  issue: {
    title: 'Issue this invoice?',
    description:
      'Issuing locks the line items and creates a payable link your customer can use right away.',
    confirmLabel: 'Issue invoice',
    tone: 'primary',
  },
  delete: {
    title: 'Delete this draft?',
    description: 'The draft and its line items are removed permanently. This cannot be undone.',
    confirmLabel: 'Delete draft',
    tone: 'danger',
  },
  cancel: {
    title: 'Cancel this invoice?',
    description:
      'The payable link stops working immediately and the invoice cannot be reopened.',
    confirmLabel: 'Cancel invoice',
    tone: 'danger',
  },
};

export function InvoiceDetailClient({
  invoice,
}: {
  invoice: SabpayInvoice;
}): React.JSX.Element | null {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState<InvoiceAction | null>(null);

  const isDraft = invoice.status === 'draft';
  const isCancellable = invoice.status === 'issued' && !invoice.paidAt;
  if (!isDraft && !isCancellable) return null;

  async function run(action: InvoiceAction) {
    if (action === 'issue') {
      const res = await issueSabpayInvoice(invoice.id);
      if (res.error || !res.invoice) {
        toast({ title: 'Could not issue the invoice', description: res.error, tone: 'danger' });
        return;
      }
      toast({
        title: 'Invoice issued',
        description: 'Your customer can now pay it at its payable link.',
        tone: 'success',
      });
      router.refresh();
      return;
    }
    if (action === 'delete') {
      const res = await deleteSabpayInvoice(invoice.id);
      if (res.error || !res.ok) {
        toast({ title: 'Could not delete the draft', description: res.error, tone: 'danger' });
        return;
      }
      toast({ title: 'Draft deleted', tone: 'success' });
      router.push('/sabpay/invoices');
      router.refresh();
      return;
    }
    const res = await cancelSabpayInvoice(invoice.id);
    if (res.error || !res.invoice) {
      toast({ title: 'Could not cancel the invoice', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Invoice cancelled', tone: 'success' });
    router.refresh();
  }

  const copy = confirming ? CONFIRM_COPY[confirming] : null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {isDraft ? (
          <>
            <Button
              variant="ghost"
              iconLeft={<Trash2 size={15} />}
              onClick={() => setConfirming('delete')}
            >
              Delete draft
            </Button>
            <Button
              variant="primary"
              iconLeft={<Send size={15} />}
              onClick={() => setConfirming('issue')}
            >
              Issue invoice
            </Button>
          </>
        ) : (
          <Button
            variant="danger"
            iconLeft={<XCircle size={15} />}
            onClick={() => setConfirming('cancel')}
          >
            Cancel invoice
          </Button>
        )}
      </div>

      {confirming && copy ? (
        <ConfirmAction
          open
          onClose={() => setConfirming(null)}
          onConfirm={() => run(confirming)}
          title={copy.title}
          description={copy.description}
          confirmLabel={copy.confirmLabel}
          tone={copy.tone}
        />
      ) : null}
    </>
  );
}
