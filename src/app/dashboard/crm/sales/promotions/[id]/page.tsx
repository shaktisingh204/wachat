import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Pencil,
  Tag } from 'lucide-react';

/**
 * Promotion detail page — server component.
 *
 * Fetches promotion by id and renders a summary card with type, value,
 * validity, usage counters and applicability lists.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';

import {
    getPromotionById,
    type CrmPromotionStatus,
} from '@/app/actions/crm-promotions.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/promotions';

const STATUS_TONE: Record<CrmPromotionStatus, StatusTone> = {
    draft: 'amber',
    scheduled: 'blue',
    active: 'green',
    paused: 'amber',
    expired: 'red',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function pretty(s?: string): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

export default async function PromotionDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const promotion = await getPromotionById(id);
    if (!promotion) notFound();

    const status = (promotion.status ?? 'draft') as CrmPromotionStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';

    const value =
        promotion.value == null
            ? '—'
            : promotion.type === 'percent'
              ? `${promotion.value}%`
              : promotion.type === 'flat'
                ? `₹${promotion.value}`
                : String(promotion.value);

    const products = promotion.applicableProducts ?? [];
    const categories = promotion.applicableCategories ?? [];
    const segments = promotion.customerSegments ?? [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Sales', href: '/dashboard/crm/sales' },
                    { label: 'Promotions', href: BASE },
                    { label: promotion.name },
                ]}
                title={promotion.name}
                subtitle={promotion.description || 'Promotion detail'}
                icon={Tag}
                actions={
                    <div className="flex items-center gap-2">
                        <ZoruButton variant="outline" asChild>
                            <Link href={BASE}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Link>
                        </ZoruButton>
                        <ZoruButton asChild>
                            <Link href={`${BASE}/${id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </Link>
                        </ZoruButton>
                    </div>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
                    <StatusPill label={pretty(status)} tone={tone} />
                    {promotion.code ? (
                        <ZoruBadge variant="ghost" className="font-mono">
                            {promotion.code}
                        </ZoruBadge>
                    ) : null}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Type</div>
                        <div className="capitalize text-zoru-ink">
                            {pretty(promotion.type)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Value</div>
                        <div className="text-zoru-ink">{value}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Min cart</div>
                        <div className="text-zoru-ink">
                            {promotion.minCart != null ? `₹${promotion.minCart}` : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Usage</div>
                        <div className="font-mono text-zoru-ink">
                            {promotion.usedCount ?? 0}
                            {promotion.maxUses != null ? ` / ${promotion.maxUses}` : ''}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Valid from</div>
                        <div className="text-zoru-ink">{fmtDate(promotion.validFrom)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Valid to</div>
                        <div className="text-zoru-ink">{fmtDate(promotion.validTo)}</div>
                    </div>
                    {promotion.description ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Description</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {promotion.description}
                            </div>
                        </div>
                    ) : null}
                </div>
            </ZoruCard>

            {(products.length > 0 || categories.length > 0 || segments.length > 0) && (
                <ZoruCard className="p-6">
                    <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                        Applicability
                    </div>
                    <div className="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-3">
                        <div>
                            <div className="mb-1 text-zoru-ink-muted">Products</div>
                            {products.length === 0 ? (
                                <div className="text-zoru-ink-muted">All products</div>
                            ) : (
                                <div className="flex flex-wrap gap-1">
                                    {products.map((p) => (
                                        <ZoruBadge key={p} variant="ghost">
                                            {p}
                                        </ZoruBadge>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="mb-1 text-zoru-ink-muted">Categories</div>
                            {categories.length === 0 ? (
                                <div className="text-zoru-ink-muted">All categories</div>
                            ) : (
                                <div className="flex flex-wrap gap-1">
                                    {categories.map((c) => (
                                        <ZoruBadge key={c} variant="ghost">
                                            {c}
                                        </ZoruBadge>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="mb-1 text-zoru-ink-muted">Customer segments</div>
                            {segments.length === 0 ? (
                                <div className="text-zoru-ink-muted">All customers</div>
                            ) : (
                                <div className="flex flex-wrap gap-1">
                                    {segments.map((s) => (
                                        <ZoruBadge key={s} variant="ghost">
                                            {s}
                                        </ZoruBadge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ZoruCard>
            )}
        </div>
    );
}
