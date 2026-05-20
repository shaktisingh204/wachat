import { notFound } from 'next/navigation';
import { getPublicInvoice, markInvoiceViewed } from '@/app/actions/public-invoice.actions';
import { ZoruBadge, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { InvoicePaymentPanel } from './invoice-payment-panel';

type Params = Promise<{ hash: string }>;

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Paid: 'default',
  Unpaid: 'destructive',
  Partial: 'secondary',
  'Pending-Confirmation': 'outline',
  Draft: 'outline',
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default async function PublicInvoicePage({ params }: { params: Params }) {
  const { hash } = await params;
  const invoice = await getPublicInvoice(hash);
  if (!invoice) notFound();

  // Fire-and-forget view tracking; never blocks render.
  void markInvoiceViewed(hash);

  const isUnpaid = invoice.status === 'Unpaid' || invoice.status === 'Partial';

  return (
    <div className="space-y-6">
      <ZoruCard>
        <ZoruCardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <ZoruCardTitle>Invoice {invoice.invoiceNumber}</ZoruCardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              Issued {formatDate(invoice.invoiceDate)} &middot; Due {formatDate(invoice.dueDate)}
            </p>
          </div>
          <ZoruBadge variant={STATUS_VARIANT[invoice.status] || 'outline'}>{invoice.status}</ZoruBadge>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-6">
          {invoice.billTo.name || invoice.billTo.email || invoice.billTo.address ? (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Bill to
              </h3>
              <div className="text-sm">
                {invoice.billTo.name ? (
                  <div className="font-medium">{invoice.billTo.name}</div>
                ) : null}
                {invoice.billTo.email ? (
                  <div className="text-zinc-600">{invoice.billTo.email}</div>
                ) : null}
                {invoice.billTo.address ? (
                  <div className="text-zinc-600">{invoice.billTo.address}</div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Line items
            </h3>
            <div className="overflow-x-auto rounded-md border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {invoice.lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-zinc-400">
                        No line items.
                      </td>
                    </tr>
                  ) : (
                    invoice.lineItems.map((li, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{li.description || li.name || '—'}</td>
                        <td className="px-3 py-2 text-right">{li.quantity}</td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(li.rate, invoice.currency)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(li.total, invoice.currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col items-end gap-1 text-sm">
            <div className="flex w-full max-w-xs justify-between text-zinc-600">
              <span>Subtotal</span>
              <span>{formatMoney(invoice.subtotal, invoice.currency)}</span>
            </div>
            {typeof invoice.tax === 'number' ? (
              <div className="flex w-full max-w-xs justify-between text-zinc-600">
                <span>Tax</span>
                <span>{formatMoney(invoice.tax, invoice.currency)}</span>
              </div>
            ) : null}
            {typeof invoice.discount === 'number' ? (
              <div className="flex w-full max-w-xs justify-between text-zinc-600">
                <span>Discount</span>
                <span>-{formatMoney(invoice.discount, invoice.currency)}</span>
              </div>
            ) : null}
            <div className="flex w-full max-w-xs justify-between border-t border-zinc-200 pt-1 text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(invoice.total, invoice.currency)}</span>
            </div>
          </section>

          {invoice.notes ? (
            <section className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-600">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Notes
              </h3>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </section>
          ) : null}
        </ZoruCardContent>
      </ZoruCard>

      <InvoicePaymentPanel
        hash={hash}
        status={invoice.status}
        totalDue={invoice.total}
        currency={invoice.currency}
        isUnpaid={isUnpaid}
      />
    </div>
  );
}
