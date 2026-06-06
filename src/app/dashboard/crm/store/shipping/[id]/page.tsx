import { Button, Card } from '@/components/sabcrm/20ui/compat';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Shipping zone detail — `/dashboard/crm/store/shipping/[id]`.
 */

import Link from 'next/link';

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getShippingZoneById } from '@/app/actions/crm-store.actions';

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
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                {label}
            </div>
            <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
        </div>
    );
}

export default async function ShippingZoneDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const zone = await getShippingZoneById(id);
    if (!zone) notFound();

    const name = (zone.name as string) || `Zone ${id.slice(-6)}`;
    const status = (zone.status as string) || 'draft';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const countries = Array.isArray(zone.countries)
        ? (zone.countries as unknown[]).map((c) => String(c))
        : [];
    const states = Array.isArray(zone.states)
        ? (zone.states as unknown[]).map((s) => String(s))
        : [];
    const methods = Array.isArray(zone.methods)
        ? (zone.methods as Record<string, unknown>[])
        : [];

    return (
        <EntityDetailShell
            title={name}
            eyebrow="SHIPPING ZONE"
            status={{ label: status, tone }}
            back={{
                href: '/dashboard/crm/store/shipping',
                label: 'Back to shipping zones',
            }}
            actions={
                <Button asChild>
                    <Link href={`/dashboard/crm/store/shipping/${id}/edit`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
            audit={
                <EntityAuditTimeline
                    entityKind="store_shipping_zone"
                    entityId={id}
                />
            }
        >
            <Card className="p-6">
                <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Zone details
                </h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Name">{name}</Field>
                    <Field label="Storefront id">
                        <code className="text-[11.5px]">
                            {String(zone.storefrontId ?? '—')}
                        </code>
                    </Field>
                    <Field label="Countries" fullWidth>
                        {countries.length > 0 ? countries.join(', ') : '—'}
                    </Field>
                    <Field label="States" fullWidth>
                        {states.length > 0 ? states.join(', ') : '—'}
                    </Field>
                </div>
            </Card>

            <Card className="p-6">
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Methods
                </h2>
                {methods.length === 0 ? (
                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                        No shipping methods configured.
                    </p>
                ) : (
                    <ul className="divide-y divide-[var(--st-border)] text-[13px]">
                        {methods.map((m, i) => (
                            <li
                                key={i}
                                className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-4"
                            >
                                <span className="font-medium text-[var(--st-text)]">
                                    {String(m.name ?? '')}
                                </span>
                                <span className="text-[var(--st-text-secondary)]">
                                    Kind · {String(m.kind ?? '')}
                                </span>
                                <span className="text-[var(--st-text-secondary)]">
                                    Rate · {String(m.rate ?? 0)}
                                </span>
                                <span className="text-[var(--st-text-secondary)]">
                                    Free above ·{' '}
                                    {m.freeAboveSubtotal !== null &&
                                    m.freeAboveSubtotal !== undefined
                                        ? String(m.freeAboveSubtotal)
                                        : '—'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </EntityDetailShell>
    );
}
