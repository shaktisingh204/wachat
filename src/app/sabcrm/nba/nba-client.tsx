'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — Next-Best-Action queue surface (`/sabcrm/nba`), 20ui.
 *
 * A prioritized, one-screen work queue: the most valuable move a rep can make
 * right now, ranked by urgency. Each row is a card with the action verb, the
 * "why" (urgency reason), an urgency badge, and a one-click deep link straight
 * to the target record (`/sabcrm/<object>/<recordId>`).
 *
 * The ranked queue + summary are computed server-side (`getNbaQueueTw`) and
 * hydrated as `initial*` props; the client can refresh in place and toggle
 * between "My queue" (the signed-in rep) and "Whole team" (project-wide).
 *
 * Surfaces (mirroring `/sabcrm/my-work` conventions):
 *   • A header with refresh + a My/Team segmented toggle.
 *   • Summary chips (per-kind counts) so a rep sees the shape of their day.
 *   • A KIND filter (segmented) to narrow to one action type, applied
 *     client-side over the loaded queue so counts stay live without a re-fetch.
 *   • Urgency-grouped cards (Critical → High → Medium → Low), each linking out.
 *
 * 20ui only (`@/components/sabcrm/20ui` + the page-local `./nba.css`, `.nba-*`
 * classes scoped to the 20ui root). Icons render through the 20ui `renderIcon`
 * helper (lucide icons are forwardRef objects — never `<Icon/>` directly).
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Inbox,
  ArrowRight,
  CalendarClock,
  Flame,
  MailQuestion,
  Send,
  type LucideIcon,
} from 'lucide-react';

import {
  getNbaQueueTw,
  type GetNbaQueueOptions,
} from '@/app/actions/sabcrm-nba.actions';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SegmentedControl,
  Skeleton,
  type BadgeTone,
  type SegmentedItem,
} from '@/components/sabcrm/20ui';
import { renderIcon } from '@/components/sabcrm/20ui/_icon';
import type {
  RankedNbaAction,
  NbaActionKind,
  NbaUrgencyTier,
  NbaQueueSummary,
} from '@/lib/sabcrm/nba';
import { NBA_ACTION_KINDS, NBA_KIND_LABEL } from '@/lib/sabcrm/nba';
import { useProject } from '@/context/project-context';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './nba.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sentinel kind-filter key meaning "every kind". */
const ALL_KINDS = '__all__' as const;

/** Local icon map (the pure module ships icon NAMES; resolve them here). */
const KIND_ICON: Record<NbaActionKind, LucideIcon> = {
  overdue_task: CalendarClock,
  hot_lead: Flame,
  rotting_deal: AlertTriangle,
  unreplied_inbound: MailQuestion,
  due_cadence_step: Send,
};

/** Urgency tier → Badge tone (color carries meaning, never decoration). */
const TIER_TONE: Record<NbaUrgencyTier, BadgeTone> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

/** Urgency tier → human heading + display order. */
const TIER_ORDER: NbaUrgencyTier[] = ['critical', 'high', 'medium', 'low'];
const TIER_LABEL: Record<NbaUrgencyTier, string> = {
  critical: 'Critical',
  high: 'High priority',
  medium: 'Worth doing',
  low: 'When you have time',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pretty object-slug → human label (e.g. `leads` → `Leads`). */
function humanizeObject(slug: string): string {
  if (!slug) return 'Record';
  const spaced = slug.replace(/[-_]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function NbaSkeleton(): React.JSX.Element {
  return (
    <div className="nba-skel" aria-hidden="true">
      <Skeleton width="100%" height={28} radius={6} />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} width="100%" height={72} radius={10} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action card
// ---------------------------------------------------------------------------

function ActionCard({ action }: { action: RankedNbaAction }): React.JSX.Element {
  const Icon = KIND_ICON[action.kind] ?? Sparkles;
  const href = `/sabcrm/${action.record.object}/${action.record.recordId}`;
  return (
    <Card className="nba-card" variant="interactive" padding="none">
      <CardBody className="nba-card__body">
        <span
          className={`nba-card__icon nba-card__icon--${action.tier}`}
          aria-hidden="true"
        >
          {renderIcon(Icon, { size: 18 })}
        </span>

        <div className="nba-card__main">
          <div className="nba-card__top">
            <span className="nba-card__verb">{action.label}</span>
            <Badge tone={TIER_TONE[action.tier]} dot title={`Urgency ${action.urgency}/100`}>
              {action.urgency}
            </Badge>
          </div>

          <Link href={href} className="nba-card__record">
            {action.record.label}
            <Badge tone="neutral" className="nba-card__obj">
              {humanizeObject(action.record.object)}
            </Badge>
          </Link>

          <p className="nba-card__reason">{action.reason}</p>
        </div>

        <Link
          href={href}
          className="nba-card__cta"
          aria-label={`${action.label}: open ${action.record.label}`}
        >
          Open
          {renderIcon(ArrowRight, { size: 15 })}
        </Link>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Urgency group
// ---------------------------------------------------------------------------

function UrgencyGroup({
  tier,
  actions,
}: {
  tier: NbaUrgencyTier;
  actions: RankedNbaAction[];
}): React.JSX.Element {
  return (
    <section className="nba-group">
      <header className="nba-group__head">
        <span className={`nba-group__title nba-group__title--${tier}`}>
          {TIER_LABEL[tier]}
        </span>
        <span className="nba-group__count">{actions.length}</span>
      </header>
      <div className="nba-group__cards">
        {actions.map((a) => (
          <ActionCard key={a.id} action={a} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Kind filter (segmented — All + each kind present, with live counts)
// ---------------------------------------------------------------------------

function KindFilter({
  summary,
  active,
  total,
  onSelect,
}: {
  summary: NbaQueueSummary | null;
  active: string;
  total: number;
  onSelect: (kind: string) => void;
}): React.JSX.Element {
  const items = React.useMemo<SegmentedItem<string>[]>(() => {
    const present = NBA_ACTION_KINDS.filter(
      (k) => (summary?.byKind[k] ?? 0) > 0,
    );
    return [
      {
        value: ALL_KINDS,
        label: (
          <>
            All
            {total > 0 ? <span className="nba-filter-count">{total}</span> : null}
          </>
        ),
      },
      ...present.map((k) => ({
        value: k,
        label: (
          <>
            {NBA_KIND_LABEL[k]}
            <span className="nba-filter-count">{summary?.byKind[k] ?? 0}</span>
          </>
        ),
      })),
    ];
  }, [summary, total]);

  return (
    <SegmentedControl
      className="nba-filters"
      aria-label="Filter by action type"
      items={items}
      value={active}
      onChange={onSelect}
      size="sm"
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function NbaClient({
  initialQueue,
  initialSummary,
  initialComputedAt,
  initialError,
}: {
  initialQueue: RankedNbaAction[];
  initialSummary: NbaQueueSummary | null;
  initialComputedAt: string | null;
  initialError: string | null;
}): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [queue, setQueue] = React.useState<RankedNbaAction[]>(initialQueue);
  const [summary, setSummary] = React.useState<NbaQueueSummary | null>(initialSummary);
  const [computedAt, setComputedAt] = React.useState<string | null>(initialComputedAt);
  const [error, setError] = React.useState<string | null>(initialError);
  const [loading, setLoading] = React.useState(false);
  // Whether we've fetched at least once on the client (so the SSR data shows
  // immediately without a spinner flash on first paint).
  const hydratedRef = React.useRef(true);

  const [scope, setScope] = React.useState<'mine' | 'team'>('mine');
  const [kindFilter, setKindFilter] = React.useState<string>(ALL_KINDS);
  const [reloadKey, setReloadKey] = React.useState(0);

  // Re-fetch when the scope, the active project, or a manual refresh changes.
  // Skips the very first run so the server-rendered queue paints instantly.
  React.useEffect(() => {
    if (hydratedRef.current && reloadKey === 0 && scope === 'mine') {
      hydratedRef.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const opts: GetNbaQueueOptions = {
      limit: 60,
      projectWide: scope === 'team',
    };

    (async () => {
      const res = await getNbaQueueTw(activeProjectId ?? undefined, opts);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setQueue([]);
        setSummary(null);
        setComputedAt(null);
      } else {
        setQueue(res.data.queue);
        setSummary(res.data.summary);
        setComputedAt(res.data.computedAt);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, scope, reloadKey]);

  const refresh = React.useCallback(() => setReloadKey((k) => k + 1), []);

  // Client-side kind filter over the loaded queue (counts stay live).
  const visible = React.useMemo(
    () =>
      kindFilter === ALL_KINDS
        ? queue
        : queue.filter((a) => a.kind === kindFilter),
    [queue, kindFilter],
  );

  // Drop a stale kind filter when a refresh removes that kind entirely.
  React.useEffect(() => {
    if (
      kindFilter !== ALL_KINDS &&
      (summary?.byKind[kindFilter as NbaActionKind] ?? 0) === 0
    ) {
      setKindFilter(ALL_KINDS);
    }
  }, [kindFilter, summary]);

  // Group the visible actions by urgency tier (the queue is already ranked, so
  // within-group order is preserved by the stable filter).
  const groups = React.useMemo(() => {
    const byTier = new Map<NbaUrgencyTier, RankedNbaAction[]>();
    for (const a of visible) {
      const arr = byTier.get(a.tier) ?? [];
      arr.push(a);
      byTier.set(a.tier, arr);
    }
    return TIER_ORDER.map((tier) => ({ tier, actions: byTier.get(tier) ?? [] })).filter(
      (g) => g.actions.length > 0,
    );
  }, [visible]);

  const asOf = React.useMemo(() => {
    if (!computedAt) return '';
    const d = new Date(computedAt);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }, [computedAt]);

  const scopeItems: SegmentedItem<'mine' | 'team'>[] = [
    { value: 'mine', label: 'My queue' },
    { value: 'team', label: 'Whole team' },
  ];

  return (
    <div className="nba-page">
      <div className="nba-page__inner">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Next best action</PageTitle>
            <PageDescription>
              Your highest-value moves right now — overdue tasks, hot leads,
              rotting deals, unanswered inbounds and due cadence steps, ranked by
              urgency.
              {asOf ? <span className="nba-asof"> As of {asOf}.</span> : null}
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <SegmentedControl
              aria-label="Queue scope"
              items={scopeItems}
              value={scope}
              onChange={setScope}
              size="sm"
            />
            <Button
              variant="secondary"
              size="sm"
              iconLeft={RefreshCw}
              loading={loading}
              onClick={refresh}
              aria-label="Refresh queue"
              title="Refresh"
            >
              Refresh
            </Button>
          </PageActions>
        </PageHeader>

        {loading ? (
          <NbaSkeleton />
        ) : error ? (
          <Alert tone="danger" icon={AlertTriangle} role="alert">
            {error}
          </Alert>
        ) : queue.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="You're all caught up"
            description="No pressing actions right now. New overdue tasks, hot leads, rotting deals and unanswered inbounds will surface here automatically."
          />
        ) : (
          <>
            <p className="nba-count">
              {queue.length} {queue.length === 1 ? 'action' : 'actions'} in your queue
            </p>

            {summary && (NBA_ACTION_KINDS.filter((k) => summary.byKind[k] > 0).length > 1) ? (
              <KindFilter
                summary={summary}
                active={kindFilter}
                total={queue.length}
                onSelect={setKindFilter}
              />
            ) : null}

            {visible.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Nothing here"
                description="No actions of this type right now."
              />
            ) : (
              <div className="nba-groups">
                {groups.map((g) => (
                  <UrgencyGroup key={g.tier} tier={g.tier} actions={g.actions} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default NbaClient;
