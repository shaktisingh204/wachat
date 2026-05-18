import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCouponById } from '@/app/actions/crm-coupons.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function CouponActivityPage({ params }: PageProps) {
    const { id } = await params;
    const coupon = await getCouponById(id);
    if (!coupon) notFound();
    const title = String((coupon as any).code ?? 'Coupon');

    return (
        <EntityDetailShell
            title={title}
            eyebrow="COUPON ACTIVITY"
            back={{
                href: `/dashboard/crm/sales/coupons/${id}`,
                label: 'Back to coupon',
            }}
        >
            <EntityAuditTimeline entityKind="coupon" entityId={id} />
        </EntityDetailShell>
    );
}
