'use client';

/**
 * SabCRM — Usage & Limits settings (`/dashboard/settings/crm/usage`), Twenty-style.
 *
 * A read-only dashboard of how much of the workspace this project is using,
 * scoped to the active project via `useProject()`:
 *
 *   1. Records by object — one Twenty stat card per STANDARD object, showing
 *      its live record count (`countSabcrmRecordsTw(slug)`) and a progress bar
 *      measuring that count against a nominal per-object plan ceiling. Cards
 *      load independently so one slow/failed count never blocks the rest.
 *
 *   2. Totals summary — an aggregate stat card: total records across every
 *      standard object measured against the combined ceiling, plus the count
 *      of objects tracked.
 *
 *   3. Workspace — a single card with the member count (`listMembersAction`)
 *      measured against a nominal seat ceiling.
 *
 * The object catalogue comes from `listSabcrmObjectsTw`; counts and the member
 * roster each re-run the session → project → RBAC → plan pipeline server-side,
 * so the page fails closed. States: skeleton cards while objects/counts load,
 * a "no project" notice, an error banner when the catalogue can't load, and
 * graceful per-card degradation when an individual count is unavailable.
 *
 * NOTE: the limits here are NOMINAL display ceilings for the usage meters, not
 * an enforced quota — enforcement lives server-side in the plan/credit layer.
 */

import * as React from 'react';
import {
  Gauge,
  Database,
  Layers,
  Users,
  AlertTriangle,
} from 'lucide-react';

import { TwentyPageHeader } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  countSabcrmRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import { listMembersAction } from '@/app/actions/sabcrm.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../settings-twenty.css';
import './usage.css';

// ---------------------------------------------------------------------------
// Nominal display ceilings (NOT enforced quotas — see the file header).
// ---------------------------------------------------------------------------

/** Nominal per-object record ceiling used for the usage meters. */
const PER_OBJECT_LIMIT = 100_000;
/** Nominal workspace seat ceiling used for the member meter. */
const MEMBER_LIMIT = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compact locale number, e.g. `12,400`. Falls back to the raw string. */
function fmtNumber(n: number): string {
  try {
    return n.toLocaleString();
  } catch {
    return String(n);
  }
}

/** Clamps a usage fraction to [0, 1] for the bar width. */
function clampPct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  const pct = used / limit;
  if (!Number.isFinite(pct) || pct < 0) return 0;
  return pct > 1 ? 1 : pct;
}

type MeterTone = 'ok' | 'warn' | 'over';

/** Tone bucket for the bar + percent label: <75% ok, <100% warn, ≥100% over. */
function meterTone(used: number, limit: number): MeterTone {
  if (limit <= 0) return 'ok';
  const ratio = used / limit;
  if (ratio >= 1) return 'over';
  if (ratio >= 0.75) return 'warn';
  return 'ok';
}

// ---------------------------------------------------------------------------
// Per-object count state
// ---------------------------------------------------------------------------

type CountState =
  | { status: 'loading' }
  | { status: 'ready'; count: number }
  | { status: 'error' };

// ---------------------------------------------------------------------------
// Usage meter (progress bar + labels)
// ---------------------------------------------------------------------------

function UsageMeter({
  used,
  limit,
}: {
  used: number;
  limit: number;
}): React.JSX.Element {
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
        <span className="st-usage-meter__limit">
          of {fmtNumber(limit)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  icon: React.ElementType;
  state: CountState;
  limit: number;
  summary?: boolean;
}

function StatCard({
  label,
  icon: Icon,
  state,
  limit,
  summary = false,
}: StatCardProps): React.JSX.Element {
  return (
    <div className={`st-stat-card${summary ? ' st-stat-card--summary' : ''}`}>
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

/** Pure skeleton card for the initial catalogue load. */
function SkeletonCard(): React.JSX.Element {
  return (
    <div
      className="st-stat-card st-stat-card--skeleton"
      aria-hidden="true"
    >
      <div className="st-stat-card__head">
        <span className="st-stat-card__icon" />
        <span className="st-skel-line st-skel-line--label" />
      </div>
      <span className="st-skel-line st-skel-line--value" />
      <div className="st-usage-meter">
        <span className="st-skel-line st-skel-line--bar" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmUsageSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  // Object catalogue (standard objects only, for the per-object cards).
  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [objectsLoading, setObjectsLoading] = React.useState(true);
  const [objectsError, setObjectsError] = React.useState<string | null>(null);

  // Per-object record counts, keyed by slug.
  const [counts, setCounts] = React.useState<Record<string, CountState>>({});

  // Workspace members.
  const [memberState, setMemberState] = React.useState<CountState>({
    status: 'loading',
  });

  // ----- Catalogue + counts -----

  const loadObjects = React.useCallback(async (projectId: string) => {
    setObjectsLoading(true);
    setObjectsError(null);
    setCounts({});
    try {
      const res = await listSabcrmObjectsTw(projectId);
      if (!res.ok) {
        setObjectsError(res.error);
        setObjects([]);
        return;
      }
      const standard = res.data.filter((o) => o.standard);
      setObjects(standard);

      // Seed each card as loading, then fetch counts independently.
      setCounts(
        Object.fromEntries(
          standard.map((o) => [o.slug, { status: 'loading' } as CountState]),
        ),
      );

      await Promise.all(
        standard.map(async (obj) => {
          try {
            const cRes = await countSabcrmRecordsTw(obj.slug, {}, projectId);
            setCounts((prev) => ({
              ...prev,
              [obj.slug]: cRes.ok
                ? { status: 'ready', count: cRes.data.count }
                : { status: 'error' },
            }));
          } catch {
            setCounts((prev) => ({
              ...prev,
              [obj.slug]: { status: 'error' },
            }));
          }
        }),
      );
    } catch {
      setObjectsError(
        'Usage data could not be loaded. The service may be unavailable.',
      );
      setObjects([]);
    } finally {
      setObjectsLoading(false);
    }
  }, []);

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

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setObjectsLoading(false);
      setMemberState({ status: 'error' });
      return;
    }
    void loadObjects(activeProjectId);
    void loadMembers(activeProjectId);
  }, [activeProjectId, isLoadingProject, loadObjects, loadMembers]);

  // ----- Derived totals -----

  // Total across objects whose counts have resolved successfully.
  const { totalCount, allCountsReady, anyCount } = React.useMemo(() => {
    let total = 0;
    let ready = objects.length > 0;
    let any = false;
    for (const obj of objects) {
      const c = counts[obj.slug];
      if (c && c.status === 'ready') {
        total += c.count;
        any = true;
      } else {
        ready = false;
      }
    }
    return { totalCount: total, allCountsReady: ready, anyCount: any };
  }, [objects, counts]);

  const totalLimit = objects.length * PER_OBJECT_LIMIT;

  // Totals card state: ready once every per-object count has resolved; while
  // some are still pending it stays in a loading shimmer; if the catalogue
  // loaded but nothing resolved, it surfaces as unavailable.
  const totalsState: CountState = objectsLoading
    ? { status: 'loading' }
    : allCountsReady
      ? { status: 'ready', count: totalCount }
      : anyCount
        ? { status: 'loading' }
        : { status: 'error' };

  // -------------------------------------------------------------------------

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Usage & Limits" icon={Gauge} />
        <p className="st-settings__intro">
          How much of this workspace your project is using. Each object tracks
          its record count against a nominal plan ceiling. These meters are for
          visibility — actual limits are enforced by your plan.
        </p>

        {isLoadingProject ? (
          <section className="st-usage-section">
            <div className="st-usage-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </section>
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">
              Select a project to view its usage and limits.
            </p>
          </div>
        ) : objectsError ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{objectsError}</span>
          </div>
        ) : (
          <>
            {/* ---- Totals summary ---- */}
            <section className="st-usage-section">
              <div className="st-usage-section__head">
                <h2 className="st-usage-section__title">Summary</h2>
              </div>
              <div className="st-usage-grid">
                <StatCard
                  label="Total records"
                  icon={Database}
                  state={totalsState}
                  limit={totalLimit > 0 ? totalLimit : PER_OBJECT_LIMIT}
                  summary
                />
                <StatCard
                  label="Objects tracked"
                  icon={Layers}
                  state={
                    objectsLoading
                      ? { status: 'loading' }
                      : { status: 'ready', count: objects.length }
                  }
                  limit={Math.max(objects.length, 1)}
                  summary
                />
                <StatCard
                  label="Workspace members"
                  icon={Users}
                  state={memberState}
                  limit={MEMBER_LIMIT}
                  summary
                />
              </div>
            </section>

            {/* ---- Records by object ---- */}
            <section className="st-usage-section">
              <div className="st-usage-section__head">
                <h2 className="st-usage-section__title">Records by object</h2>
                <span className="st-usage-section__hint">
                  Limit {fmtNumber(PER_OBJECT_LIMIT)} per object
                </span>
              </div>

              {objectsLoading ? (
                <div className="st-usage-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : objects.length === 0 ? (
                <div className="st-empty">
                  <span className="st-empty__icon">
                    <Database size={20} />
                  </span>
                  <h2 className="st-empty__title">No objects to report</h2>
                  <p className="st-empty__desc">
                    This workspace has no standard objects, or object metadata
                    could not be loaded.
                  </p>
                </div>
              ) : (
                <div className="st-usage-grid">
                  {objects.map((obj) => (
                    <StatCard
                      key={obj.slug}
                      label={obj.labelPlural}
                      icon={Database}
                      state={counts[obj.slug] ?? { status: 'loading' }}
                      limit={PER_OBJECT_LIMIT}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
