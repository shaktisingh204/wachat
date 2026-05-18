import { ZoruBadge, ZoruCard } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatCard, fmtMoney, BarRow } from '../_components/report-toolbar';
import { getInvoiceAging } from '@/app/actions/worksuite/reports.actions';

export default async function InvoiceAgingPage() {
  const buckets = await getInvoiceAging();

  const totalOutstanding = buckets.reduce((s, b) => s + b.total, 0);
  const totalCount = buckets.reduce((s, b) => s + b.count, 0);
  const max = buckets.reduce((m, b) => Math.max(m, b.total), 0);

  const toneFor: Record<string, 'green' | 'amber' | 'red' | 'obsidian'> = {
    '0-30': 'green',
    '31-60': 'amber',
    '61-90': 'red',
    '90+': 'obsidian',
  };

  return (
    <EntityListShell
      title="Invoice Aging"
      subtitle="Outstanding invoices grouped by days past due."
    >

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Outstanding total"
          value={fmtMoney(totalOutstanding)}
          tone="red"
        />
        <StatCard label="Open invoices" value={String(totalCount)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ZoruCard>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              Age buckets
            </h2>
          </div>
          {buckets.map((b) => (
            <BarRow
              key={b.bucket}
              label={`${b.bucket} days`}
              value={b.total}
              max={max}
              rightLabel={fmtMoney(b.total)}
              tone={toneFor[b.bucket]}
            />
          ))}
        </ZoruCard>

        <ZoruCard>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              Breakdown
            </h2>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {buckets.map((b) => (
              <div
                key={b.bucket}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <ZoruBadge variant={(toneFor[b.bucket] === 'obsidian' ? 'obsidian' : toneFor[b.bucket]) as any}>
                  {b.bucket} days
                </ZoruBadge>
                <div className="flex items-center gap-4">
                  <span className="text-[12.5px] text-muted-foreground">
                    {b.count} invoice{b.count === 1 ? '' : 's'}
                  </span>
                  <span className="text-[13px] font-medium text-foreground">
                    {fmtMoney(b.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ZoruCard>
      </div>
    </EntityListShell>
  );
}
