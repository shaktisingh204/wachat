'use client';

/**
 * Invoice payment panel — opens a drawer with gateway options:
 *  - Stripe — redirects to a Stripe Checkout Session URL.
 *  - Razorpay — opens the Razorpay Checkout modal (loaded on demand).
 *  - PayPal — redirects to the approval URL; capture happens on return
 *    via `?paid=paypal&token=...` (see `page.tsx`).
 *  - Offline — uploads optional bill proof + notes, calls
 *    `recordOfflinePayment` to flip the invoice to Pending-Confirmation.
 *
 * Per the SabFiles policy, bill proof URL comes from the SabFile picker
 * (no free-text URL input). The picker drops a fully qualified URL.
 */

import * as React from 'react';
import {
  Alert,
  ZoruAlertDescription,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDrawer,
  ZoruDrawerClose,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  Input,
  Label,
  Textarea,
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
  initialBanner?: Banner;
};

type Banner = { kind: 'success' | 'error' | 'warning' | 'info'; message: string } | null;

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  order_id: string;
  handler?: (response: Record<string, string>) => void;
  modal?: { ondismiss?: () => void };
  prefill?: { name?: string; email?: string; contact?: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function InvoicePaymentPanel({
  hash,
  status,
  totalDue,
  currency,
  isUnpaid,
  initialBanner,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState<string>(totalDue.toFixed(2));
  const [notes, setNotes] = React.useState('');
  const [billUrl, setBillUrl] = React.useState<string | undefined>(undefined);
  const [pending, startTransition] = React.useTransition();
  const [banner, setBanner] = React.useState<Banner>(initialBanner ?? null);

  const handleGateway = (gateway: 'stripe' | 'razorpay' | 'paypal') => {
    startTransition(async () => {
      const result = await startGatewayCheckout(hash, gateway);
      if (!result.ok) {
        setBanner({ kind: 'error', message: result.error });
        return;
      }
      if (result.provider === 'stripe') {
        setBanner({ kind: 'success', message: 'Redirecting to Stripe…' });
        window.location.href = result.sessionUrl;
        return;
      }
      if (result.provider === 'paypal') {
        setBanner({ kind: 'success', message: 'Redirecting to PayPal…' });
        window.location.href = result.approvalUrl;
        return;
      }
      // Razorpay — open the checkout modal.
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setBanner({
          kind: 'error',
          message: 'Could not load Razorpay. Please try again.',
        });
        return;
      }
      const rzp = new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        name: 'Invoice payment',
        order_id: result.orderId,
        handler: () => {
          // Razorpay's webhook is the source of truth for marking paid.
          window.location.href = `/share/invoice/${hash}?paid=razorpay`;
        },
        modal: {
          ondismiss: () => {
            setBanner({ kind: 'error', message: 'Payment cancelled.' });
          },
        },
      });
      rzp.open();
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
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Payment</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {banner ? (
            <Alert
              variant={
                banner.kind === 'success'
                  ? 'success'
                  : banner.kind === 'error'
                    ? 'destructive'
                    : banner.kind
              }
            >
              <ZoruAlertDescription>{banner.message}</ZoruAlertDescription>
            </Alert>
          ) : null}
          <p className="text-sm text-zinc-600">
            {status === 'Paid'
              ? 'This invoice has been paid in full. Thank you!'
              : status === 'Pending-Confirmation'
                ? 'A payment has been submitted and is awaiting confirmation by the merchant.'
                : `Current status: ${status}.`}
          </p>
          <DownloadPdfButton hash={hash} />
        </ZoruCardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ZoruCardHeader className="flex flex-row items-center justify-between">
        <ZoruCardTitle>Pay this invoice</ZoruCardTitle>
        <DownloadPdfButton hash={hash} />
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-3">
        {banner ? (
          <Alert
            variant={
              banner.kind === 'success'
                ? 'success'
                : banner.kind === 'error'
                  ? 'destructive'
                  : banner.kind
            }
          >
            <ZoruAlertDescription>{banner.message}</ZoruAlertDescription>
          </Alert>
        ) : null}
        <p className="text-sm text-zinc-600">
          Choose a payment method below to settle this invoice.
        </p>
        <ZoruDrawer open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)} disabled={pending}>
            Pay Now
          </Button>
          <ZoruDrawerContent>
            <ZoruDrawerHeader>
              <ZoruDrawerTitle>Pay invoice</ZoruDrawerTitle>
              <ZoruDrawerDescription>
                Total due: {formatMoney(totalDue, currency)}
              </ZoruDrawerDescription>
            </ZoruDrawerHeader>
            <div className="space-y-4 px-6 pb-6">
              {banner ? (
                <Alert
                  variant={
                    banner.kind === 'success'
                      ? 'success'
                      : banner.kind === 'error'
                        ? 'destructive'
                        : banner.kind
                  }
                >
                  <ZoruAlertDescription>{banner.message}</ZoruAlertDescription>
                </Alert>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button
                  variant="outline"
                  onClick={() => handleGateway('stripe')}
                  disabled={pending}
                >
                  Stripe
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleGateway('razorpay')}
                  disabled={pending}
                >
                  Razorpay
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleGateway('paypal')}
                  disabled={pending}
                >
                  PayPal
                </Button>
              </div>

              <div className="rounded-md border border-zinc-200 p-3">
                <h4 className="mb-2 text-sm font-semibold">Pay offline</h4>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="offline-amount">Amount paid</Label>
                    <Input
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
                    <Label htmlFor="offline-notes">Notes</Label>
                    <Textarea
                      id="offline-notes"
                      placeholder="Reference number, transfer date, etc."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Bill proof (optional)</Label>
                    <SabFilePickerButton
                      onPick={(pick) => setBillUrl(pick?.url)}
                    >
                      {billUrl ? 'Replace file' : 'Attach proof from SabFiles'}
                    </SabFilePickerButton>
                    {billUrl ? (
                      <p className="mt-1 text-xs text-zinc-500">Attached.</p>
                    ) : null}
                  </div>
                  <Button onClick={handleOfflineSubmit} disabled={pending} block>
                    {pending ? 'Submitting…' : 'Submit offline payment'}
                  </Button>
                </div>
              </div>

              <ZoruDrawerClose asChild>
                <Button variant="ghost" block>
                  Cancel
                </Button>
              </ZoruDrawerClose>
            </div>
          </ZoruDrawerContent>
        </ZoruDrawer>
      </ZoruCardContent>
    </Card>
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
