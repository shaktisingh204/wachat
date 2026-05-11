import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Factory, ArrowLeft } from 'lucide-react';
import { ObjectId } from 'mongodb';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function getStatusVariant(
  s?: string,
): 'ghost' | 'warning' | 'success' | 'danger' {
  const lower = (s || '').toLowerCase();
  if (lower === 'completed') return 'success';
  if (lower === 'in_progress') return 'warning';
  if (lower === 'cancelled') return 'danger';
  return 'ghost';
}

export default async function ProductionOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  if (!ObjectId.isValid(orderId)) {
    redirect('/dashboard/crm/inventory/production-orders');
  }

  const session = await getSession();
  if (!session?.user?._id) {
    redirect('/dashboard/crm/inventory/production-orders');
  }

  const { db } = await connectToDatabase();
  const doc = await db.collection('crm_production_orders').findOne({
    _id: new ObjectId(orderId),
    userId: new ObjectId(session.user._id),
  } as any);

  if (!doc) {
    redirect('/dashboard/crm/inventory/production-orders');
  }

  const order = JSON.parse(JSON.stringify(doc)) as Record<string, any>;

  const plannedQty: number = order.plannedQty ?? 0;
  const actualYield: number = order.actualYield ?? 0;
  const unit: string = order.unit ? ` ${order.unit}` : '';
  const yieldPct =
    plannedQty > 0 && actualYield > 0
      ? `${Math.round((actualYield / plannedQty) * 100)}%`
      : '—';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={order.orderNo || 'Production Order'}
        subtitle="Production order detail"
        icon={Factory}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/crm/inventory/production-orders">
              <ZoruButton variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back
              </ZoruButton>
            </Link>
            <Link href={`/dashboard/crm/inventory/production-orders/${order._id}/update-yield`}>
              <ZoruButton variant="outline">
                Update yield
              </ZoruButton>
            </Link>
          </div>
        }
      />

      <ZoruCard className="p-6">
        <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">
          Order Details
        </h2>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 text-[13px] sm:grid-cols-2">
          <div>
            <div className="text-zoru-ink-muted">Order No</div>
            <div className="font-mono text-zoru-ink">{order.orderNo || '—'}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">BOM Reference</div>
            <div className="text-zoru-ink">{order.bomRef || '—'}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Finished Good</div>
            <div className="text-zoru-ink">{order.finishedGoodName || '—'}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Planned Qty</div>
            <div className="text-zoru-ink">
              {plannedQty > 0 ? `${plannedQty}${unit}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Actual Yield</div>
            <div className="text-zoru-ink">
              {actualYield > 0 ? `${actualYield}${unit}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Yield %</div>
            <div className="text-zoru-ink">{yieldPct}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Machine / Line</div>
            <div className="text-zoru-ink">{order.machineId || '—'}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Operator</div>
            <div className="text-zoru-ink">{order.machineOperator || '—'}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Planned Start</div>
            <div className="text-zoru-ink">{fmtDate(order.plannedStart)}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Planned End</div>
            <div className="text-zoru-ink">{fmtDate(order.plannedEnd)}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Status</div>
            <div className="mt-0.5">
              {order.status ? (
                <ZoruBadge variant={getStatusVariant(order.status)}>
                  {order.status}
                </ZoruBadge>
              ) : (
                <span className="text-zoru-ink-muted">—</span>
              )}
            </div>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <div className="text-zoru-ink-muted">Notes</div>
              <div className="mt-1 whitespace-pre-wrap text-zoru-ink">
                {order.notes}
              </div>
            </div>
          )}
        </div>
      </ZoruCard>
    </div>
  );
}
