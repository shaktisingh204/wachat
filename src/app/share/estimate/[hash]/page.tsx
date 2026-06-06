import * as React from 'react';
import { notFound } from 'next/navigation';
import { getPublicEstimate } from '@/app/actions/public-estimate.actions';
import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/sabcrm/20ui/compat';
import { EstimateActionsPanel } from './estimate-actions-panel';
import { fmtDate, fmtINR } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Params = Promise<{ hash: string }>;

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  accepted: 'default',
  declined: 'destructive',
  waiting: 'secondary',
};

async function PublicEstimateContainer({ hash }: { hash: string }) {
  const estimate = await getPublicEstimate(hash);
  if (!estimate) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <ZoruCardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <ZoruCardTitle>Estimate {estimate.estimateNumber}</ZoruCardTitle>
            <p className="mt-1 text-sm text-zoru-ink">
              Valid till {fmtDate(estimate.validTill)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[estimate.status] || 'outline'}>
              {estimate.status}
            </Badge>
            <a
              href={`/share/estimate/${hash}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-zoru-line bg-white px-3 py-1.5 text-xs font-medium text-zoru-ink shadow-sm hover:bg-zoru-surface-2"
            >
              Download PDF
            </a>
          </div>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-6">
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
                  {estimate.lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-zoru-ink-muted">
                        No line items.
                      </td>
                    </tr>
                  ) : (
                    estimate.lineItems.map((li, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{li.description || '—'}</td>
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

          <section className="flex justify-end text-sm">
            <div className="flex w-full max-w-xs justify-between border-t border-zoru-line pt-1 text-base font-semibold">
              <span>Total</span>
              <span>{fmtINR(estimate.total)}</span>
            </div>
          </section>

          {estimate.notes ? (
            <section className="rounded-md bg-zoru-surface-2 p-3 text-sm text-zoru-ink">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zoru-ink">
                Notes
              </h3>
              <p className="whitespace-pre-line">{estimate.notes}</p>
            </section>
          ) : null}
        </ZoruCardContent>
      </Card>

      <EstimateActionsPanel
        hash={hash}
        status={estimate.status}
        signature={estimate.signature ?? null}
        declineReason={estimate.declineReason ?? null}
        invoiceHash={estimate.invoiceHash ?? null}
      />
    </div>
  );
}

export default async function PublicEstimatePage({ params }: { params: Params }) {
  const { hash } = await params;
  
  return (
    <React.Suspense fallback={<div>Loading estimate...</div>}>
      <PublicEstimateContainer hash={hash} />
    </React.Suspense>
  );
}
