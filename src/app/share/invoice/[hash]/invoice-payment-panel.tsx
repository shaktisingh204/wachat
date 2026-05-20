'use client';

/**
 * Invoice payment panel — opens a drawer with gateway options:
 *  - Stripe / Razorpay / PayPal — stubbed via `startGatewayCheckout`.
 *  - Offline — uploads optional bill proof + notes, calls
 *    `recordOfflinePayment` to flip the invoice to Pending-Confirmation.
 *
 * Per the SabFiles policy, bill proof URL comes from the SabFile picker
 * (no free-text URL input). The picker drops a fully qualified URL.
 */

import * as React from 'react';
import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDrawer,
  ZoruDrawerClose,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
} from '@/components/zoruui';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  recordOfflinePayment,
  startGatewayCheckout,
} from '@/app/actions/public-invoice.actions';

type Props = {
  hash: string;
  status: string;
  totalDue: number;
  currency: string;
  isUnpaid: boolean;
};

type Banner = { kind: 'success' | 'error'; message: string } | null;

export function InvoicePaymentPanel({
  hash,
  status,
  totalDue,
  currency,
  isUnpaid,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState<string>(totalDue.toFixed(2));
  const [notes, setNotes] = React.useState('');
  const [billUrl, setBillUrl] = React.useState<string | undefined>(undefined);
  const [pending, startTransition] = React.useTransition();
  const [banner, setBanner] = React.useState<Banner>(null);

  const handleGateway = (gateway: 'stripe' | 'razorpay' | 'paypal') => {
    startTransition(async () => {
      const result = await startGatewayCheckout(hash, gateway);
      setBanner(
        result.success
          ? { kind: 'success', message: result.message || 'Redirecting…' }
          : { kind: 'error', message: result.error },
      );
    });
  };

  const handleOfflineSubmit = () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setBanner({ kind: 'error', message: 'Enter a valid amount.' });
      return;
    }
    startTransition(async () => {
      const result = await recordOfflinePayment(hash, parsed, notes, billUrl);
      if (result.success) {
        setBanner({ kind: 'success', message: result.message || 'Payment recorded.' });
        setOpen(false);
      } else {
        setBanner({ kind: 'error', message: result.error });
      }
    });
  };

  if (!isUnpaid) {
    return (
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Payment</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <p className="text-sm text-zinc-600">
            {status === 'Paid'
              ? 'This invoice has been paid in full. Thank you!'
              : status === 'Pending-Confirmation'
                ? 'A payment has been submitted and is awaiting confirmation by the merchant.'
                : `Current status: ${status}.`}
          </p>
          <DownloadPdfButton hash={hash} />
        </ZoruCardContent>
      </ZoruCard>
    );
  }

  return (
    <ZoruCard>
      <ZoruCardHeader className="flex flex-row items-center justify-between">
        <ZoruCardTitle>Pay this invoice</ZoruCardTitle>
        <DownloadPdfButton hash={hash} />
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-3">
        {banner ? (
          <ZoruAlert variant={banner.kind === 'success' ? 'default' : 'destructive'}>
            <ZoruAlertDescription>{banner.message}</ZoruAlertDescription>
          </ZoruAlert>
        ) : null}
        <p className="text-sm text-zinc-600">
          Choose a payment method below to settle this invoice.
        </p>
        <ZoruDrawer open={open} onOpenChange={setOpen}>
          <ZoruButton onClick={() => setOpen(true)} disabled={pending}>
            Pay Now
          </ZoruButton>
          <ZoruDrawerContent>
            <ZoruDrawerHeader>
              <ZoruDrawerTitle>Pay invoice</ZoruDrawerTitle>
              <ZoruDrawerDescription>
                Total due: {formatMoney(totalDue, currency)}
              </ZoruDrawerDescription>
            </ZoruDrawerHeader>
            <div className="space-y-4 px-6 pb-6">
              {banner ? (
                <ZoruAlert variant={banner.kind === 'success' ? 'default' : 'destructive'}>
                  <ZoruAlertDescription>{banner.message}</ZoruAlertDescription>
                </ZoruAlert>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ZoruButton
                  variant="outline"
                  onClick={() => handleGateway('stripe')}
                  disabled={pending}
                >
                  Stripe
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  onClick={() => handleGateway('razorpay')}
                  disabled={pending}
                >
                  Razorpay
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  onClick={() => handleGateway('paypal')}
                  disabled={pending}
                >
                  PayPal
                </ZoruButton>
              </div>

              <div className="rounded-md border border-zinc-200 p-3">
                <h4 className="mb-2 text-sm font-semibold">Pay offline</h4>
                <div className="space-y-3">
                  <div>
                    <ZoruLabel htmlFor="offline-amount">Amount paid</ZoruLabel>
                    <ZoruInput
                      id="offline-amount"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <ZoruLabel htmlFor="offline-notes">Notes</ZoruLabel>
                    <ZoruTextarea
                      id="offline-notes"
                      placeholder="Reference number, transfer date, etc."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div>
                    <ZoruLabel>Bill proof (optional)</ZoruLabel>
                    <SabFilePickerButton
                      onPick={(pick) => setBillUrl(pick?.url)}
                    >
                      {billUrl ? 'Replace file' : 'Attach proof from SabFiles'}
                    </SabFilePickerButton>
                    {billUrl ? (
                      <p className="mt-1 text-xs text-zinc-500">Attached.</p>
                    ) : null}
                  </div>
                  <ZoruButton onClick={handleOfflineSubmit} disabled={pending} block>
                    {pending ? 'Submitting…' : 'Submit offline payment'}
                  </ZoruButton>
                </div>
              </div>

              <ZoruDrawerClose asChild>
                <ZoruButton variant="ghost" block>
                  Cancel
                </ZoruButton>
              </ZoruDrawerClose>
            </div>
          </ZoruDrawerContent>
        </ZoruDrawer>
      </ZoruCardContent>
    </ZoruCard>
  );
}

function DownloadPdfButton({ hash }: { hash: string }) {
  return (
    <a
      href={`/share/invoice/${hash}/download`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center text-sm text-zinc-700 underline-offset-2 hover:underline"
    >
      Download PDF
    </a>
  );
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
