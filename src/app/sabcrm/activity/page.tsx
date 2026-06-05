'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — workspace-wide ACTIVITY feed (`/sabcrm/activity`), Twenty look.
 *
 * Twenty's record pages each carry a per-record timeline; this is the
 * project-wide rollup of that same stream — every NOTE / TASK / CALL / MEETING /
 * EMAIL across every object, newest first, each item linking back to the record
 * it hangs off.
 *
 * Why aggregate (and not one feed call)?
 * --------------------------------------
 * `listSabcrmActivitiesTw(targetObject, recordId, opts?)` is RECORD-scoped — it
 * hard-requires a concrete `targetObject` + `recordId`, so there is no single
 * "whole-project activities" action to call. We therefore reconstruct the
 * workspace feed client-side:
 *
 *   1. `listSabcrmObjectsTw()`            → the project's object catalogue,
 *   2. `listSabcrmRecordsTw(slug, …)`     → each object's most-recent records
 *      (a small per-object cap; newest-updated first),
 *   3. `listSabcrmActivitiesTw(slug, id)` → that record's timeline, with the
 *      active type filter pushed down to the engine.
 *
 * The results are merged, de-duplicated by activity id, sorted newest-first and
 * capped. The type filter (Note / Task / Call / Meeting / Email / All) is passed
 * through to the activities action so the engine does the narrowing.
 *
 * Every call is a gated server action returning an `ActionResult`; the Rust
 * engine may be DOWN, so a failed leg degrades to a calm banner / empty state
 * and the page never crashes (partial results are kept when only some legs
 * fail). Client Component — auth / RBAC / project context come from
 * `../layout.tsx`; the actions independently re-run the full gate.
 *
 * Twenty look, on the 20ui design system (`@/components/sabcrm/20ui`, scoped
 * under the CRM frame's `.sabcrm-twenty` class so no wrapper is needed) plus the
 * sibling `./activity.css` for the timeline rail. NO ZoruUI / Tailwind / clay.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Database,
  Inbox,
  Mail,
  Phone,
  RefreshCw,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';

import { TwentyPageHeader } from '@/components/sabcrm/twenty';
import {
  Alert,
  Button,
  EmptyState,
  SegmentedControl,
  Skeleton,
  type SegmentedItem,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  listSabcrmRecordsTw,
  listSabcrmActivitiesTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type {
  ObjectMetadata,
  SabcrmRustRecord,
  SabcrmRustActivity,
  SabcrmActivityKind,
} from '@/app/actions/sabcrm-twenty.actions.types';
import { sabcrmRecordLabel } from '@/lib/sabcrm/record-label';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './activity.css';

// ---------------------------------------------------------------------------
// Aggregation tuning — keep the workspace rollup light (bounded round-trips).
// ---------------------------------------------------------------------------

/** Max objects we scan (recently-touched first) so the feed stays bounded. */
const MAX_OBJECTS = 8;
/** Most-recent records sampled per object for their timelines. */
const RECORDS_PER_OBJECT = 12;
/** Activities pulled per record. */
const ACTIVITIES_PER_RECORD = 12;
/** Hard cap on how many items the merged feed renders. */
const FEED_CAP = 80;

// ---------------------------------------------------------------------------
// Type filter
// ---------------------------------------------------------------------------

type FilterKey = 'ALL' | SabcrmActivityKind;

const FILTERS: readonly { key: FilterKey; label: string; icon: LucideIcon }[] = [
  { key: 'ALL', label: 'All', icon: ActivityIcon },
  { key: 'NOTE', label: 'Note', icon: StickyNote },
  { key: 'TASK', label: 'Task', icon: CheckCircle2 },
  { key: 'CALL', label: 'Call', icon: Phone },
  { key: 'MEETING', label: 'Meeting', icon: CalendarClock },
  { key: 'EMAIL', label: 'Email', icon: Mail },
] as const;

const TYPE_ICON: Record<string, LucideIcon> = {
  NOTE: StickyNote,
  TASK: CheckCircle2,
  CALL: Phone,
  MEETING: CalendarClock,
  EMAIL: Mail,
};

function iconForType(type: string): LucideIcon {
  return TYPE_ICON[type.toUpperCase()] ?? ActivityIcon;
}

// ---------------------------------------------------------------------------
// Time + label helpers
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Compact relative time — "just now", "5m ago", "3h ago", else a short date. */
function relativeTime(value: string | undefined): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

/** Best-effort display label for a record from its conventional label keys. */
function recordLabel(
  record: SabcrmRustRecord,
  object: ObjectMetadata | undefined,
): string {
  // With metadata, the canonical helper handles people (full name) + isLabel.
  if (object) return sabcrmRecordLabel(object, record);
  // No metadata: best-effort scan of common title-ish keys, then a composed name.
  const data = record.data ?? {};
  for (const key of ['name', 'title', 'label', 'fullName', 'subject', 'email']) {
    const v = asText(data[key]).trim();
    if (v) return v;
  }
  const composed = [asText(data.firstName).trim(), asText(data.lastName).trim()]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (composed) return composed;
  return `#${record.id.slice(-6)}`;
}

/** Pretty object slug → human noun ("opportunities" → "Opportunity"). */
function humanizeObject(
  slug: string,
  object: ObjectMetadata | undefined,
): string {
  if (object?.labelSingular) return object.labelSingular;
  if (!slug) return 'Record';
  const spaced = slug.replace(/[-_]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Strip HTML so a rich-text body can show as a one/two-line plain snippet. */
function plainSnippet(body: string | undefined): string {
  if (!body) return '';
  return body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Feed item — an activity plus its resolved target label.
// ---------------------------------------------------------------------------

interface FeedItem {
  activity: SabcrmRustActivity;
  /** Resolved human label of the target record (for the link chip). */
  targetLabel: string;
  /** Human object noun (e.g. "Company"). */
  targetObjectLabel: string;
}

interface FeedResult {
  items: FeedItem[];
  /** True when at least one leg failed but we still have partial data. */
  partial: boolean;
  /** Set when the whole aggregation could not start (e.g. objects failed). */
  fatalError: string | null;
}

/**
 * Reconstruct the workspace activity feed for `projectId`, narrowed to `kind`
 * (or all kinds when `kind === 'ALL'`). Resilient: a failing per-record /
 * per-object leg is skipped, surfacing `partial` rather than throwing.
 */
async function buildFeed(
  projectId: string,
  kind: FilterKey,
  signal: { cancelled: boolean },
): Promise<FeedResult> {
  // 1. Object catalogue (the only required leg — if it fails, nothing to scan).
  const objectsRes = await listSabcrmObjectsTw(projectId);
  if (signal.cancelled) return { items: [], partial: false, fatalError: null };
  if (!objectsRes.ok) {
    return { items: [], partial: false, fatalError: objectsRes.error };
  }

  // Prefer "activity-bearing" standard objects first, then cap breadth.
  const PRIORITY = [
    'leads',
    'people',
    'companies',
    'tasks',
    'notes',
  ];
  const objects = [...objectsRes.data].sort((a, b) => {
    const ai = PRIORITY.indexOf(a.slug);
    const bi = PRIORITY.indexOf(b.slug);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const scanned = objects.slice(0, MAX_OBJECTS);

  let partial = false;
  const typeFilter = kind === 'ALL' ? undefined : kind;

  // 2. Per object → recent records → their timelines, fanned out in parallel.
  const perObject = await Promise.all(
    scanned.map(async (object) => {
      const recRes = await listSabcrmRecordsTw(
        object.slug,
        { limit: RECORDS_PER_OBJECT, sortBy: 'updatedAt', sortDir: 'desc' },
        projectId,
      );
      if (!recRes.ok) {
        partial = true;
        return [] as FeedItem[];
      }
      const records = recRes.data.records;
      const perRecord = await Promise.all(
        records.map(async (record) => {
          const actRes = await listSabcrmActivitiesTw(
            object.slug,
            record.id,
            { type: typeFilter, limit: ACTIVITIES_PER_RECORD },
            projectId,
          );
          if (!actRes.ok) {
            partial = true;
            return [] as FeedItem[];
          }
          const targetLabel = recordLabel(record, object);
          const targetObjectLabel = humanizeObject(object.slug, object);
          return actRes.data.map((activity) => ({
            activity,
            targetLabel,
            targetObjectLabel,
          }));
        }),
      );
      return perRecord.flat();
    }),
  );

  if (signal.cancelled) return { items: [], partial: false, fatalError: null };

  // 3. Merge, de-dup by activity id, newest-first, cap.
  const seen = new Set<string>();
  const merged: FeedItem[] = [];
  for (const item of perObject.flat()) {
    if (seen.has(item.activity.id)) continue;
    seen.add(item.activity.id);
    merged.push(item);
  }
  merged.sort(
    (a, b) =>
      new Date(b.activity.createdAt).getTime() -
      new Date(a.activity.createdAt).getTime(),
  );

  return { items: merged.slice(0, FEED_CAP), partial, fatalError: null };
}

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------

function FeedSkeleton(): React.JSX.Element {
  return (
    <div className="sa-feed__list" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div className="sa-skel" key={i}>
          <Skeleton width={24} height={24} radius={8} />
          <div className="sa-skel__lines">
            <Skeleton width="42%" height={11} radius={6} />
            <Skeleton width="78%" height={11} radius={6} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface FeedRowProps {
  item: FeedItem;
}

function FeedRow({ item }: FeedRowProps): React.JSX.Element {
  const { activity, targetLabel, targetObjectLabel } = item;
  const Icon = iconForType(activity.type);
  const snippet = plainSnippet(activity.body);
  const href = `/sabcrm/${activity.targetObject}/${activity.targetRecordId}`;
  return (
    <li className="sa-item">
      <div className="sa-item__rail">
        <span className="sa-item__dot" aria-hidden="true">
          <Icon size={13} />
        </span>
      </div>
      <div className="sa-item__body">
        <div className="sa-item__head">
          <span className="sa-item__title">
            {activity.title || activity.type}
          </span>
          <time className="sa-item__time" dateTime={activity.createdAt}>
            {relativeTime(activity.createdAt)}
          </time>
        </div>
        {snippet ? <p className="sa-item__snippet">{snippet}</p> : null}
        <div className="sa-item__foot">
          {activity.targetObject && activity.targetRecordId ? (
            <Link className="sa-item__target" href={href}>
              <Database size={12} aria-hidden="true" />
              <span className="sa-item__target-label">
                {targetObjectLabel}: {targetLabel}
              </span>
            </Link>
          ) : null}
          {activity.authorId ? (
            <span className="sa-item__author">by {activity.authorId}</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmActivityPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [filter, setFilter] = React.useState<FilterKey>('ALL');
  const [items, setItems] = React.useState<FeedItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [partial, setPartial] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Bumped to force a manual refresh.
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!activeProjectId) {
      setLoading(false);
      setItems([]);
      setError(null);
      setPartial(false);
      return;
    }
    const signal = { cancelled: false };
    setLoading(true);
    setError(null);
    (async () => {
      const res = await buildFeed(activeProjectId, filter, signal);
      if (signal.cancelled) return;
      setItems(res.items);
      setPartial(res.partial);
      setError(res.fatalError);
      setLoading(false);
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [activeProjectId, filter, reloadKey]);

  const refresh = React.useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  // Type filter → SegmentedControl items, with a live count chip per type.
  const filterItems = React.useMemo<SegmentedItem<FilterKey>[]>(
    () =>
      FILTERS.map(({ key, label, icon }) => {
        const count =
          key === 'ALL'
            ? items.length
            : items.filter((it) => it.activity.type.toUpperCase() === key)
                .length;
        return {
          value: key,
          icon,
          label: (
            <>
              {label}
              {!loading && count > 0 ? (
                <span className="sa-feed__filter-count">{count}</span>
              ) : null}
            </>
          ),
        };
      }),
    [items, loading],
  );

  const headerActions = (
    <Button
      variant="secondary"
      size="sm"
      iconLeft={RefreshCw}
      onClick={refresh}
      loading={loading}
      aria-label="Refresh activity feed"
      title="Refresh"
    >
      Refresh
    </Button>
  );

  return (
    <>
      <TwentyPageHeader
        title="Activity"
        icon={ActivityIcon}
        actions={headerActions}
      />

      <div className="sa-feed">
        {/* Type filter (segmented) */}
        <div className="sa-feed__filters">
          <SegmentedControl<FilterKey>
            aria-label="Filter activity by type"
            size="sm"
            value={filter}
            onChange={setFilter}
            items={filterItems}
          />
        </div>

        {/* Degraded-engine notice (partial results retained) */}
        {partial && !error ? (
          <Alert tone="warning">
            Some activity couldn&apos;t be loaded, so the feed may be
            incomplete. Try refreshing.
          </Alert>
        ) : null}

        {/* Body: loading → error → empty → list */}
        {loading ? (
          <FeedSkeleton />
        ) : error ? (
          <Alert
            tone="danger"
            title="Couldn't load activity"
            icon={AlertTriangle}
          >
            <p>{error}</p>
            <div className="sa-feed__state-action">
              <Button
                variant="secondary"
                size="sm"
                iconLeft={RefreshCw}
                onClick={refresh}
              >
                Try again
              </Button>
            </div>
          </Alert>
        ) : !activeProjectId ? (
          <EmptyState
            icon={Inbox}
            title="No project selected"
            description="Choose a project to see its activity feed."
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ActivityIcon}
            title={
              filter === 'ALL'
                ? 'No activity yet'
                : `No ${filter.toLowerCase()} activity`
            }
            description="Notes, tasks, calls, meetings and emails added to your records show up here, newest first."
          />
        ) : (
          <ol className="sa-feed__list">
            {items.map((item) => (
              <FeedRow key={item.activity.id} item={item} />
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
