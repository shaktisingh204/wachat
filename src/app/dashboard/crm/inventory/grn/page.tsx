import Link from 'next/link';
import { PackageCheck, Plus } from 'lucide-react';

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
import { getGrns } from '@/app/actions/crm-grn.actions';

type AnyGrn = {
  _id?: { toString(): string } | string;
  grnNumber?: string;
  grnNo?: string;
  number?: string;
  date?: string | Date;
  receivedAt?: string | Date;
  createdAt?: string | Date;
  vendorName?: string;
  vendorId?: { toString(): string } | string;
  warehouseName?: string;
  warehouseId?: { toString(): string } | string;
  items?: unknown[];
  lineItems?: unknown[];
  status?: string;
};

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'received' || s === 'completed' || s === 'posted') return 'success';
  if (s === 'partial' || s === 'pending') return 'warning';
  if (s === 'cancelled' || s === 'rejected') return 'danger';
  return 'ghost';
}

export default async function GrnPage() {
  let grns: AnyGrn[] = [];
  try {
    const result = (await getGrns()) as
      | { grns?: AnyGrn[] }
      | AnyGrn[]
      | undefined;
    if (Array.isArray(result)) {
      grns = result;
    } else if (result && Array.isArray(result.grns)) {
      grns = result.grns;
    }
  } catch {
    grns = [];
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Goods Receipt (GRN)"
        subtitle="Record incoming stock against purchase orders and reconcile quantities."
        icon={PackageCheck}
        actions={
          <Link href="/dashboard/crm/inventory/grn/new">
            <ZoruButton>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New GRN
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All GRNs</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Goods receipt notes recorded against purchase orders.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">GRN No</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Vendor</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Warehouse</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Items</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {grns.length > 0 ? (
                grns.map((grn, idx) => {
                  const id =
                    typeof grn._id === 'string'
                      ? grn._id
                      : grn._id?.toString?.() ?? String(idx);
                  const grnNo = grn.grnNumber || grn.grnNo || grn.number || '—';
                  const date = grn.date ?? grn.receivedAt ?? grn.createdAt;
                  const vendor =
                    grn.vendorName ||
                    (typeof grn.vendorId === 'string'
                      ? grn.vendorId
                      : grn.vendorId?.toString?.()) ||
                    '—';
                  const warehouse =
                    grn.warehouseName ||
                    (typeof grn.warehouseId === 'string'
                      ? grn.warehouseId
                      : grn.warehouseId?.toString?.()) ||
                    '—';
                  const itemsCount = Array.isArray(grn.items)
                    ? grn.items.length
                    : Array.isArray(grn.lineItems)
                      ? grn.lineItems.length
                      : 0;
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">{grnNo}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{formatDate(date)}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{vendor}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{warehouse}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{itemsCount}</ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(grn.status)}>
                          {grn.status || 'draft'}
                        </ZoruBadge>
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
                    No GRNs yet. Receive goods against a purchase order to record one.
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
