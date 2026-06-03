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
 * Twenty look only (`.st-*` kit + the NEW sibling `./activity.css`). NO ZoruUI /
 * Tailwind / clay.
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
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';

import { TwentyPageHeader } from '@/components/sabcrm/twenty';
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

import '@/styles/sabcrm-twenty.css';
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
  const data = record.data ?? {};
  const labelKey = object?.fields.find((f) => f.isLabel)?.key;
  const order = [
    labelKey,
    'name',
    'title',
    'label',
    'fullName',
    'subject',
    'email',
    'firstName',
  ].filter(Boolean) as string[];
  for (const key of order) {
    const v = asText(data[key]).trim();
    if (v) return v;
  }
  const first = asText(data.firstName).trim();
  const last = asText(data.lastName).trim();
  const composed = [first, last].filter(Boolean).join(' ').trim();
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
    'opportunities',
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
          <span className="sa-skel__dot" />
          <div className="sa-skel__lines">
            <span className="sa-skel__line sa-skel__line--title" />
            <span className="sa-skel__line sa-skel__line--body" />
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

  const headerActions = (
    <button
      type="button"
      className="sa-feed__refresh"
      onClick={refresh}
      disabled={loading}
      aria-label="Refresh activity feed"
      title="Refresh"
    >
      {loading ? (
        <Loader2 size={13} className="sa-spin" aria-hidden="true" />
      ) : (
        <RefreshCw size={13} aria-hidden="true" />
      )}
      Refresh
    </button>
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
        <div
          className="sa-feed__filters"
          role="tablist"
          aria-label="Filter activity by type"
        >
          {FILTERS.map(({ key, label, icon: Icon }) => {
            const isActive = key === filter;
            const count =
              key === 'ALL'
                ? items.length
                : items.filter(
                    (it) => it.activity.type.toUpperCase() === key,
                  ).length;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`sa-feed__filter${isActive ? ' is-active' : ''}`}
                onClick={() => setFilter(key)}
              >
                <Icon size={13} aria-hidden="true" />
                {label}
                {!loading && count > 0 ? (
                  <span className="sa-feed__filter-count">{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Degraded-engine notice (partial results retained) */}
        {partial && !error ? (
          <div className="sa-feed__banner" role="status">
            <AlertTriangle
              size={15}
              className="sa-feed__banner-icon"
              aria-hidden="true"
            />
            <span>
              Some activity couldn&apos;t be loaded — the feed may be
              incomplete. Try refreshing.
            </span>
          </div>
        ) : null}

        {/* Body: loading → error → empty → list */}
        {loading ? (
          <FeedSkeleton />
        ) : error ? (
          <div className="sa-feed__state" role="alert">
            <span className="sa-feed__state-icon">
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
            <span className="sa-feed__state-title">
              Couldn&apos;t load activity
            </span>
            <span className="sa-feed__state-hint">{error}</span>
            <button
              type="button"
              className="sa-feed__refresh"
              onClick={refresh}
            >
              <RefreshCw size={13} aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : !activeProjectId ? (
          <div className="sa-feed__state">
            <span className="sa-feed__state-icon">
              <Inbox size={18} aria-hidden="true" />
            </span>
            <span className="sa-feed__state-title">No project selected</span>
            <span className="sa-feed__state-hint">
              Choose a project to see its activity feed.
            </span>
          </div>
        ) : items.length === 0 ? (
          <div className="sa-feed__state">
            <span className="sa-feed__state-icon">
              <ActivityIcon size={18} aria-hidden="true" />
            </span>
            <span className="sa-feed__state-title">
              {filter === 'ALL'
                ? 'No activity yet'
                : `No ${filter.toLowerCase()} activity`}
            </span>
            <span className="sa-feed__state-hint">
              Notes, tasks, calls, meetings and emails added to your records show
              up here, newest first.
            </span>
          </div>
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
