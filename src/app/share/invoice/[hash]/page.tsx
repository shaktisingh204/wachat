import * as React from 'react';
import { notFound } from 'next/navigation';
import { Download } from 'lucide-react';
import {
  capturePayPalPayment,
  getPublicInvoice,
  markInvoiceViewed,
} from '@/app/actions/public-invoice.actions';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
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

const STATUS_TONE: Record<string, BadgeTone> = {
  Paid: 'success',
  Unpaid: 'danger',
  Partial: 'warning',
  'Pending-Confirmation': 'info',
  Draft: 'neutral',
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
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Invoice {invoice.invoiceNumber}</CardTitle>
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
              Issued {fmtDate(invoice.invoiceDate)} &middot; Due {fmtDate(invoice.dueDate)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[invoice.status] || 'neutral'}>{invoice.status}</Badge>
            <a
              href={`/share/invoice/${hash}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--st-text)] underline-offset-2 hover:underline"
            >
              <Download size={14} aria-hidden="true" />
              Download PDF
            </a>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">
          {invoice.billTo.name || invoice.billTo.email || invoice.billTo.address ? (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Bill to
              </h3>
              <div className="text-sm">
                {invoice.billTo.name ? (
                  <div className="font-medium text-[var(--st-text)]">{invoice.billTo.name}</div>
                ) : null}
                {invoice.billTo.email ? (
                  <div className="text-[var(--st-text-secondary)]">{invoice.billTo.email}</div>
                ) : null}
                {invoice.billTo.address ? (
                  <div className="text-[var(--st-text-secondary)]">{invoice.billTo.address}</div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Line items
            </h3>
            <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table density="compact">
                <THead>
                  <Tr>
                    <Th>Description</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Rate</Th>
                    <Th align="right">Amount</Th>
                  </Tr>
                </THead>
                <TBody>
                  {invoice.lineItems.length === 0 ? (
                    <Tr>
                      <Td colSpan={4} align="center" className="text-[var(--st-text-secondary)]">
                        No line items.
                      </Td>
                    </Tr>
                  ) : (
                    invoice.lineItems.map((li, idx) => (
                      <Tr key={idx}>
                        <Td>{li.description || li.name || '-'}</Td>
                        <Td align="right">{li.quantity}</Td>
                        <Td align="right">{fmtINR(li.rate)}</Td>
                        <Td align="right">{fmtINR(li.total)}</Td>
                      </Tr>
                    ))
                  )}
                </TBody>
              </Table>
            </div>
          </section>

          <section className="flex flex-col items-end gap-1 text-sm">
            <div className="flex w-full max-w-xs justify-between text-[var(--st-text-secondary)]">
              <span>Subtotal</span>
              <span>{fmtINR(invoice.subtotal)}</span>
            </div>
            {typeof invoice.tax === 'number' ? (
              <div className="flex w-full max-w-xs justify-between text-[var(--st-text-secondary)]">
                <span>Tax</span>
                <span>{fmtINR(invoice.tax)}</span>
              </div>
            ) : null}
            {typeof invoice.discount === 'number' ? (
              <div className="flex w-full max-w-xs justify-between text-[var(--st-text-secondary)]">
                <span>Discount</span>
                <span>-{fmtINR(invoice.discount)}</span>
              </div>
            ) : null}
            <div className="flex w-full max-w-xs justify-between border-t border-[var(--st-border)] pt-1 text-base font-semibold text-[var(--st-text)]">
              <span>Total</span>
              <span>{fmtINR(invoice.total)}</span>
            </div>
          </section>

          {invoice.notes ? (
            <section className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-3 text-sm text-[var(--st-text-secondary)]">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Notes
              </h3>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </section>
          ) : null}
        </CardBody>
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
    <React.Suspense fallback={<div className="text-sm text-[var(--st-text-secondary)]">Loading invoice...</div>}>
      <PublicInvoiceContainer hash={hash} searchParamsMap={sp} />
    </React.Suspense>
  );
}
