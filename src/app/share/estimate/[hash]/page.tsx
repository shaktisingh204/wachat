import { notFound } from 'next/navigation';
import { getPublicEstimate } from '@/app/actions/public-estimate.actions';
import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { EstimateActionsPanel } from './estimate-actions-panel';

type Params = Promise<{ hash: string }>;

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  accepted: 'default',
  declined: 'destructive',
  waiting: 'secondary',
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

export default async function PublicEstimatePage({ params }: { params: Params }) {
  const { hash } = await params;
  const estimate = await getPublicEstimate(hash);
  if (!estimate) notFound();

  return (
    <div className="space-y-6">
      <ZoruCard>
        <ZoruCardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <ZoruCardTitle>Estimate {estimate.estimateNumber}</ZoruCardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              Valid till {formatDate(estimate.validTill)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ZoruBadge variant={STATUS_VARIANT[estimate.status] || 'outline'}>
              {estimate.status}
            </ZoruBadge>
            <a
              href={`/share/estimate/${hash}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Download PDF
            </a>
          </div>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-6">
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
                  {estimate.lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-zinc-400">
                        No line items.
                      </td>
                    </tr>
                  ) : (
                    estimate.lineItems.map((li, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{li.description || '—'}</td>
                        <td className="px-3 py-2 text-right">{li.quantity}</td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(li.rate, estimate.currency)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(li.total, estimate.currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex justify-end text-sm">
            <div className="flex w-full max-w-xs justify-between border-t border-zinc-200 pt-1 text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(estimate.total, estimate.currency)}</span>
            </div>
          </section>

          {estimate.notes ? (
            <section className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-600">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Notes
              </h3>
              <p className="whitespace-pre-line">{estimate.notes}</p>
            </section>
          ) : null}
        </ZoruCardContent>
      </ZoruCard>

      <EstimateActionsPanel
        hash={hash}
        status={estimate.status}
        signature={estimate.signature ?? null}
        declineReason={estimate.declineReason ?? null}
      />
    </div>
  );
}
