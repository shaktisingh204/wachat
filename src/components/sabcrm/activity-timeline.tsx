'use client';

/**
 * SabCRM — record activity timeline.
 *
 * The client surface that fills the Activity tab of a record's detail page
 * (the `activitySlot` of {@link RecordDetailTabs}). It renders the record's
 * timeline — notes, tasks, calls, meetings, emails and comments — newest-first,
 * grouped by day, each entry stamped with its author avatar and a relative
 * time. A compact composer at the top adds new entries with an optimistic
 * insert so the feed updates instantly while the gated server action runs.
 *
 * Data flow (all gated, tenant-scoped, fail-closed):
 *   - load / paginate  → {@link listActivitiesAction}  (sabcrm:view)
 *   - add a note/etc.  → {@link createActivityAction}   (sabcrm:manage)
 *   - add a comment    → {@link addCommentAction}        (sabcrm:manage)
 *
 * The component performs no Mongo access of its own; it only calls the server
 * actions, which run the full session → project → RBAC → plan pipeline. File
 * attachments are sourced exclusively from SabFiles via {@link SabFilePickerButton}
 * (the `SabFilePick.id` becomes the attachment's SabFiles `fileId`) — there is
 * no free-text URL paste.
 *
 * Styling is ZoruUI-only, black-and-white, using the namespaced `--zoru-*`
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
  Paperclip,
  Loader2,
  Send,
  X,
} from 'lucide-react';

import {
  Card,
  CardContent,
  Button,
  Badge,
  Separator,
  Avatar,
  ZoruAvatarImage,
  ZoruAvatarFallback,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  EmptyState,
  Skeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import {
  listActivitiesAction,
  createActivityAction,
  addCommentAction,
} from '@/app/actions/sabcrm.actions';
import type {
  CrmActivityRecord,
  TimelineActivityType,
  ActivityAttachment,
} from '@/lib/sabcrm/activities.server';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** A minimal author profile snapshot, keyed by user id, for avatars + names. */
export interface TimelineAuthor {
  /** Display name (falls back to the id when omitted). */
  name?: string;
  /** Avatar image URL (SabFiles-served or workspace profile). */
  avatarUrl?: string;
}

export interface ActivityTimelineProps {
  /** Object slug the record belongs to (e.g. `companies`). */
  targetObject: string;
  /** Serialized id of the record whose timeline this is. */
  targetRecordId: string;
  /** Server-loaded first page (optional — falls back to a client load). */
  initialActivities?: CrmActivityRecord[];
  /** Total count from the server, when `initialActivities` is provided. */
  initialTotal?: number;
  /** Page size for loads + "load more". Defaults to 20. */
  pageSize?: number;
  /** Active project override forwarded to every gated action. */
  projectId?: string;
  /** Whether the current user may post to the timeline (gates the composer). */
  canPost?: boolean;
  /** The signed-in user's id, used to render their own author chip optimistically. */
  currentUserId?: string;
  /** Author profiles keyed by user id (name + avatar). */
  authors?: Record<string, TimelineAuthor>;
  className?: string;
}

/** Composer-creatable types (TASK is created via the task surface, not here). */
type ComposerType = Extract<
  TimelineActivityType,
  'COMMENT' | 'NOTE' | 'CALL' | 'MEETING' | 'EMAIL'
>;

interface ComposerOption {
  value: ComposerType;
  label: string;
}

const COMPOSER_OPTIONS: readonly ComposerOption[] = [
  { value: 'COMMENT', label: 'Comment' },
  { value: 'NOTE', label: 'Note' },
  { value: 'CALL', label: 'Call' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'EMAIL', label: 'Email' },
] as const;

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

/** Stable day-group key (local day) + a human heading for it. */
function dayKey(value: Date | string | number): string {
  const d = new Date(toMs(value));
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayHeading(value: Date | string | number, nowMs: number): string {
  const then = toMs(value);
  const d = new Date(then);
  const now = new Date(nowMs);
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayMs = 86_400_000;
  const diffDays = Math.round((startOf(now) - startOf(d)) / dayMs);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  }
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/** First-letter(s) initials for an avatar fallback. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface DayGroup {
  key: string;
  heading: string;
  items: CrmActivityRecord[];
}

/** Group an already-sorted (newest-first) list into day buckets. */
function groupByDay(
  activities: CrmActivityRecord[],
  nowMs: number,
): DayGroup[] {
  const groups: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const a of activities) {
    const key = dayKey(a.createdAt);
    if (!current || current.key !== key) {
      current = { key, heading: dayHeading(a.createdAt, nowMs), items: [] };
      groups.push(current);
    }
    current.items.push(a);
  }
  return groups;
}

/** Map a SabFiles pick to the activity attachment shape (no external URLs). */
function pickToAttachment(pick: SabFilePick): ActivityAttachment {
  const att: ActivityAttachment = { fileId: pick.id, name: pick.name };
  if (pick.url) att.url = pick.url;
  if (pick.mime) att.contentType = pick.mime;
  if (typeof pick.size === 'number') att.size = pick.size;
  return att;
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function AuthorAvatar({
  author,
  authorId,
  pending,
}: {
  author: TimelineAuthor | undefined;
  authorId: string;
  pending?: boolean;
}): React.ReactElement {
  const name = author?.name?.trim() || authorId || 'Unknown';
  return (
    <Avatar className={cn('h-8 w-8', pending && 'opacity-60')}>
      {author?.avatarUrl ? (
        <ZoruAvatarImage src={author.avatarUrl} alt={name} />
      ) : null}
      <ZoruAvatarFallback>{initials(name)}</ZoruAvatarFallback>
    </Avatar>
  );
}

function AttachmentRow({
  attachments,
}: {
  attachments: ActivityAttachment[];
}): React.ReactElement | null {
  if (!attachments.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {attachments.map((att) => {
        const chip = (
          <span className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-md border border-zoru-line bg-zoru-surface-muted px-2 py-1 text-xs text-zoru-ink">
            <Paperclip className="h-3 w-3 shrink-0 text-zoru-ink-muted" />
            <span className="min-w-0 truncate">{att.name}</span>
          </span>
        );
        return (
          <li key={att.fileId}>
            {att.url ? (
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-80"
              >
                {chip}
              </a>
            ) : (
              chip
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TimelineEntry({
  activity,
  author,
  nowMs,
  pending,
}: {
  activity: CrmActivityRecord;
  author: TimelineAuthor | undefined;
  nowMs: number;
  pending?: boolean;
}): React.ReactElement {
  const Icon = TYPE_ICON[activity.type] ?? MessageSquare;
  const authorName =
    author?.name?.trim() || activity.authorId || 'Unknown';
  const isComment = activity.type === 'COMMENT';

  return (
    <li
      className={cn(
        'relative flex gap-3 pb-5 pl-1 last:pb-0',
        pending && 'opacity-70',
      )}
    >
      <AuthorAvatar
        author={author}
        authorId={activity.authorId}
        pending={pending}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium text-zoru-ink">{authorName}</span>
          {!isComment && (
            <Badge
              variant="outline"
              className="inline-flex items-center gap-1 px-1.5 py-0 text-[11px] font-normal"
            >
              <Icon className="h-3 w-3" />
              {TYPE_LABEL[activity.type]}
            </Badge>
          )}
          <span className="text-xs text-zoru-ink-muted">
            {pending ? 'Saving…' : relativeTime(activity.createdAt, nowMs)}
          </span>
        </div>

        {!isComment && activity.title ? (
          <p className="mt-0.5 text-sm font-medium text-zoru-ink">
            {activity.title}
          </p>
        ) : null}

        {activity.body ? (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zoru-ink-muted">
            {activity.body}
          </p>
        ) : null}

        <AttachmentRow attachments={activity.attachments} />
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Composer                                                                   */
/* -------------------------------------------------------------------------- */

function Composer({
  type,
  setType,
  body,
  setBody,
  attachments,
  onAddPick,
  onRemoveAttachment,
  submitting,
  onSubmit,
}: {
  type: ComposerType;
  setType: (t: ComposerType) => void;
  body: string;
  setBody: (v: string) => void;
  attachments: ActivityAttachment[];
  onAddPick: (pick: SabFilePick) => void;
  onRemoveAttachment: (fileId: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}): React.ReactElement {
  const placeholder =
    type === 'COMMENT'
      ? 'Write a comment…'
      : `Log a ${TYPE_LABEL[type].toLowerCase()}…`;

  const canSubmit = body.trim().length > 0 && !submitting;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <Select
            value={type}
            onValueChange={(v) => setType(v as ComposerType)}
          >
            <SelectTrigger className="h-8 w-[140px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPOSER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          disabled={submitting}
          className="resize-y text-sm"
        />

        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <li key={att.fileId}>
                <span className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-md border border-zoru-line bg-zoru-surface-muted px-2 py-1 text-xs text-zoru-ink">
                  <Paperclip className="h-3 w-3 shrink-0 text-zoru-ink-muted" />
                  <span className="min-w-0 truncate">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(att.fileId)}
                    disabled={submitting}
                    aria-label={`Remove ${att.name}`}
                    className="ml-0.5 rounded-sm text-zoru-ink-muted transition-colors hover:text-zoru-ink disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2">
          <SabFilePickerButton
            accept="all"
            variant="outline"
            className="h-8 px-3 text-sm"
            onPick={onAddPick}
          >
            <Paperclip className="h-4 w-4" />
            Attach
          </SabFilePickerButton>
          <Button
            type="button"
            size="sm"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {type === 'COMMENT' ? 'Comment' : 'Log'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                   */
/* -------------------------------------------------------------------------- */

function TimelineSkeleton(): React.ReactElement {
  return (
    <ul className="flex flex-col gap-5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
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

let optimisticSeq = 0;

/**
 * Record activity timeline. Lists activities newest-first, grouped by day,
 * with an optimistic composer for notes/comments/calls/meetings/emails.
 */
export function ActivityTimeline({
  targetObject,
  targetRecordId,
  initialActivities,
  initialTotal,
  pageSize = 20,
  projectId,
  canPost = true,
  currentUserId,
  authors,
  className,
}: ActivityTimelineProps): React.ReactElement {
  const { toast } = useZoruToast();

  const [activities, setActivities] = React.useState<CrmActivityRecord[]>(
    () => initialActivities ?? [],
  );
  const [total, setTotal] = React.useState<number>(
    () => initialTotal ?? initialActivities?.length ?? 0,
  );
  const [page, setPage] = React.useState<number>(
    () => (initialActivities ? 1 : 0),
  );
  const [loading, setLoading] = React.useState<boolean>(!initialActivities);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Composer state.
  const [composerType, setComposerType] =
    React.useState<ComposerType>('COMMENT');
  const [body, setBody] = React.useState('');
  const [pendingAttachments, setPendingAttachments] = React.useState<
    ActivityAttachment[]
  >([]);
  const [submitting, setSubmitting] = React.useState(false);

  // Ids of optimistic (not-yet-confirmed) entries, for the dimmed state.
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // `Date.now()` captured once per render so relative times stay stable within
  // a paint (and SSR/CSR don't disagree mid-stream).
  const nowMs = React.useMemo(() => Date.now(), [activities]);

  const fetchPage = React.useCallback(
    async (nextPage: number, mode: 'replace' | 'append') => {
      if (mode === 'replace') {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setLoadError(null);
      try {
        const res = await listActivitiesAction(
          { targetObject, targetRecordId, page: nextPage, pageSize },
          projectId,
        );
        if (!res.ok) {
          setLoadError(res.error);
          return;
        }
        setTotal(res.data.total);
        setPage(res.data.page);
        setActivities((prev) =>
          mode === 'replace'
            ? res.data.activities
            : dedupeById([...prev, ...res.data.activities]),
        );
      } catch {
        setLoadError('Failed to load the timeline.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [targetObject, targetRecordId, pageSize, projectId],
  );

  // Initial client load when the server did not seed a first page.
  React.useEffect(() => {
    if (initialActivities) return;
    void fetchPage(1, 'replace');
    // Run once on mount for this record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasMore = activities.length < total;

  async function handleSubmit(): Promise<void> {
    const text = body.trim();
    if (!text || submitting) return;

    setSubmitting(true);

    const optimisticId = `optimistic-${++optimisticSeq}`;
    const now = new Date();
    const attachmentsSnapshot = pendingAttachments;
    const optimistic: CrmActivityRecord = {
      _id: optimisticId,
      projectId: projectId ?? '',
      type: composerType,
      title: composerType === 'COMMENT' ? 'Comment' : TYPE_LABEL[composerType],
      body: text,
      targetObject,
      targetRecordId,
      authorId: currentUserId ?? '',
      attachments: attachmentsSnapshot,
      mentions: [],
      createdAt: now,
      updatedAt: now,
    };

    // Optimistic insert at the top (feed is newest-first).
    setActivities((prev) => [optimistic, ...prev]);
    setTotal((t) => t + 1);
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.add(optimisticId);
      return next;
    });

    // Clear the composer immediately for a snappy feel.
    setBody('');
    setPendingAttachments([]);

    try {
      const res =
        composerType === 'COMMENT'
          ? await addCommentAction(
              {
                targetObject,
                targetRecordId,
                body: text,
                attachments: attachmentsSnapshot,
              },
              projectId,
            )
          : await createActivityAction(
              {
                type: composerType,
                title: TYPE_LABEL[composerType],
                body: text,
                targetObject,
                targetRecordId,
                attachments: attachmentsSnapshot,
              },
              projectId,
            );

      if (!res.ok) {
        // Roll back the optimistic entry and restore the draft.
        setActivities((prev) => prev.filter((a) => a._id !== optimisticId));
        setTotal((t) => Math.max(0, t - 1));
        setBody(text);
        setPendingAttachments(attachmentsSnapshot);
        toast({
          variant: 'destructive',
          title: 'Could not post',
          description: res.error,
        });
        return;
      }

      // Swap the optimistic entry for the confirmed server record.
      const confirmed = res.data;
      setActivities((prev) =>
        prev.map((a) => (a._id === optimisticId ? confirmed : a)),
      );
    } catch {
      setActivities((prev) => prev.filter((a) => a._id !== optimisticId));
      setTotal((t) => Math.max(0, t - 1));
      setBody(text);
      setPendingAttachments(attachmentsSnapshot);
      toast({
        variant: 'destructive',
        title: 'Could not post',
        description: 'An unexpected error occurred.',
      });
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(optimisticId);
        return next;
      });
      setSubmitting(false);
    }
  }

  function handleAddPick(pick: SabFilePick): void {
    if (!pick?.id) return;
    setPendingAttachments((prev) => {
      const byId = new Map(prev.map((a) => [a.fileId, a]));
      byId.set(pick.id, pickToAttachment(pick));
      return Array.from(byId.values());
    });
  }

  function handleRemoveAttachment(fileId: string): void {
    setPendingAttachments((prev) => prev.filter((a) => a.fileId !== fileId));
  }

  const groups = React.useMemo(
    () => groupByDay(activities, nowMs),
    [activities, nowMs],
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {canPost && (
        <Composer
          type={composerType}
          setType={setComposerType}
          body={body}
          setBody={setBody}
          attachments={pendingAttachments}
          onAddPick={handleAddPick}
          onRemoveAttachment={handleRemoveAttachment}
          submitting={submitting}
          onSubmit={() => void handleSubmit()}
        />
      )}

      <Card>
        <CardContent className="p-4 sm:p-5">
          {loading ? (
            <TimelineSkeleton />
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <EmptyState
                title="Couldn’t load activity"
                description={loadError}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchPage(1, 'replace')}
              >
                Retry
              </Button>
            </div>
          ) : activities.length === 0 ? (
            <div className="py-8">
              <EmptyState
                title="No activity yet"
                description={
                  canPost
                    ? 'Add a note or comment to start the timeline.'
                    : 'Activity on this record will appear here.'
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <section key={group.key}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-zoru-ink-muted">
                      {group.heading}
                    </span>
                    <Separator className="flex-1" />
                  </div>
                  <ul className="flex flex-col">
                    {group.items.map((activity) => (
                      <TimelineEntry
                        key={activity._id}
                        activity={activity}
                        author={authors?.[activity.authorId]}
                        nowMs={nowMs}
                        pending={pendingIds.has(activity._id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}

              {hasMore && (
                <div className="flex justify-center pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingMore}
                    onClick={() => void fetchPage(page + 1, 'append')}
                    className="gap-1.5"
                  >
                    {loadingMore && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Load older activity
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** De-duplicate activities by `_id`, keeping first occurrence (newest). */
function dedupeById(list: CrmActivityRecord[]): CrmActivityRecord[] {
  const seen = new Set<string>();
  const out: CrmActivityRecord[] = [];
  for (const a of list) {
    if (seen.has(a._id)) continue;
    seen.add(a._id);
    out.push(a);
  }
  return out;
}

export default ActivityTimeline;
