import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Promotion detail page — server component.
 *
 * Fetches promotion by id and renders a summary card with type, value,
 * validity, usage counters and applicability lists.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="PROMOTION"
            title={promotion.name}
            back={{ href: BASE, label: 'Promotions' }}
            actions={
                <Button asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >

            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">Overview</div>
                    <StatusPill label={pretty(status)} tone={tone} />
                    {promotion.code ? (
                        <Badge variant="ghost" className="font-mono">
                            {promotion.code}
                        </Badge>
                    ) : null}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Type</div>
                        <div className="capitalize text-[var(--st-text)]">
                            {pretty(promotion.type)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Value</div>
                        <div className="text-[var(--st-text)]">{value}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Min cart</div>
                        <div className="text-[var(--st-text)]">
                            {promotion.minCart != null ? `₹${promotion.minCart}` : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Usage</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {promotion.usedCount ?? 0}
                            {promotion.maxUses != null ? ` / ${promotion.maxUses}` : ''}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Valid from</div>
                        <div className="text-[var(--st-text)]">{fmtDate(promotion.validFrom)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Valid to</div>
                        <div className="text-[var(--st-text)]">{fmtDate(promotion.validTo)}</div>
                    </div>
                    {promotion.description ? (
                        <div className="sm:col-span-2">
                            <div className="text-[var(--st-text-secondary)]">Description</div>
                            <div className="whitespace-pre-wrap text-[var(--st-text)]">
                                {promotion.description}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            {(products.length > 0 || categories.length > 0 || segments.length > 0) && (
                <Card className="p-6">
                    <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
                        Applicability
                    </div>
                    <div className="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-3">
                        <div>
                            <div className="mb-1 text-[var(--st-text-secondary)]">Products</div>
                            {products.length === 0 ? (
                                <div className="text-[var(--st-text-secondary)]">All products</div>
                            ) : (
                                <div className="flex flex-wrap gap-1">
                                    {products.map((p) => (
                                        <Badge key={p} variant="ghost">
                                            {p}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="mb-1 text-[var(--st-text-secondary)]">Categories</div>
                            {categories.length === 0 ? (
                                <div className="text-[var(--st-text-secondary)]">All categories</div>
                            ) : (
                                <div className="flex flex-wrap gap-1">
                                    {categories.map((c) => (
                                        <Badge key={c} variant="ghost">
                                            {c}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="mb-1 text-[var(--st-text-secondary)]">Customer segments</div>
                            {segments.length === 0 ? (
                                <div className="text-[var(--st-text-secondary)]">All customers</div>
                            ) : (
                                <div className="flex flex-wrap gap-1">
                                    {segments.map((s) => (
                                        <Badge key={s} variant="ghost">
                                            {s}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            )}
        </EntityDetailShell>
    );
}
