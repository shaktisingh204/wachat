import Link from 'next/link';
import { ClipboardList, Plus } from 'lucide-react';

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
import { getRfqs } from '@/app/actions/crm-rfq.actions';

type AnyRfq = {
  _id?: { toString(): string } | string;
  title?: string;
  subject?: string;
  requiredBy?: string | Date;
  status?: string;
  vendorIds?: unknown[];
  invitedVendorIds?: unknown[];
  createdAt?: string | Date;
};

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'closed' || s === 'awarded' || s === 'accepted') return 'success';
  if (s === 'sent' || s === 'open') return 'warning';
  if (s === 'cancelled' || s === 'expired' || s === 'declined') return 'danger';
  return 'ghost';
}

export default async function RfqsPage() {
  let rfqs: AnyRfq[] = [];
  try {
    const result = (await getRfqs()) as { rfqs?: AnyRfq[] } | AnyRfq[] | undefined;
    if (Array.isArray(result)) {
      rfqs = result;
    } else if (result && Array.isArray(result.rfqs)) {
      rfqs = result.rfqs;
    }
  } catch {
    rfqs = [];
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Request for Quotations"
        subtitle="Send RFQs to vendors and compare bids side by side."
        icon={ClipboardList}
        actions={
          <Link href="/dashboard/crm/purchases/rfqs/new">
            <ZoruButton>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New RFQ
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All RFQs</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Requests for quotation you have sent to vendors.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Required By</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Vendors Invited</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Created</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rfqs.length > 0 ? (
                rfqs.map((rfq, idx) => {
                  const id =
                    typeof rfq._id === 'string'
                      ? rfq._id
                      : rfq._id?.toString?.() ?? String(idx);
                  const invited = Array.isArray(rfq.vendorIds)
                    ? rfq.vendorIds.length
                    : Array.isArray(rfq.invitedVendorIds)
                      ? rfq.invitedVendorIds.length
                      : 0;
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        {rfq.title || rfq.subject || 'Untitled RFQ'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate(rfq.requiredBy)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(rfq.status)}>
                          {rfq.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{invited}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate(rfq.createdAt)}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No RFQs yet. Create your first request to start collecting vendor bids.
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
