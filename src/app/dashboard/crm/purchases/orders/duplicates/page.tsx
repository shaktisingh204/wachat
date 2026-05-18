import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { Copy } from 'lucide-react';

/**
 * Purchase order duplicates — `/dashboard/crm/purchases/orders/duplicates`.
 *
 * Lists clusters of POs that share a vendor + a PO number OR a near-
 * identical total within ±7 days. Read-only — manual review only.
 * Merge / dedupe automation lives in a follow-up.
 *
 * Mirrors `/dashboard/crm/sales/invoices/duplicates`.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { findPurchaseOrderDuplicates } from '@/app/actions/crm/purchase-orders.actions';
import { EntityPickerChip } from '@/components/crm/entity-picker';

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

export default async function PurchaseOrderDuplicatesPage() {
  const groups = await findPurchaseOrderDuplicates();

  return (
    <EntityListShell
      title="Find duplicates"
      subtitle="Suspected duplicate purchase orders — same vendor, same PO number or similar amount within ±7 days."
    >

      {groups.length === 0 ? (
        <ZoruCard className="p-6">
          <p className="text-[13px] text-zoru-ink-muted">
            No duplicate clusters found. Purchase orders are matched when
            they share a vendor and either have the same PO number or have
            totals within ±1% and a PO date within ±7 days.
          </p>
        </ZoruCard>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <ZoruCard key={group.key} className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-zoru-line p-3">
                <h3 className="text-[13px] font-medium text-zoru-ink">
                  {group.members[0].vendorId ? (
                    <EntityPickerChip
                      entity="vendor"
                      id={group.members[0].vendorId}
                    />
                  ) : (
                    'Cluster'
                  )}{' '}
                  <ZoruBadge variant="outline">
                    {group.members.length} purchase orders
                  </ZoruBadge>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                    <tr>
                      <th className="p-2 text-left">PO #</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">PO date</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.members.map((m) => (
                      <tr key={m._id} className="border-t border-zoru-line">
                        <td className="p-2">
                          <Link
                            href={`/dashboard/crm/purchases/orders/${m._id}`}
                            className="font-medium text-zoru-ink hover:underline"
                          >
                            {m.poNo || m._id.slice(-6)}
                          </Link>
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-zoru-ink">
                          {fmtMoney(m.total, m.currency ?? 'INR')}
                        </td>
                        <td className="p-2 text-zoru-ink-muted">
                          {m.status ?? '—'}
                        </td>
                        <td className="p-2 text-zoru-ink-muted">
                          {fmtDate(m.date)}
                        </td>
                        <td className="p-2 text-right">
                          <ZoruButton size="sm" variant="outline" asChild>
                            <Link
                              href={`/dashboard/crm/purchases/orders/${m._id}`}
                            >
                              Open
                            </Link>
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
