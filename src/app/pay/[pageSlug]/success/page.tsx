/**
 * Public success page — `/pay/[pageSlug]/success`.
 *
 * Hit by the gateway after a successful charge. When `?sessionId=…` is
 * present we call `confirmSabcheckoutSession` to flip the SabCheckout
 * record to `completed` (in the MockGateway / dev path this is what
 * actually marks the session done — real gateways do this via webhook).
 */
import { confirmSabcheckoutSession } from '@/app/actions/sabcheckout-public.actions';

export const dynamic = 'force-dynamic';

export default async function PublicCheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ pageSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { pageSlug } = await params;
  const sp = await searchParams;
  const sessionId = typeof sp.sessionId === 'string' ? sp.sessionId : undefined;

  let confirmed = false;
  let paymentRef: string | undefined;
  if (sessionId) {
    const res = await confirmSabcheckoutSession({
      sessionId,
      payload: sp as Record<string, unknown>,
    });
    if (res.ok) {
      confirmed = res.session.status === 'completed';
      paymentRef = res.session.paymentRef;
    }
  }

  return (
    <main className="min-h-screen w-full px-4 py-16">
      <div className="mx-auto max-w-md space-y-6 rounded-xl border border-zoru-line bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-zoru-surface-2">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-6 text-zoru-ink"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">
          {confirmed ? 'Payment received' : 'Thank you'}
        </h1>
        <p className="text-sm text-zoru-ink">
          {confirmed
            ? 'Your payment has been confirmed. A receipt is on its way.'
            : 'We are confirming your payment with the provider.'}
        </p>
        {paymentRef ? (
          <p className="font-mono text-xs text-zoru-ink-muted">Ref: {paymentRef}</p>
        ) : null}
        <a
          href={`/pay/${encodeURIComponent(pageSlug)}`}
          className="inline-block text-sm text-zoru-ink underline-offset-4 hover:underline"
        >
          Back to checkout
        </a>
      </div>
    </main>
  );
}
