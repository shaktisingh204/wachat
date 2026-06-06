import * as React from 'react';
import Link from 'next/link';
import { Coins, Gift, RefreshCcw, Share2, Trophy, Users } from 'lucide-react';

import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, StatCard, EmptyState } from '@/components/sabcrm/20ui';

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
    <div className="ui20 flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Members" value={kpis.totalMembers.toLocaleString()} icon={<Users />} />
        <StatCard
          label="Points outstanding"
          value={kpis.pointsOutstanding.toLocaleString()}
          icon={<Coins />}
        />
        <StatCard
          label="Redemptions"
          value={kpis.redemptionsTotal.toLocaleString()}
          icon={<Gift />}
        />
        <StatCard
          label="Pending fulfilment"
          value={kpis.redemptionsPending.toLocaleString()}
          icon={<RefreshCcw />}
        />
        <StatCard
          label="Referrals issued"
          value={kpis.referralsIssued.toLocaleString()}
          icon={<Share2 />}
        />
        <StatCard
          label="Referral conversions"
          value={kpis.referralConversions.toLocaleString()}
          icon={<Trophy />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top earners</CardTitle>
            <CardDescription>
              Members ranked by lifetime points across all rewards programs.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {topEarners.length === 0 ? (
              <EmptyState
                title="No members yet"
                description="Once customers join a rewards program they will appear on this leaderboard."
              />
            ) : (
              <ol className="flex flex-col divide-y divide-[var(--st-border)]">
                {topEarners.map((m, idx) => (
                  <li
                    key={m.memberId}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[12px] font-semibold text-[var(--st-text)]">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-medium text-[var(--st-text)]">
                          Customer {m.customerId.slice(-6)}
                        </span>
                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                          {m.currentTier ? `Tier · ${m.currentTier}` : 'Base tier'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-[var(--st-text)]">
                        {m.lifetimePoints.toLocaleString()} pts
                      </span>
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
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
            <CardTitle>Active programs</CardTitle>
            <CardDescription>
              Each program reuses a loyalty tier engine, no duplication.
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            {programs.length === 0 ? (
              <EmptyState
                title="No rewards programs yet"
                description="Launch your first program to start tracking points and tiers."
                action={
                  <Button variant="primary">
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
                  <p className="text-[13px] font-medium text-[var(--st-text)]">{p.name}</p>
                  {p.description ? (
                    <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">{p.description}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                    {p.status ?? 'active'} ·{' '}
                    {p.pointsExpireAfterDays
                      ? `Points expire after ${p.pointsExpireAfterDays}d`
                      : 'No expiry'}
                  </p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </section>

      {tierEngine ? (
        <section>
          <TierLogicVisualizer
            tiers={tierEngine.tiers ?? undefined}
            expiryDays={tierEngine.expiryDays ?? undefined}
          />
        </section>
      ) : null}
    </div>
  );
}
