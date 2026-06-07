'use client';

/**
 * SabCRM — recent activity feed list.
 *
 * A presentational feed component that displays project-wide activities in a
 * compact list format (newest-first). Unlike {@link ActivityTimeline}, which
 * surfaces activities tied to a single record's detail panel, this component
 * renders a cross-record activity stream suitable for dashboards, activity
 * panels, and "what happened recently" summaries.
 *
 * Data flow (all gated, tenant-scoped, fail-closed):
 *   - fetch activities → {@link getActivityFeedAction}  (sabcrm:view)
 *
 * The component performs no Mongo access of its own; it only calls the server
 * action, which runs the full session → project → RBAC → plan pipeline. It
 * accepts an optional {@link ActivityFeedProps.initialData} for server-side
 * hydration, falling back to a client load if omitted.
 *
 * Pagination is cursor-based (infinite-scroll friendly) or offset-based
 * (for traditional pagination). The component exposes both modes via the
 * `spec` prop.
 *
 * Styling is Ui20-only, black-and-white, using the namespaced `--ui20-*`
 * tokens via the barrel primitives.
 */

import * as React from 'react';
import {
  StickyNote,
  CheckSquare,
  Phone,
  CalendarDays,
  Mail,
  MessageSquare,
  Loader2,
  ChevronRight,
} from 'lucide-react';

import { Card, CardBody, Button, Badge, Avatar, AvatarImage, AvatarFallback, EmptyState, Skeleton, cn, useToast } from '@/components/sabcrm/20ui';
import {
  getActivityFeedAction,
} from '@/app/actions/sabcrm.actions';
import type {
  CrmActivityRecord,
  TimelineActivityType,
} from '@/lib/sabcrm/activities.server';
import type {
  FeedFilter,
  FeedPageOptions,
  FeedCursorOptions,
  FeedPage,
  FeedCursorPage,
} from '@/lib/sabcrm/feed.server';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** A minimal author profile snapshot, keyed by user id, for avatars + names. */
export interface ActivityFeedAuthor {
  /** Display name (falls back to the id when omitted). */
  name?: string;
  /** Avatar image URL (SabFiles-served or workspace profile). */
  avatarUrl?: string;
}

export type ActivityFeedMode = 'page' | 'cursor';

export interface ActivityFeedProps {
  /** Feed display mode: offset-based ('page') or cursor-based ('cursor'). Defaults to 'page'. */
  mode?: ActivityFeedMode;
  /** Optional filters (types, target objects, authors, date range). */
  filter?: FeedFilter;
  /** Pagination options for 'page' mode (page, pageSize). */
  pageOptions?: FeedPageOptions;
  /** Pagination options for 'cursor' mode (after, limit). */
  cursorOptions?: FeedCursorOptions;
  /** Server-loaded initial data (for hydration). */
  initialData?: FeedPage | FeedCursorPage;
  /** Active project override forwarded to the server action. */
  projectId?: string;
  /** Author profiles keyed by user id (name + avatar). */
  authors?: Record<string, ActivityFeedAuthor>;
  /** When an activity item is clicked, invoked with its record. */
  onActivityClick?: (activity: CrmActivityRecord) => void;
  /** Maximum number of items to display. When exceeded, a "Load more" button appears. */
  maxItems?: number;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/* Presentation helpers                                                       */
/* -------------------------------------------------------------------------- */

const TYPE_ICON: Record<TimelineActivityType, React.ComponentType<{ className?: string }>> = {
  NOTE: StickyNote,
  TASK: CheckSquare,
  CALL: Phone,
  MEETING: CalendarDays,
  EMAIL: Mail,
  COMMENT: MessageSquare,
};

const TYPE_LABEL: Record<TimelineActivityType, string> = {
  NOTE: 'Note',
  TASK: 'Task',
  CALL: 'Call',
  MEETING: 'Meeting',
  EMAIL: 'Email',
  COMMENT: 'Comment',
};

/** Coerce the action's possibly-Date/string timestamps into epoch ms. */
function toMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  const d = new Date(value);
  const ms = d.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** Compact relative time ("just now", "5m", "3h", "2d", else a date). */
function relativeTime(value: Date | string | number, nowMs: number): string {
  const then = toMs(value);
  if (!then) return '';
  const diff = Math.max(0, nowMs - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      new Date(then).getFullYear() === new Date(nowMs).getFullYear()
        ? undefined
        : 'numeric',
  });
}

/** First-letter(s) initials for an avatar fallback. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function AuthorAvatar({
  author,
  authorId,
}: {
  author: ActivityFeedAuthor | undefined;
  authorId: string;
}): React.ReactElement {
  const name = author?.name?.trim() || authorId || 'Unknown';
  return (
    <Avatar className="h-8 w-8 shrink-0">
      {author?.avatarUrl ? (
        <AvatarImage src={author.avatarUrl} alt={name} />
      ) : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

interface ActivityItemProps {
  activity: CrmActivityRecord;
  author?: ActivityFeedAuthor;
  nowMs: number;
  onClick?: () => void;
}

function ActivityItem({
  activity,
  author,
  nowMs,
  onClick,
}: ActivityItemProps): React.ReactElement {
  const Icon = TYPE_ICON[activity.type] ?? MessageSquare;
  const authorName = author?.name?.trim() || activity.authorId || 'Unknown';
  const isComment = activity.type === 'COMMENT';

  return (
    <li
      className={cn(
        'group flex items-start gap-3 rounded-md border border-transparent p-3 transition-all hover:bg-[var(--st-bg-muted)] hover:border-[var(--st-border)]',
        onClick && 'cursor-pointer',
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <AuthorAvatar author={author} authorId={activity.authorId} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-[var(--st-text)]">{authorName}</span>
          {!isComment && (
            <Badge
              variant="outline"
              className="inline-flex items-center gap-1 px-1.5 py-0 text-[11px] font-normal"
            >
              <Icon className="h-3 w-3" />
              {TYPE_LABEL[activity.type]}
            </Badge>
          )}
          <span className="text-xs text-[var(--st-text-secondary)]">
            {relativeTime(activity.createdAt, nowMs)}
          </span>
        </div>

        {!isComment && activity.title ? (
          <p className="mt-1 text-sm font-medium text-[var(--st-text)] line-clamp-1">
            {activity.title}
          </p>
        ) : null}

        {activity.body ? (
          <p className="mt-1 text-sm text-[var(--st-text-secondary)] line-clamp-2">
            {activity.body}
          </p>
        ) : null}

        {activity.targetObject && (
          <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
            on <span className="font-medium">{activity.targetObject}</span>
          </p>
        )}
      </div>

      {onClick && (
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)] transition-transform group-hover:translate-x-1" />
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                   */
/* -------------------------------------------------------------------------- */

function ActivityFeedSkeleton(): React.ReactElement {
  return (
    <ul className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex gap-3 p-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Recent activity feed list. Displays project-wide activities in a compact
 * list format (newest-first) suitable for dashboards and activity panels.
 *
 * Supports both offset-based and cursor-based pagination modes, optional
 * filtering, and server-side hydration.
 */
export function ActivityFeed({
  mode = 'page',
  filter,
  pageOptions,
  cursorOptions,
  initialData,
  projectId,
  authors,
  onActivityClick,
  maxItems = 50,
  className,
}: ActivityFeedProps): React.ReactElement {
  const { toast } = useToast();

  const [activities, setActivities] = React.useState<CrmActivityRecord[]>(
    () => (initialData && 'activities' in initialData) ? initialData.activities : [],
  );
  const [total, setTotal] = React.useState<number>(
    () => (initialData && 'total' in initialData) ? initialData.total : 0,
  );
  const [page, setPage] = React.useState<number>(
    () => (initialData && 'page' in initialData) ? initialData.page : 1,
  );
  const [cursor, setCursor] = React.useState<string | null>(
    () => (initialData && 'nextCursor' in initialData) ? initialData.nextCursor : null,
  );
  const [loading, setLoading] = React.useState<boolean>(!initialData);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const nowMs = React.useMemo(() => Date.now(), [activities]);

  const fetchPage = React.useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await getActivityFeedAction(
          {
            mode: 'page',
            filter,
            options: { page: nextPage, pageSize: pageOptions?.pageSize ?? 30 },
          },
          projectId,
        );
        if (!res.ok) {
          setLoadError(res.error);
          return;
        }
        if ('activities' in res.data) {
          setTotal(res.data.total);
          setPage(res.data.page);
          setActivities(res.data.activities);
        }
      } catch {
        setLoadError('Failed to load activity feed.');
      } finally {
        setLoading(false);
      }
    },
    [filter, pageOptions, projectId],
  );

  const fetchCursor = React.useCallback(
    async (after?: string | null) => {
      if (!after && cursor === undefined) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setLoadError(null);
      try {
        const res = await getActivityFeedAction(
          {
            mode: 'cursor',
            filter,
            options: { after: after ?? undefined, limit: cursorOptions?.limit ?? 30 },
          },
          projectId,
        );
        if (!res.ok) {
          setLoadError(res.error);
          return;
        }
        if ('activities' in res.data && 'nextCursor' in res.data) {
          setCursor(res.data.nextCursor);
          if (after) {
            setActivities((prev) => [...prev, ...res.data.activities]);
          } else {
            setActivities(res.data.activities);
          }
        }
      } catch {
        setLoadError('Failed to load activity feed.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, cursorOptions, projectId, cursor],
  );

  // Initial load
  React.useEffect(() => {
    if (initialData) return;
    if (mode === 'page') {
      void fetchPage(1);
    } else {
      void fetchCursor();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayActivities = activities.slice(0, maxItems);
  const hasMore =
    mode === 'page'
      ? displayActivities.length < total
      : displayActivities.length < activities.length || cursor !== null;

  return (
    <Card className={className}>
      <CardBody className="p-4">
        {loading ? (
          <ActivityFeedSkeleton />
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <EmptyState
              title="Couldn't load activity"
              description={loadError}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                mode === 'page'
                  ? void fetchPage(1)
                  : void fetchCursor()
              }
            >
              Retry
            </Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8">
            <EmptyState
              title="No activity yet"
              description="Recent activities across your CRM will appear here."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col gap-2">
              {displayActivities.map((activity) => (
                <ActivityItem
                  key={activity._id}
                  activity={activity}
                  author={authors?.[activity.authorId]}
                  nowMs={nowMs}
                  onClick={
                    onActivityClick
                      ? () => onActivityClick(activity)
                      : undefined
                  }
                />
              ))}
            </ul>

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() =>
                    mode === 'page'
                      ? void fetchPage(page + 1)
                      : void fetchCursor(cursor)
                  }
                  className="gap-1.5"
                >
                  {loadingMore && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {mode === 'page' ? 'Load more' : 'Load older'}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default ActivityFeed;
