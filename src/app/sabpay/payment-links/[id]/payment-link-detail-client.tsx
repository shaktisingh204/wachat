'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';

import { cancelSabpayPaymentLink } from '../../actions/payment-links';
import { ConfirmAction } from '../../_components/confirm-action';

/**
 * "Cancel link" header action for the payment-link detail page. Renders
 * nothing once the link is no longer cancellable (paid/cancelled/expired).
 */
export function PaymentLinkCancelAction({
  id,
  status,
}: {
  id: string;
  status: string;
}): React.JSX.Element | null {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  if (status !== 'created') return null;

  async function handleConfirm() {
    const result = await cancelSabpayPaymentLink(id);
    if (result.error || !result.paymentLink) {
      const message = result.error || 'Could not cancel the payment link.';
      toast({ title: 'Cancel failed', description: message, tone: 'danger' });
      throw new Error(message);
    }
    toast({ title: 'Payment link cancelled', tone: 'success' });
    router.refresh();
  }

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        iconLeft={<XCircle size={14} />}
        onClick={() => setOpen(true)}
      >
        Cancel link
      </Button>
      <ConfirmAction
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="Cancel this payment link?"
        description={`${id} will stop accepting payments immediately. This cannot be undone.`}
        confirmLabel="Cancel link"
      />
    </>
  );
}
