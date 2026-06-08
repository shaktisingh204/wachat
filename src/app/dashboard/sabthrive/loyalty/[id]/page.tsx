/**
 * Loyalty program detail — `/dashboard/sabthrive/loyalty/[id]`.
 *
 * Server component: fetches via `getLoyaltyProgramById`, renders the
 * `<EntityDetailShell>` with a KPI strip, a program-details Card, the points
 * calculator + tier visualizer + widget embed, and an audit footer.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Coins, Crown, Gift, ListTree, Pencil, Repeat, Timer } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  StatCard,
} from '@/components/sabcrm/20ui';

import {
  EntityDetailShell,
  type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getLoyaltyProgramById } from '@/app/actions/crm-loyalty.actions';
import { SimulatePointsCalculator } from './simulate-points-calculator';
import { TierLogicVisualizer } from './tier-logic-visualizer';
import { WidgetIntegration } from './widget-integration';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, EntityStatusTone> = {
  active: 'green',
  paused: 'amber',
  draft: 'neutral',
  archived: 'red',
  cancelled: 'red',
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

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[var(--st-space-2)]">
      <dt className="text-[13px] text-[var(--st-text-secondary)]">{label}</dt>
      <dd className="text-[13px] font-medium tabular-nums text-[var(--st-text)]">
        {children}
      </dd>
    </div>
  );
}

export default async function LoyaltyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const result = await getLoyaltyProgramById(id);
  if (!result) notFound();
  const program = result as unknown as LoyaltyProgram;

  const name = program.name || 'Loyalty program';
  const status = program.status || 'active';
  const tone = STATUS_TONE[status.toLowerCase()] ?? 'neutral';
  const tierCount = Array.isArray(program.tiers) ? program.tiers.length : 0;

  return (
    <EntityDetailShell
      title={name}
      eyebrow="Loyalty"
      status={{ label: status, tone }}
      back={{ href: '/dashboard/sabthrive/loyalty', label: 'Loyalty' }}
      actions={
        <Button variant="primary" asChild>
          <Link href={`/dashboard/sabthrive/loyalty/${id}/edit`}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit program
          </Link>
        </Button>
      }
      audit={<EntityAuditTimeline entityKind="loyaltyProgram" entityId={id} />}
    >
      <div className="flex flex-col gap-[var(--st-space-5)]">
        <section
          aria-label="Program metrics"
          className="grid grid-cols-2 gap-[var(--st-space-3)] lg:grid-cols-4"
        >
          <StatCard
            label="Points per ₹1"
            value={(program.pointsPerCurrencyUnit ?? 1).toLocaleString()}
            icon={Coins}
            accent="#3b7af5"
          />
          <StatCard
            label="Redemption ratio"
            value={
              program.redemptionRatio
                ? `${program.redemptionRatio.toLocaleString()} : ₹1`
                : '—'
            }
            icon={Repeat}
            accent="#7c3aed"
          />
          <StatCard
            label="Points expiry"
            value={program.expiryDays ? `${program.expiryDays} days` : 'Never'}
            icon={Timer}
            accent="#d97706"
          />
          <StatCard
            label="Welcome bonus"
            value={(program.welcomeBonus ?? 0).toLocaleString()}
            icon={Gift}
            accent="#1f9d55"
          />
        </section>

        <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center gap-[var(--st-space-2)]">
                <ListTree className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                <CardTitle>Program details</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-[var(--st-border)]">
                <DetailRow label="Status">
                  <Badge tone={tone === 'green' ? 'success' : tone === 'red' ? 'danger' : tone === 'amber' ? 'warning' : 'neutral'}>
                    {status}
                  </Badge>
                </DetailRow>
                <DetailRow label="Tiers">
                  {tierCount > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Crown className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                      {tierCount}
                    </span>
                  ) : (
                    'No tiers'
                  )}
                </DetailRow>
                <DetailRow label="Minimum redemption">
                  {program.minRedemptionPoints ?? '—'}
                </DetailRow>
                <DetailRow label="Points per ₹1 spent">
                  {program.pointsPerCurrencyUnit ?? '—'}
                </DetailRow>
                <DetailRow label="Redemption ratio">
                  {program.redemptionRatio
                    ? `${program.redemptionRatio} pts = ₹1`
                    : '—'}
                </DetailRow>
              </dl>
              {program.notes ? (
                <div className="mt-[var(--st-space-3)] border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Notes
                  </p>
                  <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                    {program.notes}
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <div className="lg:col-span-2">
            <SimulatePointsCalculator
              pointsPerCurrencyUnit={program.pointsPerCurrencyUnit}
              redemptionRatio={program.redemptionRatio}
              tiers={program.tiers}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-2">
          <TierLogicVisualizer tiers={program.tiers} expiryDays={program.expiryDays} />
          <WidgetIntegration loyaltyId={id} />
        </div>
      </div>
    </EntityDetailShell>
  );
}
