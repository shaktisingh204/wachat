import { Factory, Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { CrmPageHeader } from '../../_components/crm-page-header';
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
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

type AnyProductionOrder = {
  _id?: { toString(): string } | string;
  orderNo?: string;
  bomRef?: string;
  finishedGoodName?: string;
  plannedQty?: number;
  actualYield?: number;
  unit?: string;
  plannedStart?: string | Date;
  plannedEnd?: string | Date;
  machineOperator?: string;
  status?: string;
  createdAt?: string | Date;
};

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatNumber(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return String(value);
}

function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'closed') return 'success';
  if (s === 'draft' || s === 'pending') return 'ghost';
  if (s === 'cancelled') return 'danger';
  if (s === 'in_progress' || s === 'in progress') return 'warning';
  return 'ghost';
}

function shortId(id: string): string {
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 6)}…${id.slice(-2)}` : id;
}

export default async function ProductionOrdersPage() {
  const session = await getSession();
  let orders: AnyProductionOrder[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_production_orders')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      orders = JSON.parse(JSON.stringify(docs)) as AnyProductionOrder[];
    } catch (e) {
      console.error('Failed to load crm_production_orders:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Production Orders"
        subtitle="Track manufacturing job cards and actual yield vs. planned."
        icon={Factory}
        actions={
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/inventory/production-orders/new">
              <Plus className="h-4 w-4" /> New order
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All Production Orders</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Active and draft job cards with planned vs. actual yield.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Order No.</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Finished Good</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Planned Qty</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Actual Yield</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Unit</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Start</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">End</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Operator</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={9}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load production orders. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : orders.length > 0 ? (
                orders.map((order, idx) => {
                  const idStr =
                    typeof order._id === 'string'
                      ? order._id
                      : (order._id as any)?.toString?.() ?? String(idx);
                  const orderNo = order.orderNo || shortId(idStr);
                  return (
                    <ZoruTableRow key={idStr} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">{orderNo}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {order.finishedGoodName || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatNumber(order.plannedQty)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatNumber(order.actualYield)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{order.unit || '—'}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate(order.plannedStart)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate(order.plannedEnd)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {order.machineOperator || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(order.status)}>
                          {order.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={9}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No production orders yet. Create one from a BOM to start tracking manufacturing.
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
