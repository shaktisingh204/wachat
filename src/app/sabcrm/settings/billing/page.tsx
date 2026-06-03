'use client';

/**
 * SabCRM — Billing & Plan settings (`/sabcrm/settings/billing`), Twenty-style.
 *
 * SabCRM billing is PLAN-BASED on top of SabNode's existing plan system — there
 * is NO Stripe / no metered billing here. Plan changes and payment are handled
 * centrally in the SabNode workspace (`/dashboard/billing`); this page is a
 * read-only, redirect-out view of where the active project stands today.
 *
 * Source of truth for the *current* plan is the session user:
 *   `useProject().sessionUser.plan` (`WithId<Plan> | null`). When it's null the
 *   project is on the implicit free / default tier and we say so honestly.
 *
 * Cards rendered:
 *   1. Current plan — name, price + currency (or "Free"), appCategory chip and
 *      an "Active" badge. Falls back to a "No plan / default" state.
 *   2. SabCRM entitlement — confirms SabCRM is included, sourced from
 *      `sabcrmPlanFeature` (id/name/icon/defaultEnabled) in `@/lib/plans`.
 *   3. Usage vs limits — live record total (sum of `countSabcrmRecordsTw`
 *      across standard objects) and member count, each metered against the
 *      relevant plan limit (records → nominal ceiling, members → agentLimit).
 *   4. Available plans — public CRM / All-In-One plans from `getPlans()`, each
 *      with key limits and an "Upgrade" button that links to SabNode billing.
 *      The plan matching the current one is marked "Current" instead.
 *
 * Everything degrades gracefully: skeletons while loading, a "no project"
 * notice, and an error banner if a data source is unavailable. The record /
 * member ceilings are NOMINAL display meters — actual enforcement lives in the
 * SabNode plan/credit layer.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  CreditCard,
  CheckCircle2,
  Database,
  Users,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

import { TwentyPageHeader, TwentyChip } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import { sabcrmPlanFeature } from '@/lib/plans';
import { getPlans } from '@/app/actions/plan.actions';
import {
  listSabcrmObjectsTw,
  countSabcrmRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import { listMembersAction } from '@/app/actions/sabcrm.actions';
import type { Plan } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './billing.css';

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

/** "₹499 / mo" style price, or "Free" when there is no price. */
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
// Usage meter (progress bar + labels)
// ---------------------------------------------------------------------------

function UsageMeter({ used, limit }: { used: number; limit: number }): React.JSX.Element {
  const pct = clampPct(used, limit);
  const tone = meterTone(used, limit);
  const pctLabel = Math.round((used / limit) * 100);

  const fillClass =
    tone === 'over'
      ? 'st-usage-bar__fill st-usage-bar__fill--over'
      : tone === 'warn'
        ? 'st-usage-bar__fill st-usage-bar__fill--warn'
        : 'st-usage-bar__fill';
  const pctClass =
    tone === 'over'
      ? 'st-usage-meter__pct st-usage-meter__pct--over'
      : tone === 'warn'
        ? 'st-usage-meter__pct st-usage-meter__pct--warn'
        : 'st-usage-meter__pct';

  return (
    <div className="st-usage-meter">
      <div
        className="st-usage-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-label={`${fmtNumber(used)} of ${fmtNumber(limit)} used`}
      >
        <span className={fillClass} style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="st-usage-meter__row">
        <span className={pctClass}>
          {Number.isFinite(pctLabel) ? `${pctLabel}%` : '—'}
          {tone === 'over' ? ' · over limit' : ''}
        </span>
        <span className="st-usage-meter__limit">of {fmtNumber(limit)}</span>
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
    <div className="st-stat-card">
      <div className="st-stat-card__head">
        <span className="st-stat-card__icon" aria-hidden="true">
          <Icon size={15} />
        </span>
        <span className="st-stat-card__label" title={label}>
          {label}
        </span>
      </div>

      {state.status === 'loading' ? (
        <span className="st-skel-line st-skel-line--value" aria-hidden="true" />
      ) : state.status === 'error' ? (
        <span className="st-stat-card__value-error">Unavailable</span>
      ) : (
        <span className="st-stat-card__value">{fmtNumber(state.count)}</span>
      )}

      <span className="st-billing-card__sub">{limitLabel}</span>

      {state.status === 'ready' ? (
        <UsageMeter used={state.count} limit={limit} />
      ) : (
        <div className="st-usage-meter" aria-hidden="true">
          <span className="st-skel-line st-skel-line--bar" />
        </div>
      )}
    </div>
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
  return (
    <div className={`st-plan-card${isCurrent ? ' st-plan-card--current' : ''}`}>
      <div className="st-plan-card__head">
        <span className="st-plan-card__name">{plan.name}</span>
        {isCurrent ? (
          <span className="st-plan-card__current-tag">Current</span>
        ) : null}
      </div>

      <div className="st-plan-card__price">
        <span className="st-plan-card__price-value">
          {fmtPrice(plan.price, plan.currency)}
        </span>
        {plan.price && plan.price > 0 ? (
          <span className="st-plan-card__price-unit">/ mo</span>
        ) : null}
      </div>

      {plan.appCategory ? (
        <div className="st-plan-card__chip">
          <TwentyChip label={plan.appCategory} />
        </div>
      ) : null}

      <ul className="st-plan-card__limits">
        <li>
          <span className="st-plan-card__limit-label">Projects</span>
          <span className="st-plan-card__limit-value">
            {fmtNumber(plan.projectLimit ?? 0)}
          </span>
        </li>
        <li>
          <span className="st-plan-card__limit-label">Members</span>
          <span className="st-plan-card__limit-value">
            {fmtNumber(plan.agentLimit ?? 0)}
          </span>
        </li>
        <li>
          <span className="st-plan-card__limit-label">Custom roles</span>
          <span className="st-plan-card__limit-value">
            {fmtNumber(plan.customRoleLimit ?? 0)}
          </span>
        </li>
      </ul>

      {isCurrent ? (
        <button type="button" className="st-btn st-btn--secondary st-plan-card__cta" disabled>
          <CheckCircle2 size={14} aria-hidden="true" />
          Current plan
        </button>
      ) : (
        <Link
          href={SABNODE_BILLING_HREF}
          className="st-btn st-btn--primary st-plan-card__cta"
        >
          <ArrowUpRight size={14} aria-hidden="true" />
          Upgrade
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmBillingSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject, sessionUser } = useProject();

  const currentPlan = sessionUser?.plan ?? null;

  // Usage — total records across standard objects + member count.
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

  // -------------------------------------------------------------------------

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Billing & Plan" icon={CreditCard} />
        <p className="st-settings__intro">
          SabCRM runs on your SabNode plan. This page shows your current plan and
          usage. Plans and payment are managed in your SabNode workspace billing.
        </p>

        {isLoadingProject ? (
          <div className="st-billing-grid">
            <div className="st-stat-card st-stat-card--skeleton" aria-hidden="true">
              <span className="st-skel-line st-skel-line--label" />
              <span className="st-skel-line st-skel-line--value" />
            </div>
          </div>
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">
              Select a project to view its plan and usage.
            </p>
          </div>
        ) : (
          <>
            {/* ---- Current plan + SabCRM entitlement ---- */}
            <section className="st-billing-section">
              <div className="st-billing-grid st-billing-grid--two">
                {/* Current plan card */}
                <div className="st-billing-card st-billing-card--plan">
                  <div className="st-billing-card__head">
                    <span className="st-billing-card__eyebrow">Current plan</span>
                    {currentPlan ? (
                      <span className="st-billing-badge">Active</span>
                    ) : (
                      <span className="st-billing-badge st-billing-badge--muted">
                        Default
                      </span>
                    )}
                  </div>

                  {currentPlan ? (
                    <>
                      <span className="st-billing-card__plan-name">
                        {currentPlan.name}
                      </span>
                      <div className="st-billing-card__price">
                        <span className="st-billing-card__price-value">
                          {fmtPrice(currentPlan.price, currentPlan.currency)}
                        </span>
                        {currentPlan.price && currentPlan.price > 0 ? (
                          <span className="st-billing-card__price-unit">/ mo</span>
                        ) : null}
                      </div>
                      {currentPlan.appCategory ? (
                        <div className="st-billing-card__chip">
                          <TwentyChip label={currentPlan.appCategory} />
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="st-billing-card__plan-name">
                        No plan / default
                      </span>
                      <div className="st-billing-card__price">
                        <span className="st-billing-card__price-value">Free</span>
                      </div>
                      <p className="st-billing-card__sub">
                        This project is on the default tier. Choose a plan below to
                        unlock higher limits.
                      </p>
                    </>
                  )}

                  <Link
                    href={SABNODE_BILLING_HREF}
                    className="st-btn st-btn--secondary st-billing-card__manage"
                  >
                    Manage in SabNode
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </div>

                {/* SabCRM entitlement card */}
                <div className="st-billing-card st-billing-card--entitlement">
                  <div className="st-billing-card__head">
                    <span className="st-billing-card__eyebrow">Entitlement</span>
                    <span className="st-billing-badge">Included</span>
                  </div>
                  <div className="st-entitlement-row">
                    <span className="st-entitlement-row__icon" aria-hidden="true">
                      <EntitlementIcon size={16} />
                    </span>
                    <div className="st-entitlement-row__body">
                      <span className="st-entitlement-row__name">
                        {sabcrmPlanFeature.name}
                      </span>
                      <span className="st-entitlement-row__meta">
                        {sabcrmPlanFeature.defaultEnabled
                          ? 'Included on all plans'
                          : 'Not included on this plan'}
                      </span>
                    </div>
                    {sabcrmPlanFeature.defaultEnabled ? (
                      <span className="st-entitlement-row__check" aria-hidden="true">
                        <CheckCircle2 size={16} />
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {/* ---- Usage vs limits ---- */}
            <section className="st-billing-section">
              <div className="st-billing-section__head">
                <h2 className="st-billing-section__title">Usage</h2>
                <span className="st-billing-section__hint">
                  Display meters — limits are enforced by your plan
                </span>
              </div>
              <div className="st-billing-grid">
                <UsageCard
                  label="Total records"
                  icon={Database}
                  state={recordsState}
                  limit={RECORDS_CEILING}
                  limitLabel={`Across standard objects · ${fmtNumber(
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
                      ? `Plan seat limit · ${fmtNumber(memberLimit)}`
                      : `Nominal limit · ${fmtNumber(memberLimit)}`
                  }
                />
              </div>
            </section>

            {/* ---- Available plans ---- */}
            <section className="st-billing-section">
              <div className="st-billing-section__head">
                <h2 className="st-billing-section__title">Available plans</h2>
                <span className="st-billing-section__hint">
                  CRM &amp; All-In-One plans
                </span>
              </div>

              {plansState.status === 'loading' ? (
                <div className="st-billing-grid st-billing-grid--plans">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="st-plan-card st-plan-card--skeleton"
                      aria-hidden="true"
                    >
                      <span className="st-skel-line st-skel-line--label" />
                      <span className="st-skel-line st-skel-line--value" />
                      <span className="st-skel-line st-skel-line--bar" />
                    </div>
                  ))}
                </div>
              ) : plansState.status === 'error' ? (
                <div className="st-banner">
                  <AlertTriangle className="st-banner__icon" size={16} />
                  <span>
                    Plans could not be loaded. You can still manage billing in your
                    SabNode workspace.
                  </span>
                </div>
              ) : plansState.plans.length === 0 ? (
                <div className="st-empty">
                  <span className="st-empty__icon">
                    <Sparkles size={20} />
                  </span>
                  <h2 className="st-empty__title">No upgrade plans available</h2>
                  <p className="st-empty__desc">
                    There are no public CRM or All-In-One plans to show right now.
                  </p>
                </div>
              ) : (
                <div className="st-billing-grid st-billing-grid--plans">
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

            <p className="st-billing-note">
              Plans and payment are managed in your SabNode workspace billing.
              Changes made there apply to SabCRM automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
