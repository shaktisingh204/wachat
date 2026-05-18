import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Product detail — `/dashboard/crm/store/products/[id]`.
 */

import Link from 'next/link';

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getProductById } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, EntityStatusTone> = {
    draft: 'neutral',
    active: 'green',
    archived: 'red',
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

function fmtMoney(n: unknown, currency = 'INR'): string {
    const num = typeof n === 'number' ? n : parseFloat(String(n ?? ''));
    if (Number.isNaN(num)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
        }).format(num);
    } catch {
        return `${currency} ${num}`;
    }
}

export default async function ProductDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const product = await getProductById(id);
    if (!product) notFound();

    const title = (product.title as string) || `Product ${id.slice(-6)}`;
    const status = (product.status as string) || 'draft';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const currency = (product.currency as string) || 'INR';
    const images = Array.isArray(product.images)
        ? (product.images as unknown[]).map((x) => String(x))
        : [];
    const categories = Array.isArray(product.categories)
        ? (product.categories as unknown[]).map((x) => String(x))
        : [];
    const tags = Array.isArray(product.tags)
        ? (product.tags as unknown[]).map((x) => String(x))
        : [];

    return (
        <EntityDetailShell
            title={title}
            eyebrow="PRODUCT"
            status={{ label: status, tone }}
            back={{
                href: '/dashboard/crm/store/products',
                label: 'Back to products',
            }}
            actions={
                <ZoruButton asChild>
                    <Link href={`/dashboard/crm/store/products/${id}/edit`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                    </Link>
                </ZoruButton>
            }
            audit={
                <EntityAuditTimeline entityKind="store_product" entityId={id} />
            }
        >
            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Product details
                </h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Title">{title}</Field>
                    <Field label="SKU">{(product.sku as string) || '—'}</Field>
                    <Field label="Price">
                        {fmtMoney(product.price, currency)}
                    </Field>
                    <Field label="Compare-at price">
                        {fmtMoney(product.compareAtPrice, currency)}
                    </Field>
                    <Field label="Currency">{currency}</Field>
                    <Field label="Inventory">
                        {product.inventoryTracked ? 'Tracked' : 'Untracked'}
                    </Field>
                    <Field label="Storefront id" fullWidth>
                        <code className="text-[11.5px]">
                            {String(product.storefrontId ?? '—')}
                        </code>
                    </Field>
                    <Field label="Linked item id" fullWidth>
                        <code className="text-[11.5px]">
                            {String(product.itemId ?? '—')}
                        </code>
                    </Field>
                    {product.description ? (
                        <Field label="Description" fullWidth>
                            <p className="whitespace-pre-wrap">
                                {String(product.description)}
                            </p>
                        </Field>
                    ) : null}
                </div>
            </ZoruCard>

            {images.length > 0 ? (
                <ZoruCard className="p-6">
                    <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                        Images
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        {images.map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={url}
                                src={url}
                                alt={title}
                                className="h-24 w-24 rounded-md border border-zoru-line object-cover"
                            />
                        ))}
                    </div>
                </ZoruCard>
            ) : null}

            {categories.length > 0 || tags.length > 0 ? (
                <ZoruCard className="p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {categories.length > 0 ? (
                            <div>
                                <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                                    Categories
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {categories.map((c) => (
                                        <ZoruBadge key={c} variant="outline">
                                            {c}
                                        </ZoruBadge>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {tags.length > 0 ? (
                            <div>
                                <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                                    Tags
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {tags.map((t) => (
                                        <ZoruBadge key={t} variant="outline">
                                            {t}
                                        </ZoruBadge>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </ZoruCard>
            ) : null}
        </EntityDetailShell>
    );
}
