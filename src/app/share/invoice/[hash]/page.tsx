import * as React from 'react';
import { notFound } from 'next/navigation';
import {
  capturePayPalPayment,
  getPublicInvoice,
  markInvoiceViewed,
} from '@/app/actions/public-invoice.actions';
import { Badge, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { InvoicePaymentPanel } from './invoice-payment-panel';
import { fmtDate, fmtINR } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Params = Promise<{ hash: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type InitialBanner = { kind: 'success' | 'error' | 'warning' | 'info'; message: string } | undefined;

function pickParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = searchParams[key];
  return Array.isArray(v) ? v[0] : v;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Paid: 'default',
  Unpaid: 'destructive',
  Partial: 'secondary',
  'Pending-Confirmation': 'outline',
  Draft: 'outline',
};

async function PublicInvoiceContainer({ hash, searchParamsMap }: { hash: string; searchParamsMap: Record<string, string | string[] | undefined> }) {
  const paid = pickParam(searchParamsMap, 'paid');
  const cancelled = pickParam(searchParamsMap, 'cancelled');
  const paypalToken = pickParam(searchParamsMap, 'token');

  let invoice = await getPublicInvoice(hash);
  if (!invoice) notFound();

  let initialBanner: InitialBanner;
  if (paid === 'paypal' && paypalToken) {
    const res = await capturePayPalPayment(hash, paypalToken);
    initialBanner = res.success
      ? { kind: 'success', message: res.message || 'Payment received. Thank you!' }
      : { kind: 'error', message: res.error };
    // Refetch to get the updated status
    invoice = await getPublicInvoice(hash);
    if (!invoice) notFound();
  } else if (paid === 'stripe' || paid === 'razorpay') {
    if (invoice.status === 'Paid') {
      initialBanner = {
        kind: 'success',
        message: 'Payment captured successfully. Thank you!',
      };
    } else {
      initialBanner = {
        kind: 'warning',
        message: 'Payment received and is currently processing. It may take a moment to reflect here.',
      };
    }
  } else if (cancelled === '1') {
    initialBanner = { kind: 'error', message: 'Payment cancelled or failed.' };
  }

  // Fire-and-forget view tracking; never blocks render.
  void markInvoiceViewed(hash);

  const isUnpaid = invoice.status === 'Unpaid' || invoice.status === 'Partial';

  return (
    <div className="space-y-6">
      <Card>
        <ZoruCardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <ZoruCardTitle>Invoice {invoice.invoiceNumber}</ZoruCardTitle>
            <p className="mt-1 text-sm text-zoru-ink">
              Issued {fmtDate(invoice.invoiceDate)} &middot; Due {fmtDate(invoice.dueDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[invoice.status] || 'outline'}>{invoice.status}</Badge>
            <a
              href={`/share/invoice/${hash}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-zoru-line bg-white px-3 py-1.5 text-xs font-medium text-zoru-ink shadow-sm hover:bg-zoru-surface-2"
            >
              Download PDF
            </a>
          </div>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-6">
          {invoice.billTo.name || invoice.billTo.email || invoice.billTo.address ? (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zoru-ink">
                Bill to
              </h3>
              <div className="text-sm">
                {invoice.billTo.name ? (
                  <div className="font-medium">{invoice.billTo.name}</div>
                ) : null}
                {invoice.billTo.email ? (
                  <div className="text-zoru-ink">{invoice.billTo.email}</div>
                ) : null}
                {invoice.billTo.address ? (
                  <div className="text-zoru-ink">{invoice.billTo.address}</div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zoru-ink">
              Line items
            </h3>
            <div className="overflow-x-auto rounded-md border border-zoru-line">
              <table className="min-w-full divide-y divide-zoru-line text-sm">
                <thead className="bg-zoru-surface-2 text-left text-xs uppercase text-zoru-ink">
                  <tr>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zoru-line bg-white">
                  {invoice.lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-zoru-ink-muted">
                        No line items.
                      </td>
                    </tr>
                  ) : (
                    invoice.lineItems.map((li, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{li.description || li.name || '—'}</td>
                        <td className="px-3 py-2 text-right">{li.quantity}</td>
                        <td className="px-3 py-2 text-right">
                          {fmtINR(li.rate)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {fmtINR(li.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col items-end gap-1 text-sm">
            <div className="flex w-full max-w-xs justify-between text-zoru-ink">
              <span>Subtotal</span>
              <span>{fmtINR(invoice.subtotal)}</span>
            </div>
            {typeof invoice.tax === 'number' ? (
              <div className="flex w-full max-w-xs justify-between text-zoru-ink">
                <span>Tax</span>
                <span>{fmtINR(invoice.tax)}</span>
              </div>
            ) : null}
            {typeof invoice.discount === 'number' ? (
              <div className="flex w-full max-w-xs justify-between text-zoru-ink">
                <span>Discount</span>
                <span>-{fmtINR(invoice.discount)}</span>
              </div>
            ) : null}
            <div className="flex w-full max-w-xs justify-between border-t border-zoru-line pt-1 text-base font-semibold">
              <span>Total</span>
              <span>{fmtINR(invoice.total)}</span>
            </div>
          </section>

          {invoice.notes ? (
            <section className="rounded-md bg-zoru-surface-2 p-3 text-sm text-zoru-ink">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zoru-ink">
                Notes
              </h3>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </section>
          ) : null}
        </ZoruCardContent>
      </Card>

      <InvoicePaymentPanel
        hash={hash}
        status={invoice.status}
        totalDue={invoice.total}
        currency={invoice.currency}
        isUnpaid={isUnpaid}
        initialBanner={initialBanner ?? null}
      />
    </div>
  );
}

export default async function PublicInvoicePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { hash } = await params;
  const sp = await searchParams;

  return (
    <React.Suspense fallback={<div>Loading invoice...</div>}>
      <PublicInvoiceContainer hash={hash} searchParamsMap={sp} />
    </React.Suspense>
  );
}
