import { Button, Card } from '@/components/zoruui';
/**
 * <RfqVendorBidsCard> — server component that lists all vendor bids
 * submitted against an RFQ. Highlights the awarded vendor and exposes
 * deep links into each bid's detail page.
 *
 * Pure server render; no client islands needed. Status pill uses the
 * canonical `statusToTone()` mapper so colour semantics match the
 * Vendor Bid list view.
 */

import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { listVendorBids } from '@/app/actions/crm/vendor-bids.actions';
import { VendorBidsComparison } from './vendor-bids-comparison';

interface RfqVendorBidsCardProps {
  rfqId: string;
}

import { fmtINR, fmtDate } from '@/lib/utils';


export async function RfqVendorBidsCard({ rfqId }: RfqVendorBidsCardProps) {
  const { bids, error } = await listVendorBids({
    rfqId,
    page: 1,
    limit: 100,
  });

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-zoru-line p-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Vendor bids received
        </h2>
        <div className="flex gap-2">
          <VendorBidsComparison bids={bids} />
          <Button size="sm" variant="outline" asChild>
            <Link
              href={`/dashboard/crm/purchases/vendor-bids/new?fromKind=rfq&fromId=${rfqId}`}
            >
              Record a bid
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
          {error}
        </div>
      ) : null}

      {bids.length === 0 ? (
        <div className="px-3 py-6 text-center text-[13px] text-zoru-ink-muted">
          No bids submitted against this RFQ yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
              <tr>
                <th className="p-2 text-left">Vendor</th>
                <th className="p-2 text-left">Submitted</th>
                <th className="p-2 text-left">Currency</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {bids.map((b) => {
                const id = String(b._id);
                const isAwarded =
                  typeof b.status === 'string' &&
                  b.status.toLowerCase() === 'awarded';
                return (
                  <tr
                    key={id}
                    className={`border-t border-zoru-line ${
                      isAwarded ? 'bg-emerald-500/5' : 'hover:bg-zoru-surface-2/60'
                    }`}
                  >
                    <td className="p-2 align-middle">
                      {b.vendorId ? (
                        <EntityPickerChip entity="vendor" id={b.vendorId} />
                      ) : (
                        <span className="text-zoru-ink-muted">
                          {b.vendorName || '—'}
                        </span>
                      )}
                    </td>
                    <td className="p-2 align-middle text-zoru-ink-muted">
                      {fmtDate(b.submittedAt || b.createdAt)}
                    </td>
                    <td className="p-2 align-middle text-zoru-ink-muted">
                      {b.currency || 'INR'}
                    </td>
                    <td className="p-2 text-right align-middle font-mono tabular-nums text-zoru-ink">
                      {fmtINR(b.totals?.total, b.currency)}
                    </td>
                    <td className="p-2 align-middle">
                      <StatusPill
                        label={typeof b.status === 'string' ? b.status : '—'}
                        tone={statusToTone(typeof b.status === 'string' ? b.status : '')}
                      />
                    </td>
                    <td className="p-2 text-right align-middle">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/crm/purchases/vendor-bids/${id}`}>
                          Open
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
