/**
 * Edit coupon — `/dashboard/crm/sales/coupons/[id]/edit`.
 *
 * Server component: fetches the coupon, passes data to a thin client
 * form that submits via `updateCoupon`. Re-uses the same field set as
 * the `/new` page (kept minimal — code, type, value, dates, limits).
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCouponById } from '@/app/actions/crm-coupons.actions';
import { EditCouponForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditCouponPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const result = await getCouponById(id);
    if (!result) notFound();
    const coupon: Record<string, any> = result!;

    return (
        <EntityDetailShell
            eyebrow="COUPON"
            title={`Edit ${coupon.code ?? 'coupon'}`}
            back={{ href: '/dashboard/crm/sales/coupons', label: 'Coupons' }}
        >
            <EditCouponForm couponId={id} initial={coupon} />
        </EntityDetailShell>
    );
}
