/**
 * Edit coupon — `/dashboard/crm/sales/coupons/[id]/edit`.
 *
 * Server component: fetches the coupon, passes data to a thin client
 * form that submits via `updateCoupon`. Re-uses the same field set as
 * the `/new` page (kept minimal — code, type, value, dates, limits).
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit ${coupon.code ?? 'coupon'}`}
                subtitle="Update coupon details, limits, and validity window."
            />
            <EditCouponForm couponId={id} initial={coupon} />
        </div>
    );
}
