import * as React from 'react';
import { notFound } from 'next/navigation';
import { Download } from 'lucide-react';
import { getPublicEstimate } from '@/app/actions/public-estimate.actions';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import { EstimateActionsPanel } from './estimate-actions-panel';
import { fmtDate, fmtINR } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Params = Promise<{ hash: string }>;

const STATUS_TONE: Record<string, 'accent' | 'danger' | 'neutral'> = {
  accepted: 'accent',
  declined: 'danger',
  waiting: 'neutral',
};

async function PublicEstimateContainer({ hash }: { hash: string }) {
  const estimate = await getPublicEstimate(hash);
  if (!estimate) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Estimate {estimate.estimateNumber}</CardTitle>
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
              Valid till {fmtDate(estimate.validTill)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[estimate.status] ?? 'neutral'}>
              {estimate.status}
            </Badge>
            <Button variant="outline" size="sm" iconLeft={Download}>
              <a
                href={`/share/estimate/${hash}/download`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download PDF
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Line items
            </h3>
            <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
              {estimate.lineItems.length === 0 ? (
                <EmptyState
                  size="sm"
                  title="No line items"
                  description="This estimate does not contain any line items yet."
                />
              ) : (
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
                    {estimate.lineItems.map((li, idx) => (
                      <Tr key={idx}>
                        <Td>{li.description || '-'}</Td>
                        <Td align="right">{li.quantity}</Td>
                        <Td align="right">{fmtINR(li.rate)}</Td>
                        <Td align="right">{fmtINR(li.total)}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </section>

          <section className="flex justify-end text-sm">
            <div className="flex w-full max-w-xs justify-between border-t border-[var(--st-border)] pt-1 text-base font-semibold text-[var(--st-text)]">
              <span>Total</span>
              <span>{fmtINR(estimate.total)}</span>
            </div>
          </section>

          {estimate.notes ? (
            <section className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-3 text-sm text-[var(--st-text)]">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Notes
              </h3>
              <p className="whitespace-pre-line">{estimate.notes}</p>
            </section>
          ) : null}
        </CardBody>
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
    <React.Suspense fallback={<div className="text-sm text-[var(--st-text-secondary)]">Loading estimate...</div>}>
      <PublicEstimateContainer hash={hash} />
    </React.Suspense>
  );
}
