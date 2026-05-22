import { Button, Card } from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Storefront detail — `/dashboard/crm/store/storefronts/[id]`.
 */

import Link from 'next/link';

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getStorefrontById } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, EntityStatusTone> = {
    draft: 'neutral',
    published: 'green',
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

export default async function StorefrontDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const sf = await getStorefrontById(id);
    if (!sf) notFound();

    const name = (sf.name as string) || `Storefront ${id.slice(-6)}`;
    const status = (sf.status as string) || 'draft';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const blocks = (sf.homepageBlocks as unknown) ?? [];
    const blocksString = (() => {
        try {
            return JSON.stringify(blocks, null, 2);
        } catch {
            return '[]';
        }
    })();

    return (
        <EntityDetailShell
            title={name}
            eyebrow="STOREFRONT"
            status={{ label: status, tone }}
            back={{
                href: '/dashboard/crm/store/storefronts',
                label: 'Back to storefronts',
            }}
            actions={
                <Button asChild>
                    <Link href={`/dashboard/crm/store/storefronts/${id}/edit`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
            audit={
                <EntityAuditTimeline entityKind="storefront" entityId={id} />
            }
        >
            <Card className="p-6">
                <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Storefront details
                </h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Name">{name}</Field>
                    <Field label="Slug">{(sf.slug as string) || '—'}</Field>
                    <Field label="Domain">{(sf.domain as string) || '—'}</Field>
                    <Field label="Currency">
                        {(sf.currency as string) || 'INR'}
                    </Field>
                    <Field label="Logo" fullWidth>
                        {sf.logoUrl ? (
                            <a
                                href={sf.logoUrl as string}
                                target="_blank"
                                rel="noreferrer"
                                className="text-zoru-primary hover:underline"
                            >
                                View logo
                            </a>
                        ) : (
                            '—'
                        )}
                    </Field>
                </div>
            </Card>

            <Card className="p-6">
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Homepage blocks
                </h2>
                <p className="mb-3 text-[12px] text-zoru-ink-muted">
                    Rich block editor coming. Raw JSON preview shown below.
                </p>
                <pre className="overflow-x-auto rounded-md border border-zoru-line bg-zoru-surface-2 p-3 text-[11.5px] text-zoru-ink">
                    {blocksString}
                </pre>
            </Card>
        </EntityDetailShell>
    );
}
