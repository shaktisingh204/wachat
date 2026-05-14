/**
 * Purchase order activity — `/dashboard/crm/purchases/orders/[id]/activity`.
 *
 * Mirrors the accounts/[accountId]/activity template. Fetches the PO
 * for header context, then renders the shared `<EntityAuditTimeline>`
 * for `entityKind: 'purchaseOrder'`.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getPurchaseOrder } from '@/app/actions/crm/purchase-orders.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderActivityPage({ params }: PageProps) {
  const { id } = await params;
  const { order } = await getPurchaseOrder(id);
  if (!order) notFound();

  const title = order.poNo || `Purchase order ${id.slice(-6)}`;

  return (
    <div className="flex w-full flex-col gap-6">
      <Link
        href={`/dashboard/crm/purchases/orders/${id}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to purchase order
      </Link>

      <CrmPageHeader
        title={`${title} — Activity`}
        subtitle="Audit trail of every change made to this purchase order."
        icon={Activity}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Purchases', href: '/dashboard/crm/purchases' },
          {
            label: 'Purchase Orders',
            href: '/dashboard/crm/purchases/orders',
          },
          { label: title, href: `/dashboard/crm/purchases/orders/${id}` },
          { label: 'Activity' },
        ]}
      />

      <EntityAuditTimeline entityKind="purchaseOrder" entityId={id} />
    </div>
  );
}
