import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';

/**
 * Deal duplicates — `/dashboard/crm/sales-crm/deals/duplicates`.
 *
 * Lists groups of deals matched on (clientId, amount within ±5%,
 * expectedClose within ±7d). The merge / dedupe flow is queued; this
 * page surfaces the suspect groups so users can resolve them manually.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { findCrmDealDuplicates } from '@/app/actions/crm-deals.actions';

export const dynamic = 'force-dynamic';

function fmtMoney(value: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default async function DealDuplicatesPage() {
  const groups = await findCrmDealDuplicates();

  return (
    <EntityListShell
      title="Find duplicates"
      subtitle="Possible duplicate deals — same client, similar amount, close-by expected-close dates."
    >

      {groups.length === 0 ? (
        <ZoruCard className="p-6">
          <p className="text-[13px] text-zoru-ink-muted">
            No duplicate clusters found. Deals are matched when they share a client, have an amount
            within ±5%, and expected-close dates within ±7 days.
          </p>
        </ZoruCard>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <ZoruCard key={group.key} className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-zoru-line p-3">
                <h3 className="text-[13px] font-medium text-zoru-ink">
                  {group.members[0].clientLabel || 'Cluster'}{' '}
                  <ZoruBadge variant="outline">{group.members.length} deals</ZoruBadge>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                    <tr>
                      <th className="p-2 text-left">Title</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2 text-left">Stage</th>
                      <th className="p-2 text-left">Expected close</th>
                      <th className="p-2 text-left">Created</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.members.map((m) => (
                      <tr key={m._id} className="border-t border-zoru-line">
                        <td className="p-2">
                          <Link
                            href={`/dashboard/crm/sales-crm/deals/${m._id}`}
                            className="font-medium text-zoru-ink hover:underline"
                          >
                            {m.name}
                          </Link>
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-zoru-ink">
                          {fmtMoney(m.value, m.currency ?? 'INR')}
                        </td>
                        <td className="p-2 text-zoru-ink-muted">{m.stage ?? '—'}</td>
                        <td className="p-2 text-zoru-ink-muted">{fmtDate(m.expectedClose)}</td>
                        <td className="p-2 text-zoru-ink-muted">{fmtDate(m.createdAt)}</td>
                        <td className="p-2 text-right">
                          <ZoruButton size="sm" variant="outline" asChild>
                            <Link href={`/dashboard/crm/sales-crm/deals/${m._id}`}>Open</Link>
                          </ZoruButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ZoruCard>
          ))}
        </div>
      )}
    </EntityListShell>
  );
}
