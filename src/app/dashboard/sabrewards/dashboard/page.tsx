import * as React from 'react';
import Link from 'next/link';
import {
  Coins,
  Gift,
  RefreshCcw,
  Share2,
  Trophy,
  Users,
  Crown,
  ListChecks,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  StatCard,
  EmptyState,
  Avatar,
  Separator,
} from '@/components/sabcrm/20ui';

import {
  getRewardsDashboard,
  listRewardsPrograms,
} from '@/app/actions/rewards.actions';
import { getLoyaltyProgramById } from '@/app/actions/crm-loyalty.actions';
import { TierLogicVisualizer } from '../../sabthrive/loyalty/[id]/tier-logic-visualizer';

export const dynamic = 'force-dynamic';

interface LoyaltyDoc {
  tiers?: Array<{ name: string; threshold?: number | null; multiplier?: number | null }>;
  expiryDays?: number | null;
}

export default async function RewardsDashboardPage(): Promise<React.JSX.Element> {
  const [{ kpis, topEarners }, programs] = await Promise.all([
    getRewardsDashboard(),
    listRewardsPrograms(),
  ]);

  const primaryProgram = programs[0];
  let tierEngine: LoyaltyDoc | null = null;
  if (primaryProgram?.tierEngineRef) {
    const doc = (await getLoyaltyProgramById(primaryProgram.tierEngineRef)) as LoyaltyDoc | null;
    tierEngine = doc;
  }

  return (
    <div className="20ui flex flex-col gap-6">
      <section aria-label="Program metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Members"
          value={kpis.totalMembers.toLocaleString()}
          icon={<Users />}
          accent="#2b6ef2"
        />
        <StatCard
          label="Points outstanding"
          value={kpis.pointsOutstanding.toLocaleString()}
          icon={<Coins />}
          accent="#d97706"
        />
        <StatCard
          label="Redemptions"
          value={kpis.redemptionsTotal.toLocaleString()}
          icon={<Gift />}
          accent="#7c3aed"
        />
        <StatCard
          label="Pending fulfilment"
          value={kpis.redemptionsPending.toLocaleString()}
          icon={<RefreshCcw />}
          accent="#dc2626"
        />
        <StatCard
          label="Referrals issued"
          value={kpis.referralsIssued.toLocaleString()}
          icon={<Share2 />}
          accent="#0891b2"
        />
        <StatCard
          label="Referral conversions"
          value={kpis.referralConversions.toLocaleString()}
          icon={<Trophy />}
          accent="#16a34a"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
              <div>
                <CardTitle>Top earners</CardTitle>
                <CardDescription>
                  Members ranked by lifetime points across every program.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {topEarners.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No members yet"
                description="Members appear on this leaderboard once they join a rewards program."
              />
            ) : (
              <ol className="flex flex-col divide-y divide-[var(--st-border)]">
                {topEarners.map((m, idx) => (
                  <li
                    key={m.memberId}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[12px] font-semibold tabular-nums text-[var(--st-text-secondary)]"
                      >
                        {idx + 1}
                      </span>
                      <Avatar name={`Customer ${m.customerId.slice(-6)}`} shape="round" size="sm" />
                      <div className="flex flex-col">
                        <span className="font-medium text-[var(--st-text)]">
                          Customer {m.customerId.slice(-6)}
                        </span>
                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                          {m.currentTier ? `${m.currentTier} tier` : 'Base tier'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-semibold tabular-nums text-[var(--st-text)]">
                        {m.lifetimePoints.toLocaleString()} pts
                      </span>
                      <span className="text-[12px] tabular-nums text-[var(--st-text-secondary)]">
                        {m.currentPoints.toLocaleString()} active
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
              <div>
                <CardTitle>Active programs</CardTitle>
                <CardDescription>
                  Each program reuses a loyalty tier engine, no duplication.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            {programs.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="No programs yet"
                description="Launch a program to start tracking points and tiers."
                action={
                  <Button variant="primary" asChild>
                    <Link href="/dashboard/sabthrive/loyalty/new">Create program</Link>
                  </Button>
                }
              />
            ) : (
              programs.slice(0, 5).map((p) => (
                <div
                  key={p._id}
                  className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium text-[var(--st-text)]">{p.name}</p>
                    <Badge tone={(p.status ?? 'active') === 'active' ? 'success' : 'neutral'}>
                      {p.status ?? 'active'}
                    </Badge>
                  </div>
                  {p.description ? (
                    <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">{p.description}</p>
                  ) : null}
                  <p className="mt-1.5 text-[12px] tabular-nums text-[var(--st-text-secondary)]">
                    {p.pointsExpireAfterDays
                      ? `Points expire after ${p.pointsExpireAfterDays} days`
                      : 'Points never expire'}
                  </p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </section>

      {tierEngine ? (
        <section>
          <Separator label="Tier engine" />
          <div className="mt-4">
            <TierLogicVisualizer
              tiers={tierEngine.tiers ?? undefined}
              expiryDays={tierEngine.expiryDays ?? undefined}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
