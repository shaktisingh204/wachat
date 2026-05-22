import { Button, Card } from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Pricing rule detail — `/dashboard/crm/store/pricing/[id]`.
 */

import Link from 'next/link';

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getPricingRuleById } from '@/app/actions/crm-store.actions';

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

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string | number | Date);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default async function PricingRuleDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const rule = await getPricingRuleById(id);
    if (!rule) notFound();

    const name = (rule.name as string) || `Rule ${id.slice(-6)}`;
    const status = (rule.status as string) || 'draft';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const conditionsJson = (() => {
        try {
            return JSON.stringify(rule.conditions ?? [], null, 2);
        } catch {
            return '[]';
        }
    })();
    const appliesTo = (rule.appliesTo as Record<string, unknown>) ?? {
        target: 'all',
    };

    return (
        <EntityDetailShell
            title={name}
            eyebrow="PRICING RULE"
            status={{ label: status, tone }}
            back={{
                href: '/dashboard/crm/store/pricing',
                label: 'Back to pricing rules',
            }}
            actions={
                <Button asChild>
                    <Link href={`/dashboard/crm/store/pricing/${id}/edit`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
            audit={
                <EntityAuditTimeline
                    entityKind="store_pricing_rule"
                    entityId={id}
                />
            }
        >
            <Card className="p-6">
                <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Rule details
                </h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Name">{name}</Field>
                    <Field label="Kind">{(rule.kind as string) || '—'}</Field>
                    <Field label="Value">{String(rule.value ?? '—')}</Field>
                    <Field label="Priority">{String(rule.priority ?? 0)}</Field>
                    <Field label="Starts at">{fmtDate(rule.startsAt)}</Field>
                    <Field label="Ends at">{fmtDate(rule.endsAt)}</Field>
                    <Field label="Storefront id" fullWidth>
                        <code className="text-[11.5px]">
                            {String(rule.storefrontId ?? '—')}
                        </code>
                    </Field>
                    <Field label="Applies to" fullWidth>
                        <span>
                            {(appliesTo.target as string) ?? 'all'}
                            {Array.isArray(appliesTo.ids) &&
                            appliesTo.ids.length > 0
                                ? ` · ${appliesTo.ids.length} id(s)`
                                : ''}
                        </span>
                    </Field>
                </div>
            </Card>

            <Card className="p-6">
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Conditions
                </h2>
                <pre className="overflow-x-auto rounded-md border border-zoru-line bg-zoru-surface-2 p-3 text-[11.5px] text-zoru-ink">
                    {conditionsJson}
                </pre>
            </Card>
        </EntityDetailShell>
    );
}
