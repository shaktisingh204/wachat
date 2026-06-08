'use client';

/**
 * SabCRM - Usage & Limits settings (`/dashboard/settings/crm/usage`), 20ui.
 *
 * A read-only dashboard of how much of the workspace this project is using,
 * scoped to the active project via `useProject()`:
 *
 *   1. Records by object - one 20ui Card per STANDARD object, showing its live
 *      record count (`countSabcrmRecordsTw(slug)`) and a Progress meter measuring
 *      that count against a nominal per-object plan ceiling. Cards load
 *      independently so one slow/failed count never blocks the rest.
 *
 *   2. Totals summary - an aggregate Card: total records across every standard
 *      object measured against the combined ceiling, plus the count of objects
 *      tracked and the workspace member count.
 *
 *   3. Workspace - member count (`listMembersAction`) measured against a nominal
 *      seat ceiling.
 *
 * The object catalogue comes from `listSabcrmObjectsTw`; counts and the member
 * roster each re-run the session, project, RBAC, plan pipeline server-side, so
 * the page fails closed. States: skeleton cards while objects/counts load, a
 * "no project" EmptyState, an Alert when the catalogue can't load, and graceful
 * per-card degradation when an individual count is unavailable.
 *
 * NOTE: the limits here are NOMINAL display ceilings for the usage meters, not
 * an enforced quota. Enforcement lives server-side in the plan/credit layer.
 */

import * as React from 'react';
import {
  Gauge,
  Database,
  Layers,
  Users,
  AlertTriangle,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Progress,
  Badge,
  Skeleton,
  Alert,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  countSabcrmRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import { listMembersAction } from '@/app/actions/sabcrm.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Nominal display ceilings (NOT enforced quotas - see the file header).
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

/** Clamps a usage fraction to [0, 100] for the bar value. */
function clampPct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  const pct = (used / limit) * 100;
  if (!Number.isFinite(pct) || pct < 0) return 0;
  return pct > 100 ? 100 : pct;
}

type MeterTone = 'ok' | 'warn' | 'over';

/** Tone bucket for the bar + percent label: <75% ok, <100% warn, >=100% over. */
function meterTone(used: number, limit: number): MeterTone {
  if (limit <= 0) return 'ok';
  const ratio = used / limit;
  if (ratio >= 1) return 'over';
  if (ratio >= 0.75) return 'warn';
  return 'ok';
}

/** Map the meter tone to a 20ui Progress/Badge tone. */
const PROGRESS_TONE: Record<MeterTone, 'accent' | 'warning' | 'danger'> = {
  ok: 'accent',
  warn: 'warning',
  over: 'danger',
};
const BADGE_TONE: Record<MeterTone, 'accent' | 'warning' | 'danger'> = {
  ok: 'accent',
  warn: 'warning',
  over: 'danger',
};

// ---------------------------------------------------------------------------
// Per-object count state
// ---------------------------------------------------------------------------

type CountState =
  | { status: 'loading' }
  | { status: 'ready'; count: number }
  | { status: 'error' };

// ---------------------------------------------------------------------------
// Usage meter (Progress bar + labels)
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

  return (
    <div className="mt-3 flex flex-col gap-2">
      <Progress
        value={pct}
        tone={PROGRESS_TONE[tone]}
        size="sm"
        aria-label={`${fmtNumber(used)} of ${fmtNumber(limit)} used`}
      />
      <div className="flex items-center justify-between gap-2">
        <Badge tone={BADGE_TONE[tone]} kind="soft">
          {Number.isFinite(pctLabel) ? `${pctLabel}%` : '0%'}
          {tone === 'over' ? ' over limit' : ''}
        </Badge>
        <span className="text-xs text-[var(--st-text-tertiary)]">
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
}

function UsageStatCard({
  label,
  icon: Icon,
  state,
  limit,
}: StatCardProps): React.JSX.Element {
  return (
    <Card variant="outlined" padding="md">
      <CardHeader className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
          aria-hidden="true"
        >
          <Icon size={15} />
        </span>
        <CardTitle className="truncate text-sm" title={label}>
          {label}
        </CardTitle>
      </CardHeader>

      <CardBody className="pt-1">
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

        {state.status === 'ready' ? (
          <UsageMeter used={state.count} limit={limit} />
        ) : (
          <div className="mt-3" aria-hidden="true">
            <Skeleton width="100%" height={6} radius={999} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** Pure skeleton card for the initial catalogue load. */
function SkeletonCard(): React.JSX.Element {
  return (
    <Card variant="outlined" padding="md" aria-hidden="true">
      <CardHeader className="flex items-center gap-2">
        <Skeleton width={28} height={28} radius={6} />
        <Skeleton width={120} height={14} radius={4} />
      </CardHeader>
      <CardBody className="pt-1">
        <Skeleton width={96} height={28} radius={6} />
        <div className="mt-3">
          <Skeleton width="100%" height={6} radius={999} />
        </div>
      </CardBody>
    </Card>
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
    <div className="20ui">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <PageHeader bordered>
          <PageHeaderHeading>
            <PageTitle className="flex items-center gap-2">
              <Gauge size={18} aria-hidden="true" />
              Usage and limits
            </PageTitle>
            <PageDescription>
              How much of this workspace your project is using. Each object
              tracks its record count against a nominal plan ceiling. These
              meters are for visibility, actual limits are enforced by your plan.
            </PageDescription>
          </PageHeaderHeading>
        </PageHeader>

        {isLoadingProject ? (
          <section className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </section>
        ) : !activeProjectId ? (
          <EmptyState
            icon={AlertTriangle}
            tone="warning"
            title="No project selected"
            description="Select a project to view its usage and limits."
          />
        ) : objectsError ? (
          <Alert tone="danger" icon={AlertTriangle} title="Usage unavailable">
            {objectsError}
          </Alert>
        ) : (
          <>
            {/* ---- Totals summary ---- */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--st-text)]">
                  Summary
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <UsageStatCard
                  label="Total records"
                  icon={Database}
                  state={totalsState}
                  limit={totalLimit > 0 ? totalLimit : PER_OBJECT_LIMIT}
                />
                <UsageStatCard
                  label="Objects tracked"
                  icon={Layers}
                  state={
                    objectsLoading
                      ? { status: 'loading' }
                      : { status: 'ready', count: objects.length }
                  }
                  limit={Math.max(objects.length, 1)}
                />
                <UsageStatCard
                  label="Workspace members"
                  icon={Users}
                  state={memberState}
                  limit={MEMBER_LIMIT}
                />
              </div>
            </section>

            {/* ---- Records by object ---- */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--st-text)]">
                  Records by object
                </h2>
                <span className="text-xs text-[var(--st-text-tertiary)]">
                  Limit {fmtNumber(PER_OBJECT_LIMIT)} per object
                </span>
              </div>

              {objectsLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : objects.length === 0 ? (
                <EmptyState
                  icon={Database}
                  title="No objects to report"
                  description="This workspace has no standard objects, or object metadata could not be loaded."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {objects.map((obj) => (
                    <UsageStatCard
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
