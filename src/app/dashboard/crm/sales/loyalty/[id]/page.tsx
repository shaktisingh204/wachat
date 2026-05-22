import { Button, Card } from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Loyalty program detail — `/dashboard/crm/sales/loyalty/[id]`.
 *
 * Server component: fetches via `getLoyaltyProgramById`, renders the
 * `<EntityDetailShell>` with header (status pill + Edit), a Card
 * body, and an Activity footer for `entityKind: 'loyaltyProgram'`.
 */

import Link from 'next/link';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getLoyaltyProgramById } from '@/app/actions/crm-loyalty.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, EntityStatusTone> = {
    active: 'green',
    paused: 'amber',
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

export default async function LoyaltyDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const result = await getLoyaltyProgramById(id);
    if (!result) notFound();
    const program: Record<string, any> = result!;

    const name = (program.name as string) || 'Loyalty program';
    const status = (program.status as string) || 'active';
    const tone = STATUS_TONE[status] ?? 'neutral';

    return (
        <EntityDetailShell
            title={name}
            eyebrow="LOYALTY PROGRAM"
            status={{ label: status, tone }}
            back={{ href: '/dashboard/crm/sales/loyalty', label: 'Back to loyalty' }}
            actions={
                <ZoruButton asChild>
                    <Link href={`/dashboard/crm/sales/loyalty/${id}/edit`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                    </Link>
                </ZoruButton>
            }
            audit={<EntityAuditTimeline entityKind="loyaltyProgram" entityId={id} />}
        >
            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Program details
                </h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Name">{name}</Field>
                    <Field label="Status">{status}</Field>
                    <Field label="Points per ₹1 spent">
                        {program.pointsPerCurrencyUnit ?? '—'}
                    </Field>
                    <Field label="Redemption ratio">
                        {program.redemptionRatio
                            ? `${program.redemptionRatio} pts = ₹1`
                            : '—'}
                    </Field>
                    <Field label="Min redemption">
                        {program.minRedemptionPoints ?? '—'}
                    </Field>
                    <Field label="Points expiry">
                        {program.expiryDays ? `${program.expiryDays} days` : '—'}
                    </Field>
                    <Field label="Welcome bonus">{program.welcomeBonus ?? '—'}</Field>
                    {Array.isArray(program.tiers) && program.tiers.length > 0 ? (
                        <Field label="Tiers" fullWidth>
                            <ul className="list-disc pl-5">
                                {(program.tiers as any[]).map((tier, idx) => (
                                    <li key={idx}>
                                        <span className="font-medium">{tier.name}</span>
                                        {tier.threshold != null
                                            ? ` · ${tier.threshold} pts`
                                            : ''}
                                        {tier.multiplier != null
                                            ? ` · ${tier.multiplier}× earn`
                                            : ''}
                                        {tier.perks ? ` · ${tier.perks}` : ''}
                                    </li>
                                ))}
                            </ul>
                        </Field>
                    ) : null}
                    {program.notes ? (
                        <Field label="Notes" fullWidth>
                            <p className="whitespace-pre-wrap">{String(program.notes)}</p>
                        </Field>
                    ) : null}
                </div>
            </ZoruCard>
        </EntityDetailShell>
    );
}
