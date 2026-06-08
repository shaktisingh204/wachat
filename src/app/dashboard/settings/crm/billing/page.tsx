'use client';

/**
 * SabCRM - Billing & Plan settings (`/dashboard/settings/crm/billing`).
 *
 * SabCRM billing is PLAN-BASED on top of SabNode's existing plan system - there
 * is NO Stripe / no metered billing here. Plan changes and payment are handled
 * centrally in the SabNode workspace (`/dashboard/billing`); this page is a
 * read-only, redirect-out view of where the active project stands today.
 *
 * Source of truth for the *current* plan is the session user:
 *   `useProject().sessionUser.plan` (`WithId<Plan> | null`). When it's null the
 *   project is on the implicit free / default tier and we say so honestly.
 *
 * Cards rendered:
 *   1. Current plan - name, price + currency (or "Free"), appCategory chip and
 *      an "Active" badge. Falls back to a "No plan / default" state.
 *   2. SabCRM entitlement - confirms SabCRM is included, sourced from
 *      `sabcrmPlanFeature` (id/name/icon/defaultEnabled) in `@/lib/plans`.
 *   3. Usage vs limits - live record total (sum of `countSabcrmRecordsTw`
 *      across standard objects) and member count, each metered against the
 *      relevant plan limit (records -> nominal ceiling, members -> agentLimit).
 *   4. Available plans - public CRM / All-In-One plans from `getPlans()`, each
 *      with key limits and an "Upgrade" button that links to SabNode billing.
 *      The plan matching the current one is marked "Current" instead.
 *
 * Everything degrades gracefully: skeletons while loading, a "no project"
 * notice, and an error banner if a data source is unavailable. The record /
 * member ceilings are NOMINAL display meters - actual enforcement lives in the
 * SabNode plan/credit layer.
 *
 * UI: pure 20ui design system (`@/components/sabcrm/20ui`).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  CheckCircle2,
  Database,
  Users,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Badge,
  Button,
  Progress,
  Skeleton,
  Alert,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { sabcrmPlanFeature, planFeatureMap } from '@/lib/plans';
import type { PlanFeaturePermissions } from '@/lib/definitions';
import { getPlans } from '@/app/actions/plan.actions';
import {
  listSabcrmObjectsTw,
  countSabcrmRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import { listMembersAction } from '@/app/actions/sabcrm.actions';
import type { Plan } from '@/lib/definitions';
import type { WithId } from 'mongodb';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Where plan changes + payment actually happen (centralized in SabNode). */
const SABNODE_BILLING_HREF = '/dashboard/billing';

/** appCategories that surface as upgradeable SabCRM plans. */
const CRM_PLAN_CATEGORIES: ReadonlySet<NonNullable<Plan['appCategory']>> =
  new Set(['CRM', 'All-In-One']);

/** Nominal records ceiling for the usage meter (display only, not enforced). */
const RECORDS_CEILING = 100_000;

/**
 * Feature keys (subset of `PlanFeaturePermissions`) most relevant to a SabCRM
 * user, surfaced as benefit rows when enabled on the current plan.
 */
const CRM_FEATURE_KEYS: readonly (keyof PlanFeaturePermissions)[] = [
  'crmDashboard',
  'crmSales',
  'crmSalesCrm',
  'crmPurchases',
  'crmInventory',
  'crmAccounting',
  'crmBanking',
  'crmHrPayroll',
  'crmGstReports',
  'crmIntegrations',
  'crmSettings',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtNumber(n: number): string {
  try {
    return n.toLocaleString();
  } catch {
    return String(n);
  }
}

/** "INR 499" style price, or "Free" when there is no price. */
function fmtPrice(price: number | undefined, currency: string | undefined): string {
  if (!price || price <= 0) return 'Free';
  const cur = (currency || '').trim();
  return `${cur ? `${cur} ` : ''}${fmtNumber(price)}`;
}

function clampPct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  const pct = used / limit;
  if (!Number.isFinite(pct) || pct < 0) return 0;
  return pct > 1 ? 1 : pct;
}

type MeterTone = 'ok' | 'warn' | 'over';

function meterTone(used: number, limit: number): MeterTone {
  if (limit <= 0) return 'ok';
  const ratio = used / limit;
  if (ratio >= 1) return 'over';
  if (ratio >= 0.75) return 'warn';
  return 'ok';
}

/** Map the local meter tone onto a 20ui Progress tone. */
function progressTone(tone: MeterTone): 'accent' | 'warning' | 'danger' {
  if (tone === 'over') return 'danger';
  if (tone === 'warn') return 'warning';
  return 'accent';
}

// ---------------------------------------------------------------------------
// Async data states
// ---------------------------------------------------------------------------

type CountState =
  | { status: 'loading' }
  | { status: 'ready'; count: number }
  | { status: 'error' };

type PlansState =
  | { status: 'loading' }
  | { status: 'ready'; plans: WithId<Plan>[] }
  | { status: 'error' };

// ---------------------------------------------------------------------------
// Usage meter (Progress bar + labels)
// ---------------------------------------------------------------------------

function UsageMeter({ used, limit }: { used: number; limit: number }): React.JSX.Element {
  const pct = clampPct(used, limit);
  const tone = meterTone(used, limit);
  const pctLabel = Math.round((used / limit) * 100);
  const pctToneClass =
    tone === 'over'
      ? 'text-[var(--st-danger)]'
      : tone === 'warn'
        ? 'text-[var(--st-warn)]'
        : 'text-[var(--st-text-secondary)]';

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <Progress
        value={pct * 100}
        tone={progressTone(tone)}
        size="sm"
        label={`${fmtNumber(used)} of ${fmtNumber(limit)} used`}
        aria-label={`${fmtNumber(used)} of ${fmtNumber(limit)} used`}
      />
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${pctToneClass}`}>
          {Number.isFinite(pctLabel) ? `${pctLabel}%` : '0%'}
          {tone === 'over' ? ' . over limit' : ''}
        </span>
        <span className="text-[var(--st-text-tertiary)]">of {fmtNumber(limit)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usage stat card
// ---------------------------------------------------------------------------

function UsageCard({
  label,
  icon: Icon,
  state,
  limit,
  limitLabel,
}: {
  label: string;
  icon: React.ElementType;
  state: CountState;
  limit: number;
  limitLabel: string;
}): React.JSX.Element {
  return (
    <Card variant="outlined" padding="md">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
          aria-hidden="true"
        >
          <Icon size={15} />
        </span>
        <span className="text-sm font-medium text-[var(--st-text)]" title={label}>
          {label}
        </span>
      </div>

      {state.status === 'loading' ? (
        <Skeleton width={96} height={28} radius={6} />
      ) : state.status === 'error' ? (
        <span className="text-2xl font-semibold text-[var(--st-text-tertiary)]">
          Unavailable
        </span>
      ) : (
        <span className="text-2xl font-semibold text-[var(--st-text)]">
          {fmtNumber(state.count)}
        </span>
      )}

      <span className="mt-1 block text-xs text-[var(--st-text-secondary)]">
        {limitLabel}
      </span>

      {state.status === 'ready' ? (
        <UsageMeter used={state.count} limit={limit} />
      ) : (
        <div className="mt-3">
          <Skeleton width="100%" height={8} radius={999} />
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Available plan card
// ---------------------------------------------------------------------------

function PlanCard({
  plan,
  isCurrent,
}: {
  plan: WithId<Plan>;
  isCurrent: boolean;
}): React.JSX.Element {
  const router = useRouter();

  return (
    <Card variant={isCurrent ? 'elevated' : 'outlined'} padding="md">
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>{plan.name}</CardTitle>
        {isCurrent ? <Badge tone="accent">Current</Badge> : null}
      </CardHeader>

      <CardBody>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold text-[var(--st-text)]">
            {fmtPrice(plan.price, plan.currency)}
          </span>
          {plan.price && plan.price > 0 ? (
            <span className="text-sm text-[var(--st-text-secondary)]">/ mo</span>
          ) : null}
        </div>

        {plan.appCategory ? (
          <div className="mt-2">
            <Badge tone="neutral">{plan.appCategory}</Badge>
          </div>
        ) : null}

        <ul className="mt-3 flex flex-col gap-2 border-t border-[var(--st-border)] pt-3">
          <li className="flex items-center justify-between text-sm">
            <span className="text-[var(--st-text-secondary)]">Projects</span>
            <span className="font-medium text-[var(--st-text)]">
              {fmtNumber(plan.projectLimit ?? 0)}
            </span>
          </li>
          <li className="flex items-center justify-between text-sm">
            <span className="text-[var(--st-text-secondary)]">Members</span>
            <span className="font-medium text-[var(--st-text)]">
              {fmtNumber(plan.agentLimit ?? 0)}
            </span>
          </li>
          <li className="flex items-center justify-between text-sm">
            <span className="text-[var(--st-text-secondary)]">Custom roles</span>
            <span className="font-medium text-[var(--st-text)]">
              {fmtNumber(plan.customRoleLimit ?? 0)}
            </span>
          </li>
        </ul>
      </CardBody>

      <CardFooter>
        {isCurrent ? (
          <Button
            variant="secondary"
            block
            disabled
            iconLeft={CheckCircle2}
          >
            Current plan
          </Button>
        ) : (
          <Button
            variant="primary"
            block
            iconLeft={ArrowUpRight}
            onClick={() => router.push(SABNODE_BILLING_HREF)}
          >
            Upgrade
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmBillingSettingsPage(): React.JSX.Element {
  const router = useRouter();
  const { activeProjectId, isLoadingProject, sessionUser } = useProject();

  const currentPlan = sessionUser?.plan ?? null;

  // Usage - total records across standard objects + member count.
  const [recordsState, setRecordsState] = React.useState<CountState>({
    status: 'loading',
  });
  const [memberState, setMemberState] = React.useState<CountState>({
    status: 'loading',
  });

  // Available upgradeable plans.
  const [plansState, setPlansState] = React.useState<PlansState>({
    status: 'loading',
  });

  // ----- Records total (sum across standard objects) -----
  const loadRecords = React.useCallback(async (projectId: string) => {
    setRecordsState({ status: 'loading' });
    try {
      const res = await listSabcrmObjectsTw(projectId);
      if (!res.ok) {
        setRecordsState({ status: 'error' });
        return;
      }
      const standard = res.data.filter((o) => o.standard);
      if (standard.length === 0) {
        setRecordsState({ status: 'ready', count: 0 });
        return;
      }
      const results = await Promise.all(
        standard.map(async (obj) => {
          try {
            const cRes = await countSabcrmRecordsTw(obj.slug, {}, projectId);
            return cRes.ok ? cRes.data.count : null;
          } catch {
            return null;
          }
        }),
      );
      // If every single count failed, surface unavailable rather than a false 0.
      if (results.every((r) => r === null)) {
        setRecordsState({ status: 'error' });
        return;
      }
      const total = results.reduce<number>((acc, r) => acc + (r ?? 0), 0);
      setRecordsState({ status: 'ready', count: total });
    } catch {
      setRecordsState({ status: 'error' });
    }
  }, []);

  // ----- Members -----
  const loadMembers = React.useCallback(async (projectId: string) => {
    setMemberState({ status: 'loading' });
    try {
      const res = await listMembersAction(projectId);
      setMemberState(
        res.ok
          ? { status: 'ready', count: res.data.length }
          : { status: 'error' },
      );
    } catch {
      setMemberState({ status: 'error' });
    }
  }, []);

  // ----- Available plans (workspace-wide, not project-scoped) -----
  const loadPlans = React.useCallback(async () => {
    setPlansState({ status: 'loading' });
    try {
      const all = await getPlans();
      const eligible = all.filter(
        (p) =>
          p.isPublic &&
          p.appCategory != null &&
          CRM_PLAN_CATEGORIES.has(p.appCategory),
      );
      setPlansState({ status: 'ready', plans: eligible });
    } catch {
      setPlansState({ status: 'error' });
    }
  }, []);

  React.useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setRecordsState({ status: 'error' });
      setMemberState({ status: 'error' });
      return;
    }
    void loadRecords(activeProjectId);
    void loadMembers(activeProjectId);
  }, [activeProjectId, isLoadingProject, loadRecords, loadMembers]);

  // Member meter ceiling: plan's agentLimit when known, else a nominal default.
  const memberLimit =
    currentPlan?.agentLimit && currentPlan.agentLimit > 0
      ? currentPlan.agentLimit
      : 50;

  const EntitlementIcon = sabcrmPlanFeature.icon;

  // CRM-relevant features enabled on the current plan, resolved to a
  // display name via `planFeatureMap`. Empty when the plan is unknown.
  const enabledFeatures = React.useMemo(() => {
    const features = currentPlan?.features;
    if (!features) return [];
    return CRM_FEATURE_KEYS.filter((key) => features[key] === true)
      .map((key) => planFeatureMap.find((f) => f.id === key))
      .filter((f): f is (typeof planFeatureMap)[number] => f != null);
  }, [currentPlan]);

  // -------------------------------------------------------------------------

  return (
    <div className="20ui mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCRM</PageEyebrow>
          <PageTitle>
            <span className="inline-flex items-center gap-2">
              <CreditCard size={18} aria-hidden="true" />
              Billing &amp; Plan
            </span>
          </PageTitle>
          <PageDescription>
            SabCRM runs on your SabNode plan. This page shows your current plan
            and usage. Plans and payment are managed in your SabNode workspace
            billing.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-6 flex flex-col gap-8">
        {isLoadingProject ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card variant="outlined" padding="md">
              <Skeleton width={120} height={14} radius={6} />
              <div className="mt-3">
                <Skeleton width={160} height={24} radius={6} />
              </div>
            </Card>
          </div>
        ) : !activeProjectId ? (
          <EmptyState
            icon={AlertTriangle}
            tone="warning"
            title="No project selected"
            description="Select a project to view its plan and usage."
          />
        ) : (
          <>
            {/* ---- Current plan + SabCRM entitlement ---- */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Current plan card */}
              <Card variant="outlined" padding="md">
                <CardHeader className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Current plan
                  </span>
                  {currentPlan ? (
                    <Badge tone="success" dot>
                      Active
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Default</Badge>
                  )}
                </CardHeader>

                <CardBody>
                  {currentPlan ? (
                    <>
                      <span className="block text-lg font-semibold text-[var(--st-text)]">
                        {currentPlan.name}
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-semibold text-[var(--st-text)]">
                          {fmtPrice(currentPlan.price, currentPlan.currency)}
                        </span>
                        {currentPlan.price && currentPlan.price > 0 ? (
                          <span className="text-sm text-[var(--st-text-secondary)]">
                            / mo
                          </span>
                        ) : null}
                      </div>
                      {currentPlan.appCategory ? (
                        <div className="mt-2">
                          <Badge tone="neutral">{currentPlan.appCategory}</Badge>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="block text-lg font-semibold text-[var(--st-text)]">
                        No plan / default
                      </span>
                      <div className="mt-1">
                        <span className="text-xl font-semibold text-[var(--st-text)]">
                          Free
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
                        This project is on the default tier. Choose a plan below
                        to unlock higher limits.
                      </p>
                    </>
                  )}
                </CardBody>

                <CardFooter>
                  <Button
                    variant="secondary"
                    iconRight={ArrowUpRight}
                    onClick={() => router.push(SABNODE_BILLING_HREF)}
                  >
                    Manage in SabNode
                  </Button>
                </CardFooter>
              </Card>

              {/* SabCRM entitlement card */}
              <Card variant="outlined" padding="md">
                <CardHeader className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Entitlement
                  </span>
                  <Badge tone="success">Included</Badge>
                </CardHeader>

                <CardBody>
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                      aria-hidden="true"
                    >
                      <EntitlementIcon size={16} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium text-[var(--st-text)]">
                        {sabcrmPlanFeature.name}
                      </span>
                      <span className="text-xs text-[var(--st-text-secondary)]">
                        {sabcrmPlanFeature.defaultEnabled
                          ? 'Included on all plans'
                          : 'Not included on this plan'}
                      </span>
                    </div>
                    {sabcrmPlanFeature.defaultEnabled ? (
                      <span
                        className="text-[var(--st-status-ok)]"
                        aria-hidden="true"
                      >
                        <CheckCircle2 size={16} />
                      </span>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            </section>

            {/* ---- Plan features (what this plan includes) ---- */}
            {enabledFeatures.length > 0 ? (
              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-[var(--st-text)]">
                    What&rsquo;s included
                  </h2>
                  <span className="text-xs text-[var(--st-text-secondary)]">
                    CRM features on your plan
                  </span>
                </div>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {enabledFeatures.map((feature) => {
                    const FeatureIcon = feature.icon;
                    return (
                      <li
                        key={feature.id}
                        className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
                      >
                        <span
                          className="text-[var(--st-status-ok)]"
                          aria-hidden="true"
                        >
                          {FeatureIcon ? (
                            <FeatureIcon size={14} />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                        </span>
                        <span
                          className="truncate text-sm text-[var(--st-text)]"
                          title={feature.name}
                        >
                          {feature.name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {/* ---- Usage vs limits ---- */}
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--st-text)]">
                  Usage
                </h2>
                <span className="text-xs text-[var(--st-text-secondary)]">
                  Display meters. Limits are enforced by your plan.
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <UsageCard
                  label="Total records"
                  icon={Database}
                  state={recordsState}
                  limit={RECORDS_CEILING}
                  limitLabel={`Across standard objects . ${fmtNumber(
                    RECORDS_CEILING,
                  )} ceiling`}
                />
                <UsageCard
                  label="Workspace members"
                  icon={Users}
                  state={memberState}
                  limit={memberLimit}
                  limitLabel={
                    currentPlan?.agentLimit
                      ? `Plan seat limit . ${fmtNumber(memberLimit)}`
                      : `Nominal limit . ${fmtNumber(memberLimit)}`
                  }
                />
              </div>
            </section>

            {/* ---- Available plans ---- */}
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--st-text)]">
                  Available plans
                </h2>
                <span className="text-xs text-[var(--st-text-secondary)]">
                  CRM &amp; All-In-One plans
                </span>
              </div>

              {plansState.status === 'loading' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} variant="outlined" padding="md">
                      <Skeleton width={120} height={14} radius={6} />
                      <div className="mt-3">
                        <Skeleton width={90} height={22} radius={6} />
                      </div>
                      <div className="mt-4">
                        <Skeleton width="100%" height={8} radius={999} />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : plansState.status === 'error' ? (
                <Alert tone="warning" icon={AlertTriangle}>
                  Plans could not be loaded. You can still manage billing in your
                  SabNode workspace.
                </Alert>
              ) : plansState.plans.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="No upgrade plans available"
                  description="There are no public CRM or All-In-One plans to show right now."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {plansState.plans.map((plan) => (
                    <PlanCard
                      key={plan._id.toString()}
                      plan={plan}
                      isCurrent={
                        currentPlan != null &&
                        currentPlan._id.toString() === plan._id.toString()
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <p className="text-xs text-[var(--st-text-tertiary)]">
              Plans and payment are managed in your SabNode workspace billing.
              Changes made there apply to SabCRM automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
