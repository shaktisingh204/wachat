/**
 * Sales order activity (audit log) — server route.
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'salesOrder'`.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSalesOrderById } from '@/app/actions/crm-sales-orders.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function SalesOrderActivityPage({ params }: PageProps) {
    const { id } = await params;
    const order = await getSalesOrderById(id);
    if (!order) notFound();

    const title = (order as any).orderNumber || (order as any).soNo || `Order ${id.slice(-6)}`;

    return (
        <EntityDetailShell
            title={title}
            eyebrow="SALES ORDER ACTIVITY"
            back={{
                href: `/dashboard/crm/sales/orders/${id}`,
                label: 'Back to sales order',
            }}
        >
            <EntityAuditTimeline entityKind="salesOrder" entityId={id} />
        </EntityDetailShell>
    );
}
