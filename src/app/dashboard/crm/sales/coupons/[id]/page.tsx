import { ZoruButton, ZoruCard } from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Coupon detail — `/dashboard/crm/sales/coupons/[id]`.
 *
 * Server component: fetches via `getCouponById`, renders the
 * `<EntityDetailShell>` with header (status pill + Edit button), a
 * ZoruCard body of fields, and an Activity footer powered by
 * `<EntityAuditTimeline>` (entityKind: 'coupon').
 */

import Link from 'next/link';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getCouponById } from '@/app/actions/crm-coupons.actions';

export const dynamic = 'force-dynamic';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string | number | Date);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

function fmtMoney(n: unknown, currency = 'INR'): string {
    const num = typeof n === 'number' ? n : parseFloat(String(n ?? ''));
    if (isNaN(num)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(num);
    } catch {
        return `${currency} ${num}`;
    }
}

function couponTypeLabel(type: unknown): string {
    switch (type) {
        case 'percent':
            return 'Percentage Discount';
        case 'flat':
            return 'Flat Amount Off';
        case 'bogo':
            return 'Buy One Get One';
        case 'free_shipping':
            return 'Free Shipping';
        default:
            return String(type ?? '—');
    }
}

const STATUS_TONE: Record<string, EntityStatusTone> = {
    draft: 'neutral',
    active: 'green',
    paused: 'amber',
    expired: 'red',
    used: 'blue',
};

function Field({
    label,
    children,
    fullWidth,
}: {
    label: string;
    children: React.ReactNode;
    fullWidth?: boolean;
}) {
    return (
        <div className={fullWidth ? 'sm:col-span-2' : undefined}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </div>
            <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
        </div>
    );
}

export default async function CouponDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const result = await getCouponById(id);
    if (!result) notFound();
    const coupon: Record<string, any> = result!;

    const code = (coupon.code as string) || `Coupon ${id.slice(-6)}`;
    const status = (coupon.status as string) || 'draft';
    const tone: EntityStatusTone = STATUS_TONE[status] ?? 'neutral';
    const type = coupon.type as string | undefined;
    const value = coupon.value as number | undefined;

    const valueDisplay =
        type === 'percent'
            ? typeof value === 'number'
                ? `${value}%`
                : '—'
            : fmtMoney(value);

    return (
        <EntityDetailShell
            title={code}
            eyebrow="COUPON"
            status={{ label: status, tone }}
            back={{ href: '/dashboard/crm/sales/coupons', label: 'Back to coupons' }}
            actions={
                <ZoruButton asChild>
                    <Link href={`/dashboard/crm/sales/coupons/${id}/edit`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                    </Link>
                </ZoruButton>
            }
            audit={<EntityAuditTimeline entityKind="coupon" entityId={id} />}
        >
            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Coupon details
                </h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Code">{code}</Field>
                    <Field label="Type">{couponTypeLabel(type)}</Field>
                    <Field label="Value">{valueDisplay}</Field>
                    <Field label="Min cart">{fmtMoney(coupon.minCart)}</Field>
                    <Field label="Max uses">{coupon.maxUses ?? '—'}</Field>
                    <Field label="Per-customer limit">
                        {coupon.perCustomerLimit ?? '—'}
                    </Field>
                    <Field label="Valid from">{fmtDate(coupon.validFrom)}</Field>
                    <Field label="Valid to">{fmtDate(coupon.validTo)}</Field>
                    <Field label="Stackable">
                        {coupon.stackable === true ? 'Yes' : 'No'}
                    </Field>
                    <Field label="Used count">{coupon.usedCount ?? 0}</Field>
                    {coupon.notes ? (
                        <Field label="Notes" fullWidth>
                            <p className="whitespace-pre-wrap">{String(coupon.notes)}</p>
                        </Field>
                    ) : null}
                </div>
            </ZoruCard>
        </EntityDetailShell>
    );
}
