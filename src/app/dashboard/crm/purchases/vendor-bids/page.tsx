import Link from 'next/link';
import { Gavel, Plus } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { getVendorBids } from '@/app/actions/crm-vendor-bids.actions';

type AnyVendorBid = {
  _id?: { toString(): string } | string;
  rfqRef?: string;
  rfqNumber?: string;
  rfqTitle?: string;
  rfqId?: { toString(): string } | string;
  vendorName?: string;
  vendorId?: { toString(): string } | string;
  total?: number;
  totalAmount?: number;
  currency?: string;
  status?: string;
  submittedAt?: string | Date;
  createdAt?: string | Date;
};

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatMoney(amount: number | undefined, currency = 'INR'): string {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
  } catch {
    return amount.toLocaleString();
  }
}

function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'accepted' || s === 'awarded') return 'success';
  if (s === 'submitted' || s === 'pending') return 'warning';
  if (s === 'rejected' || s === 'withdrawn' || s === 'expired') return 'danger';
  return 'ghost';
}

export default async function VendorBidsPage() {
  let bids: AnyVendorBid[] = [];
  try {
    const result = (await getVendorBids()) as
      | { vendorBids?: AnyVendorBid[]; bids?: AnyVendorBid[] }
      | AnyVendorBid[]
      | undefined;
    if (Array.isArray(result)) {
      bids = result;
    } else if (result && Array.isArray(result.vendorBids)) {
      bids = result.vendorBids;
    } else if (result && Array.isArray(result.bids)) {
      bids = result.bids;
    }
  } catch {
    bids = [];
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Vendor Bids"
        subtitle="Compare quotations submitted by vendors against your RFQs."
        icon={Gavel}
        actions={
          <Link href="/dashboard/crm/purchases/vendor-bids/new">
            <ZoruButton>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New Bid
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All Bids</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Bids received from vendors for your open RFQs.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">RFQ Ref</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Vendor</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted text-right">Total</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Submitted</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {bids.length > 0 ? (
                bids.map((bid, idx) => {
                  const id =
                    typeof bid._id === 'string'
                      ? bid._id
                      : bid._id?.toString?.() ?? String(idx);
                  const rfqRef =
                    bid.rfqRef ||
                    bid.rfqNumber ||
                    bid.rfqTitle ||
                    (typeof bid.rfqId === 'string'
                      ? bid.rfqId
                      : bid.rfqId?.toString?.()) ||
                    '—';
                  const vendor =
                    bid.vendorName ||
                    (typeof bid.vendorId === 'string'
                      ? bid.vendorId
                      : bid.vendorId?.toString?.()) ||
                    'Unknown vendor';
                  const total = bid.total ?? bid.totalAmount;
                  const submitted = bid.submittedAt ?? bid.createdAt;
                  // Defensive: backend uses 'awarded' but accept the
                  // common synonyms 'won' and 'accepted' too.
                  const statusLower = (bid.status || '').toLowerCase();
                  const canConvert =
                    statusLower === 'awarded' ||
                    statusLower === 'won' ||
                    statusLower === 'accepted';
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">{rfqRef}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{vendor}</ZoruTableCell>
                      <ZoruTableCell className="text-right text-zoru-ink">
                        {formatMoney(total, bid.currency)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(bid.status)}>
                          {bid.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate(submitted)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        {canConvert ? (
                          <form
                            method="post"
                            action={`/dashboard/crm/purchases/vendor-bids/${id}/convert-to-po`}
                            className="inline-block"
                          >
                            <ZoruButton type="submit" variant="secondary">
                              Convert to PO
                            </ZoruButton>
                          </form>
                        ) : (
                          <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No vendor bids yet. Send out an RFQ to start collecting bids.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
