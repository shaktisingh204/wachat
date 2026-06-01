'use client';

/**
 * SabCRM — record Activity tab (timeline + composer).
 *
 * Fills the Activity tab of `RecordDetailTabs` for a single record. Two halves:
 *
 *   1. **Composer** — a type-switchable form (Note / Task / Call / Meeting /
 *      Email / Comment) that creates a timeline activity against the current
 *      record via the gated `createActivityAction`. TASK entries expose a
 *      status + due-date. Attachments are sourced from SabFiles (never an
 *      external URL paste) through `<SabFilePickerButton>`.
 *   2. **Timeline** — the record's activities, newest first, paginated through
 *      `listActivitiesAction`. Each entry shows its type, title, body,
 *      timestamp, attachments and (for tasks) a status control. Entries can be
 *      deleted via `deleteActivityAction` and tasks advanced via
 *      `setTaskStatusAction`.
 *
 * This component owns its own data fetching (client-side, through the gated
 * server actions) so the Activity tab refreshes after each mutation without a
 * full page reload. The host page stays a server component and simply mounts
 * this in `RecordDetailTabs`'s `activitySlot`.
 *
 * All UI is ZoruUI, black-&-white. No `any`.
 */

import * as React from 'react';
import {
  CalendarClock,
  Check,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import {
  createActivityAction,
  deleteActivityAction,
  listActivitiesAction,
  setTaskStatusAction,
} from '@/app/actions/sabcrm.actions';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
  cn,
} from '@/components/zoruui';
import type {
  ActivityAttachment,
  CrmActivityRecord,
  TaskStatus,
  TimelineActivityType,
} from '@/lib/sabcrm/activities.server';
import type { CrmRecordWithLabel, ObjectMetadata } from '@/lib/sabcrm/types';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Composer / timeline activity types in display order, with their chrome. */
const ACTIVITY_TYPES: ReadonlyArray<{
  value: TimelineActivityType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'NOTE', label: 'Note', icon: FileText },
  { value: 'TASK', label: 'Task', icon: Check },
  { value: 'CALL', label: 'Call', icon: Phone },
  { value: 'MEETING', label: 'Meeting', icon: Users },
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'COMMENT', label: 'Comment', icon: MessageSquare },
];

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

const TASK_STATUS_ORDER: readonly TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

const PAGE_SIZE = 20;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function typeMeta(type: TimelineActivityType) {
  return ACTIVITY_TYPES.find((t) => t.value === type) ?? ACTIVITY_TYPES[0];
}

/** Compact relative timestamp ("just now", "3h ago", or a date). */
function formatTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Human file size for attachment chips. */
function formatSize(bytes: number | undefined): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/**
 * Reduce a SabFiles {@link SabFilePick} ({@code { id, url, name, mime?, size? }})
 * to the persisted {@link ActivityAttachment} shape. Display fields are
 * snapshotted so the timeline renders without a join; the create action
 * re-sanitises server-side. `fileId` is the only required field.
 */
function pickToAttachment(pick: SabFilePick): ActivityAttachment {
  const att: ActivityAttachment = {
    fileId: pick.id,
    name: pick.name && pick.name.trim() ? pick.name : pick.id,
  };
  if (pick.mime) att.contentType = pick.mime;
  if (typeof pick.size === 'number' && Number.isFinite(pick.size)) {
    att.size = pick.size;
  }
  if (pick.url) att.url = pick.url;
  return att;
}

/* -------------------------------------------------------------------------- */
/* Composer                                                                   */
/* -------------------------------------------------------------------------- */

interface ComposerProps {
  targetObject: string;
  targetRecordId: string;
  onCreated: (activity: CrmActivityRecord) => void;
}

function ActivityComposer({
  targetObject,
  targetRecordId,
  onCreated,
}: ComposerProps): React.ReactElement {
  const [type, setType] = React.useState<TimelineActivityType>('NOTE');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [status, setStatus] = React.useState<TaskStatus>('TODO');
  const [dueAt, setDueAt] = React.useState('');
  const [attachments, setAttachments] = React.useState<ActivityAttachment[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reset = React.useCallback(() => {
    setTitle('');
    setBody('');
    setStatus('TODO');
    setDueAt('');
    setAttachments([]);
    setError(null);
  }, []);

  const handlePicked = React.useCallback((pick: SabFilePick) => {
    const att = pickToAttachment(pick);
    if (!att.fileId) return;
    setAttachments((prev) =>
      prev.some((a) => a.fileId === att.fileId) ? prev : [...prev, att],
    );
  }, []);

  const removeAttachment = React.useCallback((fileId: string) => {
    setAttachments((prev) => prev.filter((a) => a.fileId !== fileId));
  }, []);

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleSubmit = React.useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await createActivityAction({
      type,
      title: title.trim(),
      body: body.trim() || undefined,
      targetObject,
      targetRecordId,
      attachments: attachments.length ? attachments : undefined,
      status: type === 'TASK' ? status : undefined,
      dueAt: type === 'TASK' && dueAt ? dueAt : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.data);
    reset();
  }, [
    canSubmit,
    type,
    title,
    body,
    targetObject,
    targetRecordId,
    attachments,
    status,
    dueAt,
    onCreated,
    reset,
  ]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Type selector */}
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_TYPES.map((t) => {
            const Icon = t.icon;
            const active = t.value === type;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-zoru-ink bg-zoru-ink text-zoru-bg'
                    : 'border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:bg-zoru-surface',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="activity-title" className="sr-only">
            Title
          </Label>
          <Input
            id="activity-title"
            value={title}
            placeholder={`${typeMeta(type).label} title…`}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            value={body}
            placeholder="Add details…"
            rows={3}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        {type === 'TASK' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="activity-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
              >
                <SelectTrigger id="activity-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="activity-due">Due</Label>
              <Input
                id="activity-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </div>
        )}

        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <li
                key={att.fileId}
                className="inline-flex items-center gap-1.5 rounded-md border border-zoru-line bg-zoru-surface px-2 py-1 text-xs"
              >
                <Paperclip className="h-3 w-3 text-zoru-ink-muted" />
                <span className="max-w-[12rem] truncate">{att.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${att.name}`}
                  className="text-zoru-ink-muted hover:text-zoru-ink"
                  onClick={() => removeAttachment(att.fileId)}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="text-xs text-zoru-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <SabFilePickerButton onPick={handlePicked}>
            <Paperclip className="mr-1.5 h-3.5 w-3.5" />
            Attach
          </SabFilePickerButton>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {submitting && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Log {typeMeta(type).label.toLowerCase()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Timeline entry                                                             */
/* -------------------------------------------------------------------------- */

interface TimelineEntryProps {
  activity: CrmActivityRecord;
  canManage: boolean;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  busyId: string | null;
}

function TimelineEntry({
  activity,
  canManage,
  onStatusChange,
  onDelete,
  busyId,
}: TimelineEntryProps): React.ReactElement {
  const meta = typeMeta(activity.type);
  const Icon = meta.icon;
  const busy = busyId === activity._id;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* Rail */}
      <div className="flex flex-col items-center">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zoru-line bg-zoru-bg text-zoru-ink">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span aria-hidden className="mt-1 w-px flex-1 bg-zoru-line last:hidden" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px] uppercase">
            {meta.label}
          </Badge>
          <span className="truncate text-sm font-medium text-zoru-ink">
            {activity.title}
          </span>
          <span className="ml-auto whitespace-nowrap text-xs text-zoru-ink-muted">
            {formatTimestamp(activity.createdAt)}
          </span>
        </div>

        {activity.body && (
          <p className="mt-1 whitespace-pre-wrap text-sm text-zoru-ink-muted">
            {activity.body}
          </p>
        )}

        {activity.type === 'TASK' && activity.status && (
          <div className="mt-2 flex items-center gap-2">
            {canManage ? (
              <Select
                value={activity.status}
                onValueChange={(v) =>
                  onStatusChange(activity._id, v as TaskStatus)
                }
              >
                <SelectTrigger
                  aria-label="Task status"
                  className="h-8 w-auto min-w-[8rem] text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="text-xs">
                {TASK_STATUS_LABELS[activity.status]}
              </Badge>
            )}
            {busy && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-zoru-ink-muted" />
            )}
            {activity.dueAt && (
              <span className="inline-flex items-center gap-1 text-xs text-zoru-ink-muted">
                <CalendarClock className="h-3.5 w-3.5" />
                {formatTimestamp(activity.dueAt)}
              </span>
            )}
          </div>
        )}

        {activity.attachments.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {activity.attachments.map((att) => {
              const size = formatSize(att.size);
              const chip = (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-zoru-line bg-zoru-surface px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3 text-zoru-ink-muted" />
                  <span className="max-w-[12rem] truncate">{att.name}</span>
                  {size && <span className="text-zoru-ink-muted">{size}</span>}
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
        )}
      </div>

      {canManage && (
        <button
          type="button"
          aria-label="Delete activity"
          disabled={busy}
          className="shrink-0 self-start rounded-md p-1 text-zoru-ink-muted transition-colors hover:bg-zoru-surface hover:text-zoru-danger disabled:opacity-50"
          onClick={() => onDelete(activity._id)}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Activity tab                                                               */
/* -------------------------------------------------------------------------- */

export interface RecordActivityProps {
  /** Object metadata for the record this timeline is attached to. */
  object: ObjectMetadata;
  /** The record this timeline is attached to. */
  record: CrmRecordWithLabel;
  /** Whether the current user may create / mutate activities. */
  canManage?: boolean;
  className?: string;
}

/**
 * The full Activity tab body: composer on top, paginated timeline below. Owns
 * its own loading/error state and refreshes after each mutation. Mounted by
 * the record detail page into `RecordDetailTabs`'s `activitySlot`.
 */
export function RecordActivity({
  object,
  record,
  canManage = true,
  className,
}: RecordActivityProps): React.ReactElement {
  const targetObject = object.slug;
  const targetRecordId = record._id;

  const [activities, setActivities] = React.useState<CrmActivityRecord[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (targetPage: number, mode: 'replace' | 'append') => {
      if (mode === 'append') setLoadingMore(true);
      else setLoading(true);
      setError(null);
      const result = await listActivitiesAction({
        targetObject,
        targetRecordId,
        page: targetPage,
        pageSize: PAGE_SIZE,
      });
      if (mode === 'append') setLoadingMore(false);
      else setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTotal(result.data.total);
      setPage(result.data.page);
      setActivities((prev) =>
        mode === 'append'
          ? [...prev, ...result.data.activities]
          : result.data.activities,
      );
    },
    [targetObject, targetRecordId],
  );

  React.useEffect(() => {
    void load(1, 'replace');
  }, [load]);

  const handleCreated = React.useCallback((activity: CrmActivityRecord) => {
    setActivities((prev) => [activity, ...prev]);
    setTotal((t) => t + 1);
  }, []);

  const handleStatusChange = React.useCallback(
    async (id: string, status: TaskStatus) => {
      setBusyId(id);
      const result = await setTaskStatusAction(id, status);
      setBusyId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const updated = result.data;
      setActivities((prev) => prev.map((a) => (a._id === id ? updated : a)));
    },
    [],
  );

  const handleDelete = React.useCallback(async (id: string) => {
    setBusyId(id);
    const result = await deleteActivityAction(id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setActivities((prev) => prev.filter((a) => a._id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

  const hasMore = activities.length < total;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {canManage && (
        <ActivityComposer
          targetObject={targetObject}
          targetRecordId={targetRecordId}
          onCreated={handleCreated}
        />
      )}

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-zoru-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading activity…
            </div>
          ) : error && activities.length === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <EmptyState
                title="Couldn't load activity"
                description={error}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void load(1, 'replace')}
              >
                Retry
              </Button>
            </div>
          ) : activities.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description={
                canManage
                  ? 'Log a note, task, call, meeting or email above to start the timeline.'
                  : 'The activity timeline for this record will appear here.'
              }
            />
          ) : (
            <>
              {error && (
                <p className="mb-3 text-xs text-zoru-danger" role="alert">
                  {error}
                </p>
              )}
              <ol className="flex flex-col">
                {activities.map((activity) => (
                  <TimelineEntry
                    key={activity._id}
                    activity={activity}
                    canManage={canManage}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    busyId={busyId}
                  />
                ))}
              </ol>

              {hasMore && (
                <>
                  <Separator className="my-2" />
                  <div className="flex justify-center pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loadingMore}
                      onClick={() => void load(page + 1, 'append')}
                    >
                      {loadingMore && (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      )}
                      Load more
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
