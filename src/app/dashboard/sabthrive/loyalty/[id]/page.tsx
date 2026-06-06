import { Button, Card } from '@/components/sabcrm/20ui/compat';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Loyalty program detail — `/dashboard/sabthrive/loyalty/[id]`.
 *
 * Server component: fetches via `getLoyaltyProgramById`, renders the
 * `<EntityDetailShell>` with header (status pill + Edit), a Card
 * body, and an Activity footer for `entityKind: 'loyaltyProgram'`.
 */

import Link from 'next/link';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getLoyaltyProgramById } from '@/app/actions/crm-loyalty.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { SimulatePointsCalculator } from './simulate-points-calculator';
import { TierLogicVisualizer } from './tier-logic-visualizer';
import { WidgetIntegration } from './widget-integration';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, EntityStatusTone> = {
    active: 'green',
    paused: 'amber',
    archived: 'red',
};

export interface LoyaltyTier {
    name: string;
    threshold?: number | null;
    multiplier?: number | null;
    perks?: string | null;
}

export interface LoyaltyProgram {
    _id: string;
    name: string;
    status: string;
    pointsPerCurrencyUnit?: number | null;
    redemptionRatio?: number | null;
    minRedemptionPoints?: number | null;
    expiryDays?: number | null;
    welcomeBonus?: number | null;
    tiers?: LoyaltyTier[];
    notes?: string | null;
}

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
    const program = result as unknown as LoyaltyProgram;

    const name = program.name || 'Loyalty program';
    const status = program.status || 'active';
    const tone = STATUS_TONE[status] ?? 'neutral';

    return (
        <EntityDetailShell
            title={name}
            eyebrow="LOYALTY PROGRAM"
            status={{ label: status, tone }}
            back={{ href: '/dashboard/sabthrive/loyalty', label: 'Back to loyalty' }}
            actions={
                <Button asChild>
                    <Link href={`/dashboard/sabthrive/loyalty/${id}/edit`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
            audit={<EntityAuditTimeline entityKind="loyaltyProgram" entityId={id} />}
        >
            <div className="space-y-6">
                <Card className="p-6">
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
                                    {program.tiers.map((tier, idx) => (
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
                                <p className="whitespace-pre-wrap">{program.notes}</p>
                            </Field>
                        ) : null}
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <SimulatePointsCalculator 
                        pointsPerCurrencyUnit={program.pointsPerCurrencyUnit} 
                        redemptionRatio={program.redemptionRatio}
                        tiers={program.tiers} 
                    />
                    <div className="space-y-6">
                        <TierLogicVisualizer 
                            tiers={program.tiers} 
                            expiryDays={program.expiryDays}
                        />
                        <WidgetIntegration loyaltyId={id} />
                    </div>
                </div>
            </div>
        </EntityDetailShell>
    );
}
