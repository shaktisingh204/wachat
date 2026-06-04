'use client';

/**
 * SabCRM — Twenty-faithful record DETAIL TABS (self-contained client widget).
 *
 * `<RecordDetailTabs object recordId projectId? />` renders the tabbed MAIN
 * panel of a Twenty record-show page: a horizontal tab strip plus a lazily
 * loaded tab body. Mirrors Twenty's `RecordShowContainerTab` set:
 *
 *   · Timeline  — the record's activity feed (NOTE | TASK | CALL | MEETING |
 *                 EMAIL …) as a connected vertical rail, each entry expandable
 *                 into its comment thread, plus a quick composer to post a NOTE.
 *   · Notes     — NOTE-kind activities only (Twenty's Notes tab).
 *   · Tasks     — TASK-kind activities only, with a status chip + due meta.
 *   · Relations — the record's related records grouped per RELATION field
 *                 (parents + children), each a compact list.
 *   · Files     — attachments gathered off the record's activities.
 *
 * Every tab fetches ON FIRST OPEN through the EXISTING gated server actions
 * (`listSabcrmActivitiesTw`, `createSabcrmActivityTw`, `getRecordRelationsTw`,
 * `listRelatedSabcrmRecordsTw`, `listActivityCommentsTw`, `addActivityCommentTw`)
 * and caches the result for the component's lifetime. The Rust engine may be
 * down, so every load degrades gracefully into an empty / muted error state —
 * this widget never throws.
 *
 * This is intentionally STANDALONE: it owns its data, has no shared state with
 * the page that mounts it, and uses ONLY the `.sabcrm-twenty` design system
 * (`st-rdt-*` classes in the co-located stylesheet + the shared Twenty kit:
 * `TwentyFieldValue`, `TwentyChip`, `TwentyAvatar`, `TwentyTimeline`). NO
 * ZoruUI / Tailwind / clay.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Activity,
  StickyNote,
  CheckCircle2,
  Circle,
  Link2,
  Paperclip,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Loader2,
  Plus,
  CalendarClock,
  Phone,
  Mail,
  AlertTriangle,
  Building2,
  Users,
  Briefcase,
  X,
  type LucideIcon,
} from 'lucide-react';

import { TwentyAvatar } from './twenty-primitives';
import { SabFilePickerButton } from '@/components/sabfiles';
import type { SabFilePick } from '@/components/sabfiles';
import {
  listSabcrmActivitiesTw,
  createSabcrmActivityTw,
  getRecordRelationsTw,
  listActivityCommentsTw,
  addActivityCommentTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type {
  SabcrmRustActivity,
  SabcrmAttachment,
  SabcrmComment,
  RecordRelation,
  SabcrmRustRecord,
} from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

import './record-detail-tabs.css';

/* =========================================================================
   Props
   ========================================================================= */

export interface RecordDetailTabsProps {
  /** The metadata of the object this record belongs to. */
  object: ObjectMetadata;
  /** The serialized id of the record whose detail tabs to render. */
  recordId: string;
  /** Active project — threaded to every gated action (defaults server-side). */
  projectId?: string;
}

/* =========================================================================
   Tab catalogue
   ========================================================================= */

type TabKey = 'timeline' | 'notes' | 'tasks' | 'relations' | 'files' | 'emails';

const TAB_DEFS: readonly { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'timeline', label: 'Timeline', icon: Activity },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'tasks', label: 'Tasks', icon: CheckCircle2 },
  { key: 'relations', label: 'Relations', icon: Link2 },
  { key: 'files', label: 'Files', icon: Paperclip },
  { key: 'emails', label: 'Emails', icon: Mail },
] as const;

/* =========================================================================
   Time / value helpers
   ========================================================================= */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Compact relative time — "just now", "5m ago", "3h ago", "2d ago", else date. */
function relTime(value: string): string {
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

/** Humanize a due date for the task meta row; null when unparseable. */
function formatDue(value: string): string | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Human-readable byte size for a chip ("1.2 MB"); empty when unknown. */
function fmtBytes(bytes?: number): string {
  if (bytes == null || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

/** A timeline icon for a known activity type (falls back to a generic dot). */
const TYPE_ICON: Record<string, LucideIcon> = {
  NOTE: StickyNote,
  TASK: CheckCircle2,
  CALL: Phone,
  MEETING: CalendarClock,
  EMAIL: Mail,
  COMMENT: MessageSquare,
};

function iconForType(type: string): LucideIcon {
  return TYPE_ICON[type.toUpperCase()] ?? Activity;
}

/** True when a TASK activity is in its completed state. */
function isTaskDone(a: SabcrmRustActivity): boolean {
  return (a.status ?? '').toUpperCase() === 'DONE';
}

/** Read attachments off an activity defensively (legacy rows omit the field). */
function activityAttachments(a: SabcrmRustActivity): SabcrmAttachment[] {
  const raw = (a as { attachments?: unknown }).attachments;
  return Array.isArray(raw) ? (raw as SabcrmAttachment[]) : [];
}

/** Map a SabFiles pick into the engine's attachment ref (never a raw URL). */
function pickToAttachment(pick: SabFilePick): SabcrmAttachment {
  return {
    fileId: pick.id,
    name: pick.name,
    contentType: pick.mime,
    size: pick.size,
    url: pick.url,
  };
}

/**
 * Best-effort human label for an author id. The engine stores only the user
 * id (no profile join yet), so we surface a short, stable handle; Twenty shows
 * the full name + avatar, which we approximate from the same string so the
 * avatar colour/initial stays consistent per author.
 */
function authorLabel(authorId?: string): string {
  const id = (authorId ?? '').trim();
  if (!id) return 'Unknown';
  // A bare ObjectId/hex looks noisy in the UI — shorten it to a handle.
  if (/^[a-f0-9]{16,}$/i.test(id)) return `User ${id.slice(-4)}`;
  return id;
}

/** Best-effort display label for a related record from its raw `data` bag. */
function relationRecordLabel(
  record: SabcrmRustRecord,
  labelField?: string,
): string {
  const data = record.data ?? {};
  const order = [
    labelField,
    'name',
    'label',
    'title',
    'displayName',
    'fullName',
    'firstName',
  ].filter(Boolean) as string[];
  for (const key of order) {
    const raw = data[key];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (typeof raw === 'number') return String(raw);
  }
  const first = data.firstName;
  const last = data.lastName;
  if (typeof first === 'string' || typeof last === 'string') {
    const composed = [first, last].filter(Boolean).join(' ').trim();
    if (composed) return composed;
  }
  return `#${record.id.slice(-6)}`;
}

/** Map a known object slug to a Twenty sidebar icon (best-effort). */
const SLUG_ICON: Record<string, LucideIcon> = {
  companies: Building2,
  people: Users,
  opportunities: Briefcase,
  notes: StickyNote,
  tasks: CheckCircle2,
};

/* =========================================================================
   Generic async-data hook — fetch once on demand, cache for the lifetime
   ========================================================================= */

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Lazily run `loader()` the first time `enabled` flips true, caching the result.
 * Cancels in-flight work on unmount; never throws. `reload` re-runs on demand.
 */
function useLazyData<T>(
  enabled: boolean,
  loader: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = React.useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });
  const [nonce, setNonce] = React.useState(0);
  const loaded = React.useRef(false);
  const loaderRef = React.useRef(loader);
  loaderRef.current = loader;

  React.useEffect(() => {
    if (!enabled) return;
    if (loaded.current && nonce === 0) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      const res = await loaderRef.current();
      if (cancelled) return;
      if (res.ok) {
        setState({ data: res.data, loading: false, error: null });
        loaded.current = true;
      } else {
        setState((s) => ({ ...s, loading: false, error: res.error }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, nonce]);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

/* =========================================================================
   Shared states
   ========================================================================= */

function LoadingState({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="st-rdt-state" role="status">
      <Loader2 size={14} className="st-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): React.JSX.Element {
  return (
    <div className="st-rdt-state st-rdt-state--error" role="alert">
      <AlertTriangle size={14} aria-hidden="true" />
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="st-rdt-retry" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}): React.JSX.Element {
  return (
    <div className="st-rdt-empty">
      <span className="st-rdt-empty__icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="st-rdt-empty__title">{title}</span>
      {hint ? <span className="st-rdt-empty__hint">{hint}</span> : null}
    </div>
  );
}

/* =========================================================================
   Attachment chip
   ========================================================================= */

function AttachmentChip({
  attachment,
}: {
  attachment: SabcrmAttachment;
}): React.JSX.Element {
  const size = fmtBytes(attachment.size);
  return (
    <span className="st-rdt-file" title={attachment.name}>
      <FileText className="st-rdt-file__icon" size={12} aria-hidden="true" />
      {attachment.url ? (
        <a
          className="st-rdt-file__name"
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {attachment.name}
        </a>
      ) : (
        <span className="st-rdt-file__name">{attachment.name}</span>
      )}
      {size ? <span className="st-rdt-file__size">{size}</span> : null}
    </span>
  );
}

/* =========================================================================
   Comment thread (per activity) — lazy, optimistic
   ========================================================================= */

let optimisticSeq = 0;
function nextOptimisticId(): string {
  optimisticSeq += 1;
  return `optimistic-${Date.now()}-${optimisticSeq}`;
}

interface CommentThreadProps {
  activityId: string;
  projectId?: string;
}

/**
 * An expandable comment thread hanging under one timeline entry. Collapsed by
 * default; expanding lazily loads `listActivityCommentsTw`. Posting via
 * `addActivityCommentTw` is optimistic (prepend immediately, reconcile or roll
 * back). Graceful on every failure (engine may be down).
 */
function CommentThread({
  activityId,
  projectId,
}: CommentThreadProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [comments, setComments] = React.useState<SabcrmComment[]>([]);
  const [draft, setDraft] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || loaded || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await listActivityCommentsTw(activityId, projectId);
      if (cancelled) return;
      if (res.ok) {
        setComments(res.data);
        setLoaded(true);
      } else {
        setError(res.error);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded, loading, activityId, projectId]);

  const post = React.useCallback(async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    setError(null);
    const tempId = nextOptimisticId();
    const optimistic: SabcrmComment = {
      id: tempId,
      body,
      authorId: '',
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    setDraft('');
    const res = await addActivityCommentTw(activityId, body, projectId);
    setPosting(false);
    if (res.ok) {
      setComments((prev) => prev.map((c) => (c.id === tempId ? res.data : c)));
    } else {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setDraft(body);
      setError(res.error);
    }
  }, [draft, posting, activityId, projectId]);

  const count = comments.length;

  return (
    <div className="st-rdt-thread">
      <button
        type="button"
        className={`st-rdt-thread__toggle${open ? ' is-open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MessageSquare size={12} aria-hidden="true" />
        <span>
          {count > 0
            ? `${count} ${count === 1 ? 'comment' : 'comments'}`
            : 'Comment'}
        </span>
        <ChevronDown size={12} className="st-rdt-thread__chev" aria-hidden="true" />
      </button>

      {open ? (
        <div className="st-rdt-thread__panel">
          {loading ? (
            <div className="st-rdt-thread__state">
              <Loader2 size={12} className="st-spin" aria-hidden="true" />
              Loading comments…
            </div>
          ) : (
            <>
              {comments.length > 0 ? (
                <ul className="st-rdt-comments">
                  {comments.map((c) => {
                    const optimistic = c.id.startsWith('optimistic-');
                    const author = authorLabel(c.authorId);
                    return (
                      <li
                        className={`st-rdt-comment${
                          optimistic ? ' is-pending' : ''
                        }`}
                        key={c.id}
                      >
                        <span
                          className="st-rdt-comment__avatar"
                          aria-hidden="true"
                        >
                          <TwentyAvatar name={author} size="xs" shape="round" />
                        </span>
                        <div className="st-rdt-comment__main">
                          <div className="st-rdt-comment__head">
                            <span className="st-rdt-comment__author">
                              {author}
                            </span>
                            <time
                              className="st-rdt-comment__time"
                              dateTime={c.createdAt}
                            >
                              {optimistic ? 'Sending…' : relTime(c.createdAt)}
                            </time>
                          </div>
                          <p className="st-rdt-comment__body">{c.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="st-rdt-thread__empty">No comments yet.</div>
              )}

              {error ? (
                <div className="st-rdt-thread__error" role="alert">
                  {error}
                </div>
              ) : null}

              <form
                className="st-rdt-addform"
                onSubmit={(e) => {
                  e.preventDefault();
                  void post();
                }}
              >
                <input
                  className="st-rdt-addform__input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a comment…"
                  aria-label="Add a comment"
                  disabled={posting}
                />
                <button
                  type="submit"
                  className="st-rdt-addform__send"
                  disabled={posting || !draft.trim()}
                  aria-label="Post comment"
                  title="Post comment"
                >
                  {posting ? (
                    <Loader2 size={12} className="st-spin" />
                  ) : (
                    <CornerDownLeft size={12} />
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================================
   Quick NOTE composer (Timeline / Notes tabs)
   ========================================================================= */

interface QuickComposerProps {
  /** Activity kind this composer posts. */
  kind: 'NOTE' | 'TASK';
  placeholder: string;
  busyLabel: string;
  onAdd: (
    title: string,
    body: string,
    attachments: SabcrmAttachment[],
  ) => Promise<boolean>;
}

/**
 * A minimal Twenty-style composer: a title input, an optional body textarea, a
 * SabFiles attach control (per project policy — pick from the library or upload
 * fresh, never a raw URL) and an Add button. Posts through the parent's `onAdd`
 * (which wraps `createSabcrmActivityTw`); clears on success, surfaces an inline
 * error on failure.
 */
function QuickComposer({
  kind,
  placeholder,
  busyLabel,
  onAdd,
}: QuickComposerProps): React.JSX.Element {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [attachments, setAttachments] = React.useState<SabcrmAttachment[]>([]);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = React.useCallback(async () => {
    if (saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    const ok = await onAdd(title.trim(), body.trim(), attachments);
    setSaving(false);
    if (ok) {
      setTitle('');
      setBody('');
      setAttachments([]);
      setOpen(false);
    } else {
      setError(`Could not add ${kind.toLowerCase()}.`);
    }
  }, [saving, title, body, attachments, onAdd, kind]);

  const addPick = React.useCallback((pick: SabFilePick) => {
    setOpen(true);
    setAttachments((prev) =>
      prev.some((a) => a.fileId === pick.id)
        ? prev
        : [...prev, pickToAttachment(pick)],
    );
  }, []);

  const removeAttachment = React.useCallback((fileId: string) => {
    setAttachments((prev) => prev.filter((a) => a.fileId !== fileId));
  }, []);

  return (
    <form
      className="st-rdt-composer"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        className="st-rdt-composer__title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label={`${kind} title`}
        disabled={saving}
      />
      {open ? (
        <textarea
          className="st-rdt-composer__body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Add details (optional)…"
          aria-label={`${kind} body`}
          disabled={saving}
        />
      ) : null}
      {attachments.length > 0 ? (
        <div className="st-rdt-files st-rdt-composer__files">
          {attachments.map((att) => (
            <span className="st-rdt-file" key={att.fileId} title={att.name}>
              <FileText
                className="st-rdt-file__icon"
                size={12}
                aria-hidden="true"
              />
              <span className="st-rdt-file__name">{att.name}</span>
              <button
                type="button"
                className="st-rdt-file__remove"
                onClick={() => removeAttachment(att.fileId)}
                aria-label={`Remove ${att.name}`}
                title="Remove"
                disabled={saving}
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="st-rdt-composer__footer">
        {error ? (
          <span className="st-rdt-composer__error">{error}</span>
        ) : (
          <span className="st-rdt-composer__hint" aria-hidden="true">
            {open ? '⌘↵ to add' : ''}
          </span>
        )}
        <SabFilePickerButton
          variant="ghost"
          className="st-rdt-composer__attach"
          onPick={addPick}
        >
          <Paperclip size={13} aria-hidden="true" />
          Attach
        </SabFilePickerButton>
        <button
          type="submit"
          className="st-rdt-composer__add"
          disabled={saving || !title.trim()}
        >
          {saving ? (
            <Loader2 size={13} className="st-spin" />
          ) : (
            <Plus size={13} aria-hidden="true" />
          )}
          {saving ? busyLabel : 'Add'}
        </button>
      </div>
    </form>
  );
}

/* =========================================================================
   Timeline tab
   ========================================================================= */

interface TimelineTabProps {
  object: ObjectMetadata;
  recordId: string;
  projectId?: string;
}

function TimelineTab({
  object,
  recordId,
  projectId,
}: TimelineTabProps): React.JSX.Element {
  const [items, setItems] = React.useState<SabcrmRustActivity[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listSabcrmActivitiesTw(
      object.slug,
      recordId,
      {},
      projectId,
    );
    if (res.ok) {
      setItems(res.data);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [object.slug, recordId, projectId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const addNote = React.useCallback(
    async (
      title: string,
      body: string,
      attachments: SabcrmAttachment[],
    ): Promise<boolean> => {
      const res = await createSabcrmActivityTw(
        {
          targetObject: object.slug,
          targetRecordId: recordId,
          type: 'NOTE',
          title,
          body: body || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        projectId,
      );
      if (res.ok) {
        setItems((prev) => [res.data, ...(prev ?? [])]);
        return true;
      }
      return false;
    },
    [object.slug, recordId, projectId],
  );

  return (
    <div className="st-rdt-panel">
      <QuickComposer
        kind="NOTE"
        placeholder="Log a note…"
        busyLabel="Adding…"
        onAdd={addNote}
      />
      {loading ? (
        <LoadingState label="Loading timeline…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !items || items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          hint="Notes, tasks and events on this record will appear here."
        />
      ) : (
        <ol className="st-rdt-timeline">
          {items.map((a) => {
            const Icon = iconForType(a.type);
            const atts = activityAttachments(a);
            return (
              <li className="st-rdt-timeline__item" key={a.id}>
                <div className="st-rdt-timeline__rail">
                  <span className="st-rdt-timeline__dot" aria-hidden="true">
                    <Icon size={12} />
                  </span>
                </div>
                <div className="st-rdt-timeline__content">
                  <div className="st-rdt-timeline__head">
                    <span className="st-rdt-timeline__title">{a.title}</span>
                    <time
                      className="st-rdt-timeline__time"
                      dateTime={a.createdAt}
                    >
                      {relTime(a.createdAt)}
                    </time>
                  </div>
                  {a.body ? (
                    <p className="st-rdt-timeline__body">{a.body}</p>
                  ) : null}
                  {a.authorId ? (
                    <span className="st-rdt-timeline__author">
                      <TwentyAvatar
                        name={authorLabel(a.authorId)}
                        size="xs"
                        shape="round"
                      />
                      {authorLabel(a.authorId)}
                    </span>
                  ) : null}
                  {atts.length > 0 ? (
                    <div className="st-rdt-files">
                      {atts.map((att) => (
                        <AttachmentChip key={att.fileId} attachment={att} />
                      ))}
                    </div>
                  ) : null}
                  <CommentThread activityId={a.id} projectId={projectId} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* =========================================================================
   Notes tab (NOTE-kind activities)
   ========================================================================= */

function NotesTab({
  object,
  recordId,
  projectId,
}: TimelineTabProps): React.JSX.Element {
  const [items, setItems] = React.useState<SabcrmRustActivity[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listSabcrmActivitiesTw(
      object.slug,
      recordId,
      { type: 'NOTE' },
      projectId,
    );
    if (res.ok) {
      setItems(res.data);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [object.slug, recordId, projectId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const addNote = React.useCallback(
    async (
      title: string,
      body: string,
      attachments: SabcrmAttachment[],
    ): Promise<boolean> => {
      const res = await createSabcrmActivityTw(
        {
          targetObject: object.slug,
          targetRecordId: recordId,
          type: 'NOTE',
          title,
          body: body || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        projectId,
      );
      if (res.ok) {
        setItems((prev) => [res.data, ...(prev ?? [])]);
        return true;
      }
      return false;
    },
    [object.slug, recordId, projectId],
  );

  return (
    <div className="st-rdt-panel">
      <QuickComposer
        kind="NOTE"
        placeholder="Write a note…"
        busyLabel="Adding…"
        onAdd={addNote}
      />
      {loading ? (
        <LoadingState label="Loading notes…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !items || items.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes yet"
          hint="Capture context, meeting recaps and reminders here."
        />
      ) : (
        <ul className="st-rdt-notes">
          {items.map((a) => {
            const atts = activityAttachments(a);
            return (
              <li className="st-rdt-note" key={a.id}>
                <div className="st-rdt-note__head">
                  <StickyNote
                    size={13}
                    className="st-rdt-note__icon"
                    aria-hidden="true"
                  />
                  <span className="st-rdt-note__title">{a.title}</span>
                  <time className="st-rdt-note__time" dateTime={a.createdAt}>
                    {relTime(a.createdAt)}
                  </time>
                </div>
                {a.body ? <p className="st-rdt-note__body">{a.body}</p> : null}
                {atts.length > 0 ? (
                  <div className="st-rdt-files">
                    {atts.map((att) => (
                      <AttachmentChip key={att.fileId} attachment={att} />
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* =========================================================================
   Tasks tab (TASK-kind activities)
   ========================================================================= */

function TasksTab({
  object,
  recordId,
  projectId,
}: TimelineTabProps): React.JSX.Element {
  const [items, setItems] = React.useState<SabcrmRustActivity[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listSabcrmActivitiesTw(
      object.slug,
      recordId,
      { type: 'TASK' },
      projectId,
    );
    if (res.ok) {
      setItems(res.data);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [object.slug, recordId, projectId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const addTask = React.useCallback(
    async (
      title: string,
      body: string,
      attachments: SabcrmAttachment[],
    ): Promise<boolean> => {
      const res = await createSabcrmActivityTw(
        {
          targetObject: object.slug,
          targetRecordId: recordId,
          type: 'TASK',
          title,
          body: body || undefined,
          status: 'TODO',
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        projectId,
      );
      if (res.ok) {
        setItems((prev) => [res.data, ...(prev ?? [])]);
        return true;
      }
      return false;
    },
    [object.slug, recordId, projectId],
  );

  return (
    <div className="st-rdt-panel">
      <QuickComposer
        kind="TASK"
        placeholder="Add a task…"
        busyLabel="Adding…"
        onAdd={addTask}
      />
      {loading ? (
        <LoadingState label="Loading tasks…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !items || items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No tasks yet"
          hint="Track follow-ups and to-dos for this record here."
        />
      ) : (
        <ul className="st-rdt-tasks">
          {items.map((a) => {
            const done = isTaskDone(a);
            const due = a.dueAt ? formatDue(a.dueAt) : null;
            return (
              <li
                className={`st-rdt-task${done ? ' is-done' : ''}`}
                key={a.id}
              >
                <span className="st-rdt-task__check" aria-hidden="true">
                  {done ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <Circle size={15} />
                  )}
                </span>
                <div className="st-rdt-task__content">
                  <span className="st-rdt-task__title">{a.title}</span>
                  <div className="st-rdt-task__meta">
                    <span
                      className={`st-rdt-task__status st-rdt-task__status--${(
                        a.status ?? 'TODO'
                      ).toLowerCase()}`}
                    >
                      {(a.status ?? 'TODO').replace(/_/g, ' ')}
                    </span>
                    {due ? (
                      <span className="st-rdt-task__due">
                        <CalendarClock size={11} aria-hidden="true" />
                        {due}
                      </span>
                    ) : null}
                    <time className="st-rdt-task__time" dateTime={a.createdAt}>
                      {relTime(a.createdAt)}
                    </time>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* =========================================================================
   Relations tab — grouped per RELATION field
   ========================================================================= */

interface RelationsTabProps {
  object: ObjectMetadata;
  recordId: string;
  projectId?: string;
}

/** One related record row, linking to its own Twenty detail page. */
function RelatedRecordRow({
  targetObject,
  record,
}: {
  targetObject: string;
  record: SabcrmRustRecord;
}): React.JSX.Element {
  const label = relationRecordLabel(record);
  return (
    <Link
      className="st-rdt-rel__row"
      href={`/sabcrm/${targetObject}/${record.id}`}
    >
      <TwentyAvatar name={label} size="xs" shape="round" />
      <span className="st-rdt-rel__row-label">{label}</span>
      <ChevronRight
        size={13}
        className="st-rdt-rel__row-chev"
        aria-hidden="true"
      />
    </Link>
  );
}

function RelationsTab({
  object,
  recordId,
  projectId,
}: RelationsTabProps): React.JSX.Element {
  const { data, loading, error, reload } = useLazyData<RecordRelation[]>(
    true,
    React.useCallback(
      () => getRecordRelationsTw(object.slug, recordId, projectId),
      [object.slug, recordId, projectId],
    ),
  );

  if (loading) return <LoadingState label="Loading relations…" />;
  if (error)
    return (
      <div className="st-rdt-panel">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );

  const groups = (data ?? []).filter((r) => r.records.length > 0);

  if (groups.length === 0) {
    return (
      <div className="st-rdt-panel">
        <EmptyState
          icon={Link2}
          title="No related records"
          hint="Records linked to this one through relation fields will show here."
        />
      </div>
    );
  }

  return (
    <div className="st-rdt-panel st-rdt-relations">
      {groups.map((relation) => {
        const Icon = SLUG_ICON[relation.targetObject] ?? Link2;
        return (
          <section className="st-rdt-rel" key={relation.field}>
            <header className="st-rdt-rel__head">
              <Icon size={13} aria-hidden="true" />
              <span className="st-rdt-rel__label">{relation.label}</span>
              <span className="st-rdt-rel__count">{relation.records.length}</span>
            </header>
            <div className="st-rdt-rel__list">
              {relation.records.map((rec) => (
                <RelatedRecordRow
                  key={rec.id}
                  targetObject={relation.targetObject}
                  record={rec}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* =========================================================================
   Files tab — attachments gathered off the record's activities
   ========================================================================= */

function FilesTab({
  object,
  recordId,
  projectId,
}: TimelineTabProps): React.JSX.Element {
  const [items, setItems] = React.useState<SabcrmRustActivity[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listSabcrmActivitiesTw(
      object.slug,
      recordId,
      {},
      projectId,
    );
    if (res.ok) {
      setItems(res.data);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [object.slug, recordId, projectId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Uploading a file = create a NOTE activity that carries the SabFiles ref
  // (the engine's only file write path). The picker sources from the user's
  // library or a fresh upload — never a raw URL, per project policy.
  const attachFile = React.useCallback(
    async (pick: SabFilePick) => {
      setUploadError(null);
      const res = await createSabcrmActivityTw(
        {
          targetObject: object.slug,
          targetRecordId: recordId,
          type: 'NOTE',
          title: pick.name,
          attachments: [pickToAttachment(pick)],
        },
        projectId,
      );
      if (res.ok) {
        setItems((prev) => [res.data, ...(prev ?? [])]);
      } else {
        setUploadError('Could not attach file.');
      }
    },
    [object.slug, recordId, projectId],
  );

  const header = (
    <div className="st-rdt-files__bar">
      <SabFilePickerButton
        variant="outline"
        className="st-rdt-files__upload"
        onPick={(pick) => void attachFile(pick)}
      >
        <Paperclip size={13} aria-hidden="true" />
        Attach files
      </SabFilePickerButton>
      {uploadError ? (
        <span className="st-rdt-composer__error">{uploadError}</span>
      ) : null}
    </div>
  );

  if (loading) return <LoadingState label="Loading files…" />;
  if (error)
    return (
      <div className="st-rdt-panel">
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );

  const groups = (items ?? [])
    .map((a) => ({ activity: a, attachments: activityAttachments(a) }))
    .filter((g) => g.attachments.length > 0);

  if (groups.length === 0) {
    return (
      <div className="st-rdt-panel st-rdt-filespanel">
        {header}
        <EmptyState
          icon={Paperclip}
          title="No files yet"
          hint="Attach a file, or files added to this record's notes and activities show up here."
        />
      </div>
    );
  }

  return (
    <div className="st-rdt-panel st-rdt-filespanel">
      {header}
      {groups.map(({ activity, attachments }) => (
        <div className="st-rdt-filegroup" key={activity.id}>
          <div className="st-rdt-filegroup__head">
            <span className="st-rdt-filegroup__title">{activity.title}</span>
            <time
              className="st-rdt-filegroup__time"
              dateTime={activity.createdAt}
            >
              {relTime(activity.createdAt)}
            </time>
          </div>
          <div className="st-rdt-files">
            {attachments.map((att) => (
              <AttachmentChip key={att.fileId} attachment={att} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================================
   Emails tab — honest coming-soon state (SabCRM has no email backend)
   ========================================================================= */

/**
 * The Emails tab. Twenty syncs an email account and shows the conversation
 * thread here; SabCRM has no email backend, so this is an honest, Twenty-styled
 * coming-soon state rather than a fake inbox. No data is fetched.
 */
function EmailsTab(): React.JSX.Element {
  return (
    <div className="st-rdt-panel">
      <div className="st-rdt-empty">
        <span className="st-rdt-empty__icon" aria-hidden="true">
          <Mail size={18} />
        </span>
        <span className="st-rdt-empty__title">No email account connected</span>
        <span className="st-rdt-empty__hint">
          Connect an email account to sync conversations with this record. Email
          sync isn&apos;t available yet.
        </span>
        <span className="st-rdt-soon">
          <Mail size={12} aria-hidden="true" />
          Coming soon
        </span>
      </div>
    </div>
  );
}

/* =========================================================================
   RecordDetailTabs — the public component
   ========================================================================= */

/**
 * The tabbed main panel of a Twenty record-show page. Each tab lazily fetches
 * its data on first open through the existing gated actions; the active tab is
 * mounted (so it loads) while inactive tabs unmount. Defaults to the Timeline.
 */
export function RecordDetailTabs({
  object,
  recordId,
  projectId,
}: RecordDetailTabsProps): React.JSX.Element {
  const [active, setActive] = React.useState<TabKey>('timeline');
  // Track which tabs have been opened so each loads lazily exactly once and
  // keeps its mounted state cached while the user flips between tabs.
  const [opened, setOpened] = React.useState<Set<TabKey>>(
    () => new Set<TabKey>(['timeline']),
  );

  const select = React.useCallback((key: TabKey) => {
    setActive(key);
    setOpened((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="sabcrm-twenty st-rdt" data-active-tab={active}>
      <div className="st-rdt-tabs" role="tablist" aria-label="Record sections">
        {TAB_DEFS.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`st-rdt-tab${isActive ? ' is-active' : ''}`}
              onClick={() => select(key)}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="st-rdt-body" role="tabpanel">
        {/* Each tab mounts only after first open; the active one is shown. The
            others stay mounted (cached) but hidden so re-selecting is instant. */}
        {opened.has('timeline') ? (
          <div hidden={active !== 'timeline'}>
            <TimelineTab
              object={object}
              recordId={recordId}
              projectId={projectId}
            />
          </div>
        ) : null}
        {opened.has('notes') ? (
          <div hidden={active !== 'notes'}>
            <NotesTab
              object={object}
              recordId={recordId}
              projectId={projectId}
            />
          </div>
        ) : null}
        {opened.has('tasks') ? (
          <div hidden={active !== 'tasks'}>
            <TasksTab
              object={object}
              recordId={recordId}
              projectId={projectId}
            />
          </div>
        ) : null}
        {opened.has('relations') ? (
          <div hidden={active !== 'relations'}>
            <RelationsTab
              object={object}
              recordId={recordId}
              projectId={projectId}
            />
          </div>
        ) : null}
        {opened.has('files') ? (
          <div hidden={active !== 'files'}>
            <FilesTab
              object={object}
              recordId={recordId}
              projectId={projectId}
            />
          </div>
        ) : null}
        {opened.has('emails') ? (
          <div hidden={active !== 'emails'}>
            <EmailsTab />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default RecordDetailTabs;
