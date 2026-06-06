/**
 * Public cancel page — `/pay/[pageSlug]/cancel`.
 *
 * Shown when the payer aborts at the gateway. No-op server-side; the
 * SabCheckout session stays `pending` until either the gateway sends a
 * terminal status or it's swept to `expired`.
 */
export const dynamic = 'force-dynamic';

export default async function PublicCheckoutCancelPage({
  params,
}: {
  params: Promise<{ pageSlug: string }>;
}) {
  const { pageSlug } = await params;
  return (
    <main className="min-h-screen w-full px-4 py-16">
      <div className="mx-auto max-w-md space-y-6 rounded-xl border border-[var(--st-border)] bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Payment cancelled</h1>
        <p className="text-sm text-[var(--st-text)]">
          You closed the payment window before completing the transaction.
          You can try again whenever you're ready.
        </p>
        <a
          href={`/pay/${encodeURIComponent(pageSlug)}`}
          className="inline-block rounded-md bg-[var(--st-text)] px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </a>
      </div>
    </main>
  );
}
