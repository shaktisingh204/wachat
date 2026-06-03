'use client';

/**
 * SabCRM — Twenty-faithful record DETAIL (client runtime).
 *
 * Renders one record in Twenty's record-page layout (NO ZoruUI; `.st-*` /
 * `.rt-*` classes + the twenty kit only):
 *   - a header with the object icon + the record's label value + favorite star,
 *   - a back link to the index,
 *   - a left/main panel: the field list as label→value rows, each value inline-
 *     editable and persisted through `updateSabcrmRecordTw` (optimistic),
 *   - a right rail with a Twenty tab strip (Fields / Notes / Tasks / Activity):
 *       · Fields   — compact read-only summary of the same record fields,
 *       · Notes    — NOTE-kind activities + a note composer,
 *       · Tasks    — TASK-kind activities (status chip, due) + add-task composer,
 *                    status toggled via `updateSabcrmActivityTw`,
 *       · Activity — the full TwentyTimeline + the multi-kind composer.
 *   - a Relations area below the grid: one Twenty "relation section" per related
 *     object returned by `getRecordRelationsTw`, each a compact list of related
 *     records linking to their own detail pages.
 *
 * The server page hands in already-gated initial data. Edits call the gated
 * action; a failure rolls the value back and shows an inline error banner. Every
 * async load (timeline, favorites, relations) degrades gracefully — the Rust
 * engine may be down, so this never crashes (empty / muted states instead).
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  AlertTriangle,
  Building2,
  Users,
  Briefcase,
  StickyNote,
  CheckCircle2,
  Circle,
  Database,
  Star,
  Plus,
  Loader2,
  CalendarClock,
  ChevronRight,
  Link2,
  Activity,
  Paperclip,
  FileText,
  MoreHorizontal,
  Trash2,
  X,
  Search,
  MessageSquare,
  ChevronDown,
  CornerDownLeft,
  Mail,
  Inbox,
  ListChecks,
  Tag as TagIcon,
  Check,
  Printer,
  type LucideIcon,
} from 'lucide-react';

import {
  SabFilePicker,
  type SabFilePick,
} from '@/components/sabfiles';
import { TwentyChip } from '@/components/sabcrm/twenty/twenty-primitives';
import { TwentyFieldValue } from '@/components/sabcrm/twenty/twenty-field';
import { TwentyTimeline } from '@/components/sabcrm/twenty/twenty-timeline';
import '@/components/sabcrm/twenty/twenty-activity.css';
import {
  updateSabcrmRecordTw,
  deleteSabcrmRecordTw,
  listSabcrmActivitiesTw,
  createSabcrmActivityTw,
  updateSabcrmActivityTw,
  listSabcrmFavoritesTw,
  addSabcrmFavoriteTw,
  removeSabcrmFavoriteTw,
  // In-flight: added in parallel by another agent. If tsc flags ONLY this
  // import as missing during the port, that's the expected interim state.
  getRecordRelationsTw,
  listSabcrmObjectsTw,
  // In-flight: the per-activity comment-thread actions are added in parallel by
  // another agent. If tsc flags ONLY these imports as missing during the port,
  // that's the expected interim state — the rest of this file stays clean.
  listActivityCommentsTw,
  addActivityCommentTw,
  deleteActivityCommentTw,
} from '@/app/actions/sabcrm-twenty.actions';
import { listTagsTw } from '@/app/actions/sabcrm-tags.actions';
import { searchRecordsForPickerAction } from '@/app/actions/sabcrm.actions';
import type { SabcrmPickerOption } from '@/app/actions/sabcrm.actions.types';
import type {
  SabcrmRustRecord,
  SabcrmRustActivity,
  SabcrmActivityKind,
  RecordRelation,
  // In-flight: `SabcrmAttachment` is added in parallel by another agent. If
  // tsc flags ONLY this member as missing during the port, that's the
  // expected interim state — the rest of this file stays clean.
  SabcrmAttachment,
} from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';

import {
  RichTextEditor,
  RichTextView,
  isRichTextEmpty,
} from './rich-text-editor';

import './record-tabs.css';
import './attachments.css';
import './detail-polish.css';
import './relations-edit.css';
import './comments.css';
import './rich-text.css';
import './show-widgets.css';
import './detail-tags.css';

/** Map a known object slug to a Twenty sidebar icon (best-effort). */
const SLUG_ICON: Record<string, LucideIcon> = {
  companies: Building2,
  people: Users,
  opportunities: Briefcase,
  notes: StickyNote,
  tasks: CheckCircle2,
};

const INLINE_EDITABLE: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['TEXT', 'EMAIL', 'PHONE', 'LINK', 'NUMBER', 'CURRENCY', 'RATING', 'SELECT']);

function recordLabel(object: ObjectMetadata, record: SabcrmRustRecord): string {
  const field =
    object.fields.find((f) => f.isLabel) ??
    object.fields.find((f) => f.type === 'TEXT' || f.type === 'EMAIL') ??
    object.fields[0];
  if (field) {
    const raw = record.data[field.key];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  }
  return `${object.labelSingular} ${record.id.slice(-6)}`;
}

function coerceInput(field: FieldMetadata, raw: string): unknown {
  if (raw === '') return '';
  if (field.type === 'NUMBER' || field.type === 'CURRENCY' || field.type === 'RATING') {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Activity timeline helpers
// ---------------------------------------------------------------------------

/** The activity kinds the composer offers. */
const ACTIVITY_KINDS: readonly { value: SabcrmActivityKind; label: string }[] = [
  { value: 'NOTE', label: 'Note' },
  { value: 'TASK', label: 'Task' },
  { value: 'CALL', label: 'Call' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'EMAIL', label: 'Email' },
] as const;

/** True when a TASK activity is in its completed state. */
function isTaskDone(a: SabcrmRustActivity): boolean {
  return (a.status ?? '').toUpperCase() === 'DONE';
}

/** Compact relative time for note/task heads ("5m ago", else a short date). */
function relTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const MIN = 60_000;
  const HR = 60 * MIN;
  const DAY = 24 * HR;
  if (diff < MIN) return 'just now';
  if (diff < HR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Humanize a due date for the task meta row. */
function formatDue(value: string): string | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Attachments (SabFiles-backed)
// ---------------------------------------------------------------------------

/** Map a chosen SabFiles pick to the action's attachment shape. */
function pickToAttachment(pick: SabFilePick): SabcrmAttachment {
  return {
    fileId: pick.id,
    name: pick.name,
    contentType: pick.mime,
    size: pick.size,
    url: pick.url,
  };
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

/**
 * Read attachments off a raw engine activity. The TS `SabcrmRustActivity`
 * type may not declare `attachments` yet (the engine field is added in
 * parallel), so we access it defensively and tolerate a missing/empty list.
 */
function activityAttachments(a: SabcrmRustActivity): SabcrmAttachment[] {
  const raw = (a as { attachments?: unknown }).attachments;
  return Array.isArray(raw) ? (raw as SabcrmAttachment[]) : [];
}

/** A single Twenty-style file chip; links to `url` (new tab) when present. */
function AttachmentChip({ attachment }: { attachment: SabcrmAttachment }) {
  const size = fmtBytes(attachment.size);
  return (
    <span className="sa-chip" title={attachment.name}>
      <FileText className="sa-chip__icon" size={12} aria-hidden="true" />
      {attachment.url ? (
        <a
          className="sa-chip__name"
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {attachment.name}
        </a>
      ) : (
        <span className="sa-chip__name">{attachment.name}</span>
      )}
      {size ? <span className="sa-chip__size">{size}</span> : null}
    </span>
  );
}

/** Read-only chip row for already-posted attachments (timeline / notes). */
function AttachmentList({
  attachments,
}: {
  attachments: SabcrmAttachment[];
}): React.JSX.Element | null {
  if (!attachments.length) return null;
  return (
    <div className="sa-attachments">
      {attachments.map((att) => (
        <AttachmentChip key={att.fileId} attachment={att} />
      ))}
    </div>
  );
}

/**
 * "Attach" control + pending-chip list for a composer. The trigger is
 * Twenty-styled; the picker modal itself is the SabFiles `<SabFilePicker>`
 * (Library + Upload). Each pick becomes a removable pending chip.
 */
interface AttachControlProps {
  attachments: SabcrmAttachment[];
  onAdd: (attachment: SabcrmAttachment) => void;
  onRemove: (fileId: string) => void;
  disabled?: boolean;
}

function AttachControl({
  attachments,
  onAdd,
  onRemove,
  disabled,
}: AttachControlProps): React.JSX.Element {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        className="sa-attach-btn"
        onClick={() => setPickerOpen(true)}
        disabled={disabled}
      >
        <Paperclip size={13} aria-hidden="true" />
        Attach
      </button>
      {attachments.length > 0 && (
        <div className="sa-chips">
          {attachments.map((att) => (
            <span className="sa-chip" key={att.fileId} title={att.name}>
              <FileText className="sa-chip__icon" size={12} aria-hidden="true" />
              <span className="sa-chip__name">{att.name}</span>
              <button
                type="button"
                className="sa-chip__remove"
                onClick={() => onRemove(att.fileId)}
                aria-label={`Remove ${att.name}`}
                title="Remove attachment"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <SabFilePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Attach a file"
        onPick={(pick) => {
          onAdd(pickToAttachment(pick));
          setPickerOpen(false);
        }}
      />
    </>
  );
}

/**
 * Twenty-style activity timeline that also renders each entry's attachments.
 * Mirrors the shared `.st-timeline` markup (the closed `TwentyTimeline` kit
 * exposes no per-item slot) so attachment chips can hang under each item.
 */
const TIMELINE_TYPE_ICON: Record<string, LucideIcon> = {
  NOTE: StickyNote,
  TASK: CheckCircle2,
  CALL: Activity,
  MEETING: CalendarClock,
  EMAIL: Activity,
};

// ---------------------------------------------------------------------------
// Comment threads (per activity)
// ---------------------------------------------------------------------------

/**
 * Local shape for a comment returned by the in-flight `*ActivityComment*`
 * actions: `{ id, body, authorId, createdAt }`. Declared here (rather than
 * imported) because the action types are being added in parallel — once they
 * land, the real exported type takes over and this stays structurally compatible.
 */
interface ActivityComment {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
}

/** Stable client-side id for an optimistic (not-yet-persisted) comment. */
let optimisticCommentSeq = 0;
function nextOptimisticId(): string {
  optimisticCommentSeq += 1;
  return `optimistic-${Date.now()}-${optimisticCommentSeq}`;
}

interface CommentThreadProps {
  activityId: string;
  /**
   * The viewer's author id once known (captured from the first comment they
   * successfully post). When a comment's `authorId` matches, its delete (x)
   * affordance is shown. Lifted to the timeline so it's shared across threads.
   */
  currentAuthorId: string | null;
  /** Called with the viewer's author id the first time we learn it. */
  onLearnAuthor: (authorId: string) => void;
}

/**
 * An expandable comment thread that hangs under one timeline item. Collapsed by
 * default, showing only a count + toggle; expanding lazily loads the activity's
 * comments via `listActivityCommentsTw`. Posting (`addActivityCommentTw`) is
 * optimistic — the comment is prepended immediately and reconciled with the
 * server's row, rolling back on failure. Deleting (`deleteActivityCommentTw`)
 * is offered only for the viewer's own comments and is likewise optimistic.
 */
function CommentThread({
  activityId,
  currentAuthorId,
  onLearnAuthor,
}: CommentThreadProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [comments, setComments] = React.useState<ActivityComment[]>([]);
  const [draft, setDraft] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = React.useState<string | null>(null);

  // Lazy-load the thread the first time it's expanded (graceful on failure).
  React.useEffect(() => {
    if (!open || loaded || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await listActivityCommentsTw(activityId);
      if (cancelled) return;
      if (res.ok) {
        setComments(res.data as ActivityComment[]);
        setLoaded(true);
      } else {
        setError(res.error);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded, loading, activityId]);

  const post = React.useCallback(async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    setError(null);

    // Optimistic: prepend a placeholder, clear the input immediately.
    const tempId = nextOptimisticId();
    const optimistic: ActivityComment = {
      id: tempId,
      body,
      authorId: currentAuthorId ?? '',
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [optimistic, ...prev]);
    setDraft('');

    const res = await addActivityCommentTw(activityId, body);
    setPosting(false);
    if (res.ok) {
      const saved = res.data as ActivityComment;
      // Reconcile the placeholder with the persisted row.
      setComments((prev) => prev.map((c) => (c.id === tempId ? saved : c)));
      // Learn the viewer's identity from their own freshly-posted comment.
      if (saved.authorId) onLearnAuthor(saved.authorId);
    } else {
      // Roll back the optimistic row; restore the draft so it isn't lost.
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setDraft(body);
      setError(res.error);
    }
  }, [draft, posting, activityId, currentAuthorId, onLearnAuthor]);

  const remove = React.useCallback(
    async (commentId: string) => {
      if (busyDeleteId) return;
      setBusyDeleteId(commentId);
      setError(null);
      const prev = comments;
      // Optimistically drop the row.
      setComments((cs) => cs.filter((c) => c.id !== commentId));
      const res = await deleteActivityCommentTw(activityId, commentId);
      if (!res.ok) {
        setComments(prev); // roll back
        setError(res.error);
      }
      setBusyDeleteId(null);
    },
    [busyDeleteId, comments, activityId],
  );

  // Collapsed count reflects what we know: loaded length, else a hint to open.
  const count = comments.length;

  return (
    <div className="sc-thread">
      <button
        type="button"
        className={`sc-thread__toggle${open ? ' is-open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MessageSquare size={12} aria-hidden="true" />
        <span className="sc-thread__toggle-label">
          {count > 0
            ? `${count} ${count === 1 ? 'comment' : 'comments'}`
            : 'Comment'}
        </span>
        <ChevronDown
          size={12}
          className="sc-thread__chev"
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="sc-thread__panel">
          {loading ? (
            <div className="sc-thread__state">
              <Loader2 size={12} className="st-spin" aria-hidden="true" />
              Loading comments…
            </div>
          ) : (
            <>
              {comments.length > 0 ? (
                <ul className="sc-comments">
                  {comments.map((c) => {
                    const own =
                      currentAuthorId != null &&
                      c.authorId === currentAuthorId;
                    const optimistic = c.id.startsWith('optimistic-');
                    return (
                      <li
                        className={`sc-comment${optimistic ? ' is-pending' : ''}`}
                        key={c.id}
                      >
                        <div className="sc-comment__head">
                          <span className="sc-comment__author">
                            {c.authorId || 'Unknown'}
                          </span>
                          <time
                            className="sc-comment__time"
                            dateTime={c.createdAt}
                          >
                            {relTime(c.createdAt)}
                          </time>
                          {own && !optimistic ? (
                            <button
                              type="button"
                              className="sc-comment__del"
                              onClick={() => void remove(c.id)}
                              disabled={busyDeleteId === c.id}
                              aria-label="Delete comment"
                              title="Delete comment"
                            >
                              {busyDeleteId === c.id ? (
                                <Loader2 size={11} className="st-spin" />
                              ) : (
                                <X size={11} />
                              )}
                            </button>
                          ) : null}
                        </div>
                        <p className="sc-comment__body">{c.body}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="sc-thread__empty">No comments yet.</div>
              )}

              {error ? (
                <div className="sc-thread__error" role="alert">
                  {error}
                </div>
              ) : null}

              <form
                className="sc-addform"
                onSubmit={(e) => {
                  e.preventDefault();
                  void post();
                }}
              >
                <input
                  className="sc-addform__input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a comment…"
                  aria-label="Add a comment"
                  disabled={posting}
                />
                <button
                  type="submit"
                  className="sc-addform__send"
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

interface AttachmentTimelineProps {
  activities: SabcrmRustActivity[];
  loading: boolean;
  emptyLabel: string;
  /** Shared viewer author id (for own-comment delete affordances). */
  currentAuthorId: string | null;
  /** Bubble up the viewer's author id once it's learned from a posted comment. */
  onLearnAuthor: (authorId: string) => void;
}

function AttachmentTimeline({
  activities,
  loading,
  emptyLabel,
  currentAuthorId,
  onLearnAuthor,
}: AttachmentTimelineProps): React.JSX.Element {
  if (loading) {
    return <TwentyTimeline activities={[]} loading emptyLabel="" />;
  }
  if (!activities.length) {
    return <div className="st-timeline-empty">{emptyLabel}</div>;
  }
  return (
    <ol className="st-timeline">
      {activities.map((a) => {
        const Icon = TIMELINE_TYPE_ICON[a.type.toUpperCase()] ?? Activity;
        const atts = activityAttachments(a);
        return (
          <li className="st-timeline__item" key={a.id}>
            <div className="st-timeline__rail">
              <span className="st-timeline__dot" aria-hidden="true">
                <Icon size={12} />
              </span>
            </div>
            <div className="st-timeline__content">
              <div className="st-timeline__head">
                <span className="st-timeline__title">{a.title}</span>
                <time className="st-timeline__time" dateTime={a.createdAt}>
                  {relTime(a.createdAt)}
                </time>
              </div>
              {a.body ? (
                <RichTextView body={a.body} className="st-timeline__body" />
              ) : null}
              {a.authorId ? (
                <span className="st-timeline__author">{a.authorId}</span>
              ) : null}
              <AttachmentList attachments={atts} />
              <CommentThread
                activityId={a.id}
                currentAuthorId={currentAuthorId}
                onLearnAuthor={onLearnAuthor}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Best-effort label for a related record when only its raw `data` bag (no full
 * target-object metadata) is available: prefer a `labelField`, then common label
 * keys, then a short id suffix.
 */
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
  // Compose a name from first/last if present.
  const first = data.firstName;
  const last = data.lastName;
  if (typeof first === 'string' || typeof last === 'string') {
    const composed = [first, last].filter(Boolean).join(' ').trim();
    if (composed) return composed;
  }
  return `#${record.id.slice(-6)}`;
}

/**
 * For a ONE_TO_MANY relation, resolve the inverse field key on the target
 * object: its MANY_TO_ONE RELATION field that points back at `sourceSlug`.
 * That key is the one whose value (on a child record) must be set/cleared to
 * attach/detach the child from this record. Returns null when unresolvable
 * (target metadata missing, or no matching inverse field).
 */
function resolveInverseKey(
  target: ObjectMetadata | undefined,
  sourceSlug: string,
): string | null {
  if (!target) return null;
  const inverse = target.fields.find(
    (f) =>
      f.type === 'RELATION' &&
      f.relation?.kind === 'MANY_TO_ONE' &&
      f.relation.targetObject === sourceSlug,
  );
  return inverse ? inverse.key : null;
}

// ---------------------------------------------------------------------------
// Left field panel — labelled sections (Twenty fidelity)
// ---------------------------------------------------------------------------

/**
 * Split the editable field list into Twenty-style labelled groups. "Links"
 * collects URL/email/phone fields; everything else stays under "Details".
 * Sections with no fields are dropped, so a plain object renders one group.
 */
function groupFieldSections(
  fields: FieldMetadata[],
): Array<{ label: string; fields: FieldMetadata[] }> {
  const linkTypes: ReadonlySet<FieldMetadata['type']> = new Set<
    FieldMetadata['type']
  >(['LINK', 'EMAIL', 'PHONE']);
  const links = fields.filter((f) => linkTypes.has(f.type));
  const details = fields.filter((f) => !linkTypes.has(f.type));
  return [
    { label: 'Details', fields: details },
    { label: 'Links', fields: links },
  ].filter((s) => s.fields.length > 0);
}

/**
 * One collapsible labelled section in the left field panel (Twenty page-layout
 * fidelity). The header is a button that toggles `collapsed`; collapse state is
 * owned by the parent so it persists across re-renders / edits within the
 * component's lifetime. Renders the field rows as before when expanded.
 */
interface CollapsibleFieldSectionProps {
  label: string;
  fields: FieldMetadata[];
  collapsed: boolean;
  onToggle: () => void;
  record: SabcrmRustRecord;
  onCommit: (key: string, value: unknown) => void;
}

function CollapsibleFieldSection({
  label,
  fields,
  collapsed,
  onToggle,
  record,
  onCommit,
}: CollapsibleFieldSectionProps): React.JSX.Element {
  return (
    <div
      className={`re-fieldsection sw-section${collapsed ? ' is-collapsed' : ''}`}
      aria-label={label}
    >
      <button
        type="button"
        className="sw-section__head"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <ChevronDown size={13} className="sw-section__caret" aria-hidden="true" />
        <span className="sw-section__label">{label}</span>
        <span className="sw-section__count">{fields.length}</span>
      </button>
      <div className="sw-section__body" hidden={collapsed}>
        {fields.map((field) => (
          <div className="st-field-row" key={field.key}>
            <span className="st-field-row__key">{field.label}</span>
            <span className="st-field-row__val">
              <EditableValue
                field={field}
                value={record.data[field.key]}
                onCommit={(v) => onCommit(field.key, v)}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details-summary card — key fields at a glance (top of the right column)
// ---------------------------------------------------------------------------

/**
 * A compact "details summary" card showing up to a handful of the record's
 * most-meaningful fields read-only, mirroring Twenty's at-a-glance summary
 * widget. Falls back to a muted empty state when there's nothing to show.
 */
function DetailsSummary({
  fields,
  record,
}: {
  fields: FieldMetadata[];
  record: SabcrmRustRecord;
}): React.JSX.Element {
  // Prefer the label field first, then keep document order; cap at 6 so the
  // card stays a glance, not a duplicate of the full field panel.
  const summaryFields = React.useMemo(() => {
    const labelFirst = [...fields].sort((a, b) => {
      const al = a.isLabel ? 0 : 1;
      const bl = b.isLabel ? 0 : 1;
      return al - bl;
    });
    return labelFirst.slice(0, 6);
  }, [fields]);

  return (
    <div className="sw-summary" aria-label="Details summary">
      <div className="sw-summary__head">
        <ListChecks size={13} aria-hidden="true" />
        Summary
      </div>
      {summaryFields.length === 0 ? (
        <div className="sw-summary__empty">No fields to summarize.</div>
      ) : (
        <div className="sw-summary__grid">
          {summaryFields.map((field) => (
            <div className="sw-summary__item" key={field.key}>
              <span className="sw-summary__key">{field.label}</span>
              <span className="sw-summary__val">
                <TwentyFieldValue
                  field={field}
                  value={record.data[field.key]}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Files tab — attachment chips gathered from the record's activities
// ---------------------------------------------------------------------------

interface FilesPanelProps {
  activities: SabcrmRustActivity[];
  loading: boolean;
}

/**
 * The Files tab: walks every activity on the record, gathering those that
 * carry attachments, and renders one chip group per source activity. Honest
 * empty state when nothing's attached. Read-only — files are attached through
 * the composers, not here.
 */
function FilesPanel({ activities, loading }: FilesPanelProps): React.JSX.Element {
  const groups = React.useMemo(
    () =>
      activities
        .map((a) => ({ activity: a, attachments: activityAttachments(a) }))
        .filter((g) => g.attachments.length > 0),
    [activities],
  );

  if (loading) {
    return <TwentyTimeline activities={[]} loading emptyLabel="" />;
  }

  if (groups.length === 0) {
    return (
      <div className="sw-files__empty">
        <span className="sw-files__empty-icon" aria-hidden="true">
          <Paperclip size={16} />
        </span>
        <span className="sw-files__empty-title">No files yet</span>
        <span className="sw-files__empty-hint">
          Files attached to this record&apos;s notes and activities show up here.
        </span>
      </div>
    );
  }

  return (
    <div className="sw-files">
      {groups.map(({ activity, attachments }) => (
        <div className="sw-files__group" key={activity.id}>
          <div className="sw-files__group-head">
            <span className="sw-files__group-title">{activity.title}</span>
            <time className="sw-files__group-time" dateTime={activity.createdAt}>
              {relTime(activity.createdAt)}
            </time>
          </div>
          <div className="sw-files__chips">
            {attachments.map((att) => (
              <AttachmentChip key={att.fileId} attachment={att} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Emails tab — honest read-only empty state (SabCRM has no email sync)
// ---------------------------------------------------------------------------

/**
 * The Emails tab: Twenty syncs an email account and shows the message thread
 * here. SabCRM has no email sync, so this is an honest, Twenty-styled empty
 * state rather than a fake inbox.
 */
function EmailsPanel(): React.JSX.Element {
  return (
    <div className="sw-emails">
      <span className="sw-emails__icon" aria-hidden="true">
        <Inbox size={18} />
      </span>
      <span className="sw-emails__title">No email account connected</span>
      <span className="sw-emails__hint">
        Connect an email account to sync conversations with this record. Email
        sync isn&apos;t available yet.
      </span>
      <span className="sw-emails__badge">
        <Mail size={12} aria-hidden="true" />
        Coming soon
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer — rich-text body (RichTextEditor) + ⌘/Ctrl+Enter to submit
// ---------------------------------------------------------------------------

/** The ⌘/Ctrl+Enter affordance shown in a composer footer. */
function SubmitHint(): React.JSX.Element {
  return (
    <span className="stp-composer__hint" aria-hidden="true">
      <kbd className="stp-kbd">⌘</kbd>
      <kbd className="stp-kbd">↵</kbd>
      to add
    </span>
  );
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

interface ComposerProps {
  onAdd: (
    type: SabcrmActivityKind,
    title: string,
    body: string,
    attachments: SabcrmAttachment[],
  ) => Promise<boolean>;
}

function Composer({ onAdd }: ComposerProps) {
  const [type, setType] = React.useState<SabcrmActivityKind>('NOTE');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [attachments, setAttachments] = React.useState<SabcrmAttachment[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const addAttachment = (att: SabcrmAttachment) =>
    setAttachments((prev) =>
      prev.some((a) => a.fileId === att.fileId) ? prev : [...prev, att],
    );
  const removeAttachment = (fileId: string) =>
    setAttachments((prev) => prev.filter((a) => a.fileId !== fileId));

  const submitForm = React.useCallback(async () => {
    if (saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    // `body` is sanitized HTML from the rich editor; collapse an empty document
    // to '' so blank bodies don't persist stray markup.
    const richBody = isRichTextEmpty(body) ? '' : body;
    const ok = await onAdd(type, title.trim(), richBody, attachments);
    setSaving(false);
    if (ok) {
      setTitle('');
      setBody('');
      setAttachments([]);
    } else {
      setError('Could not add activity.');
    }
  }, [saving, title, body, type, attachments, onAdd]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submitForm();
  };

  return (
    <form className="st-composer" onSubmit={submit}>
      <div className="st-composer__row">
        <select
          className="st-composer__type"
          value={type}
          onChange={(e) => setType(e.target.value as SabcrmActivityKind)}
          aria-label="Activity type"
        >
          {ACTIVITY_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          className="st-composer__title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a title…"
          aria-label="Activity title"
        />
      </div>
      <RichTextEditor
        value={body}
        onChange={setBody}
        onSubmit={submitForm}
        placeholder="Add a note (optional)…"
        ariaLabel="Activity body"
        disabled={saving}
      />
      <div className="st-composer__footer">
        <AttachControl
          attachments={attachments}
          onAdd={addAttachment}
          onRemove={removeAttachment}
          disabled={saving}
        />
        {error ? (
          <span className="st-composer__error">{error}</span>
        ) : (
          <SubmitHint />
        )}
        <button
          type="submit"
          className="st-composer__add"
          disabled={saving || !title.trim()}
        >
          {saving ? <Loader2 size={13} className="st-spin" /> : <Plus size={13} />}
          Add
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Favorite star
// ---------------------------------------------------------------------------

interface StarToggleProps {
  active: boolean;
  busy?: boolean;
  onToggle: () => void;
  className?: string;
}

function StarToggle({ active, busy, onToggle, className }: StarToggleProps) {
  return (
    <button
      type="button"
      className={`st-star${active ? ' active' : ''}${className ? ` ${className}` : ''}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      disabled={busy}
      aria-pressed={active}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      title={active ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star size={15} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Record overflow menu ("...") + confirm-delete dialog
// ---------------------------------------------------------------------------

interface RecordMenuProps {
  onDelete: () => void;
  onPrint: () => void;
}

/** A Twenty "..." overflow menu; surfaces Print + a destructive Delete. */
function RecordMenu({ onDelete, onPrint }: RecordMenuProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  // Dismiss on outside click / Escape while open.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="stp-menu" ref={ref}>
      <button
        type="button"
        className="stp-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Record actions"
        title="Record actions"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div className="stp-menu__pop" role="menu">
          <button
            type="button"
            role="menuitem"
            className="stp-menu__item"
            onClick={() => {
              setOpen(false);
              onPrint();
            }}
          >
            <Printer size={14} aria-hidden="true" />
            Print
          </button>
          <button
            type="button"
            role="menuitem"
            className="stp-menu__item is-danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete record
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface DeleteDialogProps {
  label: string;
  objectLabel: string;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Modal confirm before a destructive record delete. */
function DeleteDialog({
  label,
  objectLabel,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteDialogProps): React.JSX.Element {
  // Escape dismisses (unless mid-delete).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleting, onCancel]);

  return (
    <div
      className="stp-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel();
      }}
    >
      <div
        className="stp-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={`Delete ${objectLabel.toLowerCase()}`}
      >
        <h2 className="stp-dialog__title">Delete {objectLabel.toLowerCase()}?</h2>
        <p className="stp-dialog__body">
          <strong>{label}</strong> will be permanently deleted. This action
          cannot be undone.
        </p>
        {error ? <p className="stp-dialog__error">{error}</p> : null}
        <div className="stp-dialog__actions">
          <button
            type="button"
            className="stp-btn"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="stp-btn stp-btn--danger"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 size={13} className="st-spin" />
            ) : (
              <Trash2 size={13} aria-hidden="true" />
            )}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab strip
// ---------------------------------------------------------------------------

type TabKey = 'fields' | 'notes' | 'tasks' | 'activity' | 'files' | 'emails';

const TAB_DEFS: readonly { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'fields', label: 'Fields', icon: Database },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'tasks', label: 'Tasks', icon: CheckCircle2 },
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'files', label: 'Files', icon: Paperclip },
  { key: 'emails', label: 'Emails', icon: Mail },
] as const;

interface TabStripProps {
  active: TabKey;
  onSelect: (key: TabKey) => void;
  counts: Partial<Record<TabKey, number>>;
}

function TabStrip({ active, onSelect, counts }: TabStripProps) {
  return (
    <div className="rt-tabs" role="tablist" aria-label="Record sections">
      {TAB_DEFS.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        const count = counts[key];
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`rt-tab${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(key)}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
            {typeof count === 'number' && count > 0 ? (
              <span className="rt-tab__count">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Note composer (NOTE-only)
// ---------------------------------------------------------------------------

interface NoteComposerProps {
  onAdd: (
    title: string,
    body: string,
    attachments: SabcrmAttachment[],
  ) => Promise<boolean>;
}

function NoteComposer({ onAdd }: NoteComposerProps) {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [attachments, setAttachments] = React.useState<SabcrmAttachment[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const addAttachment = (att: SabcrmAttachment) =>
    setAttachments((prev) =>
      prev.some((a) => a.fileId === att.fileId) ? prev : [...prev, att],
    );
  const removeAttachment = (fileId: string) =>
    setAttachments((prev) => prev.filter((a) => a.fileId !== fileId));

  const submitForm = React.useCallback(async () => {
    if (saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    // `body` is sanitized HTML from the rich editor; collapse an empty document
    // (e.g. just "<br>") to '' so blank notes don't store stray markup.
    const richBody = isRichTextEmpty(body) ? '' : body;
    const ok = await onAdd(title.trim(), richBody, attachments);
    setSaving(false);
    if (ok) {
      setTitle('');
      setBody('');
      setAttachments([]);
    } else {
      setError('Could not add note.');
    }
  }, [saving, title, body, attachments, onAdd]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submitForm();
  };

  return (
    <form className="st-composer" onSubmit={submit}>
      <div className="st-composer__row">
        <input
          className="st-composer__title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title…"
          aria-label="Note title"
        />
      </div>
      <RichTextEditor
        value={body}
        onChange={setBody}
        onSubmit={submitForm}
        placeholder="Write a note…"
        ariaLabel="Note body"
        disabled={saving}
      />
      <div className="st-composer__footer">
        <AttachControl
          attachments={attachments}
          onAdd={addAttachment}
          onRemove={removeAttachment}
          disabled={saving}
        />
        {error ? (
          <span className="st-composer__error">{error}</span>
        ) : (
          <SubmitHint />
        )}
        <button
          type="submit"
          className="st-composer__add"
          disabled={saving || !title.trim()}
        >
          {saving ? <Loader2 size={13} className="st-spin" /> : <Plus size={13} />}
          Add note
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Task composer (TASK-only) + task list row
// ---------------------------------------------------------------------------

interface TaskComposerProps {
  onAdd: (title: string) => Promise<boolean>;
}

function TaskComposer({ onAdd }: TaskComposerProps) {
  const [title, setTitle] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    const ok = await onAdd(title.trim());
    setSaving(false);
    if (ok) setTitle('');
    else setError('Could not add task.');
  };

  return (
    <form className="st-composer" onSubmit={submit}>
      <div className="st-composer__row">
        <input
          className="st-composer__title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          aria-label="Task title"
        />
        <button
          type="submit"
          className="st-composer__add"
          disabled={saving || !title.trim()}
        >
          {saving ? <Loader2 size={13} className="st-spin" /> : <Plus size={13} />}
          Add
        </button>
      </div>
      {error && (
        <div className="st-composer__footer">
          <span className="st-composer__error">{error}</span>
        </div>
      )}
    </form>
  );
}

const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

interface TaskRowProps {
  task: SabcrmRustActivity;
  busy: boolean;
  onToggle: (task: SabcrmRustActivity) => void;
}

function TaskRow({ task, busy, onToggle }: TaskRowProps) {
  const done = isTaskDone(task);
  const due = task.dueAt ? formatDue(task.dueAt) : null;
  const statusLabel =
    TASK_STATUS_LABEL[(task.status ?? 'TODO').toUpperCase()] ??
    (task.status ?? 'To do');
  return (
    <div className="rt-task">
      <button
        type="button"
        className={`rt-task__check${done ? ' is-done' : ''}`}
        onClick={() => onToggle(task)}
        disabled={busy}
        aria-pressed={done}
        aria-label={done ? 'Mark task as not done' : 'Mark task as done'}
        title={done ? 'Mark as not done' : 'Mark as done'}
      >
        {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </button>
      <div className="rt-task__main">
        <span className={`rt-task__title${done ? ' is-done' : ''}`}>
          {task.title}
        </span>
        <span className="rt-task__meta">
          <TwentyChip label={statusLabel} />
          {due ? (
            <span className="rt-task__due">
              <CalendarClock size={11} aria-hidden="true" />
              {due}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Relation picker — search target records to attach
// ---------------------------------------------------------------------------

interface RelationPickerProps {
  /** Object slug to search records within. */
  targetObject: string;
  /** Active project (scopes the search). */
  projectId: string | null;
  /** Ids already attached — hidden from results so they can't be re-picked. */
  excludeIds: ReadonlySet<string>;
  /** Invoked with the chosen record's id; returns when the attach settles. */
  onPick: (option: SabcrmPickerOption) => Promise<void>;
  /** Accessible label for the trigger. */
  addLabel: string;
}

/**
 * A Twenty-style "+ Add" affordance that opens a search popover over
 * `targetObject` (via `searchRecordsForPickerAction`) and calls `onPick` with
 * the selected record. Dismisses on outside-click / Escape; debounces the
 * query; degrades to muted empty / error states.
 */
function RelationPicker({
  targetObject,
  projectId,
  excludeIds,
  onPick,
  addLabel,
}: RelationPickerProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [options, setOptions] = React.useState<SabcrmPickerOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [attachingId, setAttachingId] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Dismiss on outside-click / Escape while open.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Focus the search input when the popover opens; reset transient state.
  React.useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    setQuery('');
    setOptions([]);
    setError(null);
    setAttachingId(null);
    return undefined;
  }, [open]);

  // Debounced search over the target object whenever the query changes.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const handle = window.setTimeout(async () => {
      const res = await searchRecordsForPickerAction(
        targetObject,
        query.trim(),
        20,
        projectId ?? undefined,
      );
      if (cancelled) return;
      if (res.ok) setOptions(res.data);
      else {
        setOptions([]);
        setError(res.error);
      }
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query, targetObject, projectId]);

  const visible = options.filter((o) => !excludeIds.has(o.id));

  const choose = async (option: SabcrmPickerOption) => {
    if (attachingId) return;
    setAttachingId(option.id);
    await onPick(option);
    // Parent owns the relation list; closing here gives immediate feedback.
    setAttachingId(null);
    setOpen(false);
  };

  return (
    <div className="re-picker" ref={ref}>
      <button
        type="button"
        className="re-add-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={addLabel}
        title={addLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={13} aria-hidden="true" />
        Add
      </button>
      {open ? (
        <div className="re-picker__pop" role="dialog" aria-label={addLabel}>
          <div className="re-picker__search">
            <Search
              size={14}
              className="re-picker__search-icon"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              className="re-picker__input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search records…"
              aria-label="Search records to attach"
            />
          </div>
          <div className="re-picker__list">
            {loading ? (
              <div className="re-picker__state">
                <span className="re-picker__state-spin">
                  <Loader2 size={13} className="re-spin" aria-hidden="true" />
                  Searching…
                </span>
              </div>
            ) : error ? (
              <div className="re-picker__state is-error">{error}</div>
            ) : visible.length === 0 ? (
              <div className="re-picker__state">
                {query.trim() ? 'No matching records.' : 'No records to add.'}
              </div>
            ) : (
              visible.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="re-picker__item"
                  disabled={attachingId !== null}
                  onClick={() => void choose(option)}
                >
                  <span className="re-picker__item-icon" aria-hidden="true">
                    {attachingId === option.id ? (
                      <Loader2 size={13} className="re-spin" />
                    ) : (
                      <Database size={13} />
                    )}
                  </span>
                  <span className="re-picker__item-label">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Relation section (one related-records group) — attach + detach
// ---------------------------------------------------------------------------

interface RelationSectionProps {
  relation: RecordRelation;
  projectId: string | null;
  /** Attach a target record to this relation (kind-aware; see container). */
  onAttach: (relation: RecordRelation, option: SabcrmPickerOption) => Promise<void>;
  /** Detach a related record from this relation (kind-aware; see container). */
  onDetach: (relation: RecordRelation, childId: string) => Promise<void>;
  /** Id of the row currently being detached (for the busy/disabled state). */
  busyChildId: string | null;
  /**
   * For ONE_TO_MANY: the inverse MANY_TO_ONE field key on the target object
   * (resolved by the container). When unresolved, attach/detach is unavailable
   * and the controls are hidden so the section stays read-only.
   */
  inverseKey: string | null;
}

function RelationSection({
  relation,
  projectId,
  onAttach,
  onDetach,
  busyChildId,
  inverseKey,
}: RelationSectionProps) {
  const { label, targetObject, records, kind } = relation;
  // MANY_TO_ONE always supports attach (writes this record's own field).
  // ONE_TO_MANY needs the target's inverse field to be resolvable.
  const canEdit = kind === 'MANY_TO_ONE' || inverseKey !== null;
  // MANY_TO_ONE holds at most one record; hide "Add" once it's set.
  const atCapacity = kind === 'MANY_TO_ONE' && records.length > 0;
  const excludeIds = React.useMemo(
    () => new Set(records.map((r) => r.id)),
    [records],
  );

  return (
    <section className="rt-relation" aria-label={label}>
      <div className="rt-relation__head">
        <div className="re-relhead">
          <Link2 size={14} className="rt-relrow__icon" aria-hidden="true" />
          <span className="rt-relation__label">{label}</span>
          <span className="rt-relation__count">{records.length}</span>
          <span className="re-relhead__spacer" />
          {canEdit && !atCapacity ? (
            <RelationPicker
              targetObject={targetObject}
              projectId={projectId}
              excludeIds={excludeIds}
              addLabel={`Add to ${label}`}
              onPick={(option) => onAttach(relation, option)}
            />
          ) : null}
        </div>
      </div>
      {records.length === 0 ? (
        <div className="rt-relation__empty">No {label.toLowerCase()}</div>
      ) : (
        <div className="rt-relation__list">
          {records.map((rec) => {
            const busy = busyChildId === rec.id;
            return (
              <div
                key={rec.id}
                className={`rt-relrow re-relrow${busy ? ' is-busy' : ''}`}
              >
                <Link
                  href={`/sabcrm/${targetObject}/${rec.id}`}
                  className="re-relrow__link"
                >
                  <span className="rt-relrow__icon" aria-hidden="true">
                    <Database size={13} />
                  </span>
                  <span className="rt-relrow__label">
                    {relationRecordLabel(rec)}
                  </span>
                </Link>
                {canEdit ? (
                  <button
                    type="button"
                    className="re-detach"
                    disabled={busy}
                    onClick={() => void onDetach(relation, rec.id)}
                    aria-label={`Detach ${relationRecordLabel(rec)} from ${label}`}
                    title="Detach"
                  >
                    {busy ? (
                      <Loader2 size={13} className="re-spin" />
                    ) : (
                      <X size={14} />
                    )}
                  </button>
                ) : (
                  <ChevronRight
                    size={14}
                    className="rt-relrow__chevron"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline-editable field value
// ---------------------------------------------------------------------------

interface EditableValueProps {
  field: FieldMetadata;
  value: unknown;
  onCommit: (value: unknown) => void;
}

function EditableValue({ field, value, onCommit }: EditableValueProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  if (!INLINE_EDITABLE.has(field.type)) {
    return <TwentyFieldValue field={field} value={value} />;
  }

  const begin = () => {
    setDraft(value === null || value === undefined ? '' : String(value));
    setEditing(true);
  };
  const commit = (next: string) => {
    setEditing(false);
    const coerced = coerceInput(field, next);
    if (coerced !== value) onCommit(coerced);
  };

  if (!editing) {
    return (
      <span
        className="st-cell-editable"
        role="button"
        tabIndex={0}
        onClick={begin}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            begin();
          }
        }}
      >
        <TwentyFieldValue field={field} value={value} />
      </span>
    );
  }

  if (field.type === 'SELECT') {
    return (
      <select
        className="st-cell-select"
        autoFocus
        value={draft}
        onChange={(e) => commit(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
      >
        <option value="">—</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="st-cell-input"
      autoFocus
      type={
        field.type === 'NUMBER' || field.type === 'CURRENCY' || field.type === 'RATING'
          ? 'number'
          : 'text'
      }
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit((e.target as HTMLInputElement).value);
        } else if (e.key === 'Escape') {
          setEditing(false);
        }
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Tags — applied-tag chips + an "Add tag" checklist picker
// ---------------------------------------------------------------------------

/**
 * Workspace tag shape from `listTagsTw`. Declared structurally (rather than
 * importing the engine type) so this stays compatible with the `{ id, name,
 * color }` contract regardless of the action's extra fields.
 */
interface RecordTag {
  id: string;
  name: string;
  color: string;
}

/** Read the applied-tag id list off a record's `data.__tags` (defensive). */
function recordTagIds(record: SabcrmRustRecord): string[] {
  const raw = (record.data as { __tags?: unknown }).__tags;
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
}

/** Pick a readable foreground (black/white) for a given hex tag color. */
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'var(--st-text)';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Relative luminance (sRGB approximation).
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1b1b18' : '#ffffff';
}

/** Inline CSS custom-properties tinting a chip from its tag color. */
function chipVars(color: string): React.CSSProperties {
  const valid = /^#?[0-9a-f]{6}$/i.test((color ?? '').trim());
  if (!valid) return {};
  const hex = color.startsWith('#') ? color : `#${color}`;
  return {
    ['--stg-chip-bg' as string]: `${hex}22`,
    ['--stg-chip-border' as string]: `${hex}55`,
    ['--stg-chip-fg' as string]: readableOn(hex),
    ['--stg-chip-dot' as string]: hex,
  } as React.CSSProperties;
}

interface TagsRowProps {
  /** All workspace tags (catalogue for the picker); null while loading. */
  catalogue: RecordTag[] | null;
  catalogueError: string | null;
  /** Ids currently applied to the record. */
  appliedIds: string[];
  /** Toggle a tag on/off the record (optimistic; parent owns persistence). */
  onToggle: (tagId: string) => void;
  /** Ids with an in-flight toggle (for the pending visual). */
  pendingIds: ReadonlySet<string>;
  /** Last toggle error, if any. */
  error: string | null;
}

/**
 * The record-header "Tags" row: applied tags as colored chips (each removable),
 * plus an "Add tag" checklist popover listing every workspace tag with a check
 * beside the applied ones. Toggling is delegated to the parent (optimistic +
 * rollback there). Degrades to muted empty / error states.
 */
function TagsRow({
  catalogue,
  catalogueError,
  appliedIds,
  onToggle,
  pendingIds,
  error,
}: TagsRowProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  // Dismiss on outside-click / Escape while open.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const byId = React.useMemo(() => {
    const map = new Map<string, RecordTag>();
    for (const t of catalogue ?? []) map.set(t.id, t);
    return map;
  }, [catalogue]);

  const appliedSet = React.useMemo(() => new Set(appliedIds), [appliedIds]);

  // Resolve applied chips against the catalogue; tolerate ids the catalogue
  // doesn't know yet by showing a neutral fallback chip.
  const appliedTags: RecordTag[] = appliedIds.map(
    (id) => byId.get(id) ?? { id, name: id, color: '' },
  );

  return (
    <div className="stg-tags" aria-label="Tags">
      <span className="stg-tags__label">
        <TagIcon size={12} aria-hidden="true" />
        Tags
      </span>

      {appliedTags.map((tag) => (
        <span
          key={tag.id}
          className={`stg-chip${pendingIds.has(tag.id) ? ' is-pending' : ''}`}
          style={chipVars(tag.color)}
          title={tag.name}
        >
          <span className="stg-chip__dot" aria-hidden="true" />
          <span className="stg-chip__name">{tag.name}</span>
          <button
            type="button"
            className="stg-chip__remove"
            onClick={() => onToggle(tag.id)}
            disabled={pendingIds.has(tag.id)}
            aria-label={`Remove tag ${tag.name}`}
            title="Remove tag"
          >
            <X size={11} />
          </button>
        </span>
      ))}

      <div className="stg-picker" ref={ref}>
        <button
          type="button"
          className="stg-add-btn"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Add tag"
          title="Add tag"
          onClick={() => setOpen((v) => !v)}
        >
          <Plus size={12} aria-hidden="true" />
          Add tag
        </button>
        {open ? (
          <div className="stg-picker__pop" role="dialog" aria-label="Toggle tags">
            <div className="stg-picker__list">
              {catalogue === null ? (
                <div className="stg-picker__state">
                  <Loader2 size={13} className="st-spin" aria-hidden="true" />
                </div>
              ) : catalogueError ? (
                <div className="stg-picker__state is-error">{catalogueError}</div>
              ) : catalogue.length === 0 ? (
                <div className="stg-picker__state">No tags defined.</div>
              ) : (
                catalogue.map((tag) => {
                  const applied = appliedSet.has(tag.id);
                  const dot = /^#?[0-9a-f]{6}$/i.test((tag.color ?? '').trim())
                    ? tag.color.startsWith('#')
                      ? tag.color
                      : `#${tag.color}`
                    : undefined;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className="stg-picker__item"
                      disabled={pendingIds.has(tag.id)}
                      aria-pressed={applied}
                      onClick={() => onToggle(tag.id)}
                    >
                      <span className="stg-picker__check" aria-hidden="true">
                        {pendingIds.has(tag.id) ? (
                          <Loader2 size={12} className="st-spin" />
                        ) : applied ? (
                          <Check size={13} />
                        ) : null}
                      </span>
                      <span
                        className="stg-picker__item-dot"
                        style={
                          dot
                            ? ({ ['--stg-item-dot' as string]: dot } as React.CSSProperties)
                            : undefined
                        }
                        aria-hidden="true"
                      />
                      <span className="stg-picker__item-label">{tag.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <span className="stg-tags__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RecordDetailTwProps {
  object: ObjectMetadata;
  record: SabcrmRustRecord;
  projectId: string | null;
}

export function RecordDetailTw({
  object,
  record: initialRecord,
  projectId,
}: RecordDetailTwProps): React.JSX.Element {
  const router = useRouter();
  const [record, setRecord] = React.useState<SabcrmRustRecord>(initialRecord);
  const [error, setError] = React.useState<string | null>(null);

  // Confirm-delete dialog state.
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Timeline state.
  const [activities, setActivities] = React.useState<SabcrmRustActivity[]>([]);
  const [loadingTimeline, setLoadingTimeline] = React.useState(true);

  // Favorite state.
  const [favorite, setFavorite] = React.useState(false);
  const [favBusy, setFavBusy] = React.useState(false);

  // Active right-rail tab.
  const [tab, setTab] = React.useState<TabKey>('activity');

  // Collapsed-state for the left field panel's labelled sections, keyed by the
  // section label. Persisted in component state so collapses survive edits /
  // optimistic re-renders. Sections start expanded.
  const [collapsedSections, setCollapsedSections] = React.useState<
    Record<string, boolean>
  >({});
  const toggleSection = React.useCallback((label: string) => {
    setCollapsedSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  // Related-records sections (graceful: empty on failure / engine down).
  const [relations, setRelations] = React.useState<RecordRelation[]>([]);
  const [loadingRelations, setLoadingRelations] = React.useState(true);

  // Object catalogue (slug → metadata) — used to resolve the inverse field key
  // for ONE_TO_MANY attach/detach. Graceful: empty until loaded / on failure.
  const [objectsBySlug, setObjectsBySlug] = React.useState<
    Record<string, ObjectMetadata>
  >({});

  // Per-row in-flight guard for relation detach.
  const [detachBusyId, setDetachBusyId] = React.useState<string | null>(null);
  // Inline per-section attach/detach error, keyed by relation field key.
  const [relationError, setRelationError] = React.useState<string | null>(null);

  // Per-task in-flight guard for status toggles.
  const [taskBusyId, setTaskBusyId] = React.useState<string | null>(null);

  // Tags: the workspace catalogue (null = loading), per-tag in-flight guard,
  // and a toggle error. Applied ids live on the record's `data.__tags`.
  const [tagCatalogue, setTagCatalogue] = React.useState<RecordTag[] | null>(
    null,
  );
  const [tagCatalogueError, setTagCatalogueError] = React.useState<string | null>(
    null,
  );
  const [tagPendingIds, setTagPendingIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [tagError, setTagError] = React.useState<string | null>(null);

  // Print: drives the `.is-printing` class on the page root (see detail-tags.css).
  const [printing, setPrinting] = React.useState(false);

  // The viewer's author id, learned the first time they post a comment in any
  // thread. Shared across all timeline comment threads so a posted comment's
  // own-delete affordance also lights up matching comments elsewhere.
  const [commentAuthorId, setCommentAuthorId] = React.useState<string | null>(
    null,
  );
  const handleLearnCommentAuthor = React.useCallback((authorId: string) => {
    setCommentAuthorId((prev) => prev ?? authorId);
  }, []);

  const ObjectIcon = SLUG_ICON[object.slug] ?? Database;
  const editableFields = React.useMemo(
    () => object.fields.filter((f) => !f.system && f.type !== 'RELATION'),
    [object],
  );

  const handleCommit = React.useCallback(
    async (key: string, value: unknown) => {
      const prev = record;
      setError(null);
      setRecord((r) => ({ ...r, data: { ...r.data, [key]: value } }));
      const res = await updateSabcrmRecordTw(
        object.slug,
        record.id,
        { [key]: value },
        projectId ?? undefined,
      );
      if (!res.ok) {
        setRecord(prev);
        setError(res.error);
      } else {
        setRecord(res.data);
      }
    },
    [record, object.slug, projectId],
  );

  // Confirm-delete: removes the record, then returns to the object index.
  const handleConfirmDelete = React.useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteSabcrmRecordTw(
      object.slug,
      record.id,
      projectId ?? undefined,
    );
    if (res.ok) {
      // Leave the (now-gone) detail page; the index revalidates server-side.
      router.push(`/sabcrm/${object.slug}`);
      return;
    }
    setDeleteError(res.error);
    setDeleting(false);
  }, [deleting, object.slug, record.id, projectId, router]);

  // Load the record's timeline (graceful: empty on failure / engine down).
  React.useEffect(() => {
    let cancelled = false;
    setLoadingTimeline(true);
    (async () => {
      const res = await listSabcrmActivitiesTw(
        object.slug,
        record.id,
        {},
        projectId ?? undefined,
      );
      if (cancelled) return;
      if (res.ok) setActivities(res.data);
      else setActivities([]);
      setLoadingTimeline(false);
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when the record identity changes (not on every edit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.slug, record.id, projectId]);

  // Load whether this record is favorited.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listSabcrmFavoritesTw(projectId ?? undefined);
      if (cancelled) return;
      if (res.ok) {
        setFavorite(
          res.data.some(
            (f) => f.object === object.slug && f.recordId === record.id,
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [object.slug, record.id, projectId]);

  // Load the workspace tag catalogue once (graceful: muted state on failure).
  React.useEffect(() => {
    let cancelled = false;
    setTagCatalogue(null);
    setTagCatalogueError(null);
    (async () => {
      const res = await listTagsTw(projectId ?? undefined);
      if (cancelled) return;
      if (res.ok) {
        setTagCatalogue(
          res.data.map((t) => ({ id: t.id, name: t.name, color: t.color })),
        );
      } else {
        setTagCatalogue([]);
        setTagCatalogueError(res.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Currently-applied tag ids (off `data.__tags`).
  const appliedTagIds = React.useMemo(() => recordTagIds(record), [record]);

  // Toggle a tag on/off the record, persisting the new `__tags` array
  // (optimistic + rollback). A per-tag guard prevents double-fires.
  const handleToggleTag = React.useCallback(
    async (tagId: string) => {
      if (tagPendingIds.has(tagId)) return;
      const prev = record;
      const current = recordTagIds(record);
      const next = current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId];

      setTagError(null);
      setTagPendingIds((s) => {
        const copy = new Set(s);
        copy.add(tagId);
        return copy;
      });
      // Optimistically reflect the new tag set on the record.
      setRecord((r) => ({ ...r, data: { ...r.data, __tags: next } }));

      const res = await updateSabcrmRecordTw(
        object.slug,
        record.id,
        { __tags: next },
        projectId ?? undefined,
      );
      if (!res.ok) {
        setRecord(prev); // rollback
        setTagError(res.error);
      } else {
        setRecord(res.data);
      }
      setTagPendingIds((s) => {
        const copy = new Set(s);
        copy.delete(tagId);
        return copy;
      });
    },
    [tagPendingIds, record, object.slug, projectId],
  );

  // Print: apply the print-friendly class, fire the browser print dialog, then
  // clear the class once the dialog settles (afterprint, or a fallback timer).
  const handlePrint = React.useCallback(() => {
    setPrinting(true);
    const clear = () => setPrinting(false);
    window.addEventListener('afterprint', clear, { once: true });
    // Let the class paint before invoking the (synchronous) print dialog.
    window.setTimeout(() => {
      window.print();
      // Safari/Firefox don't always emit `afterprint`; ensure cleanup.
      window.setTimeout(clear, 500);
    }, 50);
  }, []);

  const handleAddActivity = React.useCallback(
    async (
      type: SabcrmActivityKind,
      title: string,
      body: string,
      attachments: SabcrmAttachment[] = [],
    ) => {
      const res = await createSabcrmActivityTw(
        {
          targetObject: object.slug,
          targetRecordId: record.id,
          type,
          title,
          body: body || undefined,
          attachments: attachments.length ? attachments : undefined,
        },
        projectId ?? undefined,
      );
      if (!res.ok) return false;
      // Prepend (timeline is newest-first).
      setActivities((prev) => [res.data, ...prev]);
      return true;
    },
    [object.slug, record.id, projectId],
  );

  const handleToggleFavorite = React.useCallback(async () => {
    if (favBusy) return;
    const next = !favorite;
    setFavBusy(true);
    setFavorite(next); // optimistic
    const res = next
      ? await addSabcrmFavoriteTw(object.slug, record.id, projectId ?? undefined)
      : await removeSabcrmFavoriteTw(
          object.slug,
          record.id,
          projectId ?? undefined,
        );
    if (!res.ok) {
      setFavorite(!next); // rollback
      setError(res.error);
    }
    setFavBusy(false);
  }, [favBusy, favorite, object.slug, record.id, projectId]);

  // Re-fetch the related-records sections (graceful: empty on failure / engine
  // down). Used both on mount and after an attach/detach commits.
  const refreshRelations = React.useCallback(async () => {
    try {
      const res = await getRecordRelationsTw(
        object.slug,
        record.id,
        projectId ?? undefined,
      );
      setRelations(res.ok ? res.data : []);
    } catch {
      setRelations([]);
    }
  }, [object.slug, record.id, projectId]);

  // Initial relations load.
  React.useEffect(() => {
    let cancelled = false;
    setLoadingRelations(true);
    (async () => {
      try {
        const res = await getRecordRelationsTw(
          object.slug,
          record.id,
          projectId ?? undefined,
        );
        if (cancelled) return;
        setRelations(res.ok ? res.data : []);
      } catch {
        if (!cancelled) setRelations([]);
      } finally {
        if (!cancelled) setLoadingRelations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [object.slug, record.id, projectId]);

  // Load the object catalogue once (for inverse-key resolution on ONE_TO_MANY).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listSabcrmObjectsTw(projectId ?? undefined);
      if (cancelled || !res.ok) return;
      const map: Record<string, ObjectMetadata> = {};
      for (const o of res.data) map[o.slug] = o;
      setObjectsBySlug(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Attach a target record to a relation (kind-aware, optimistic + rollback):
  //   MANY_TO_ONE → set THIS record's `data[field]` to the picked id.
  //   ONE_TO_MANY → set the CHILD's inverse field to THIS record's id.
  const handleAttachRelation = React.useCallback(
    async (relation: RecordRelation, option: SabcrmPickerOption) => {
      setRelationError(null);
      const prevRelations = relations;

      if (relation.kind === 'MANY_TO_ONE') {
        // Optimistically reflect the new single value + record's own field.
        setRecord((r) => ({
          ...r,
          data: { ...r.data, [relation.field]: option.id },
        }));
        setRelations((rels) =>
          rels.map((rel) =>
            rel.field === relation.field
              ? {
                  ...rel,
                  records: [
                    {
                      id: option.id,
                      projectId: '',
                      object: relation.targetObject,
                      data: { name: option.label },
                      createdAt: '',
                      updatedAt: '',
                    },
                  ],
                }
              : rel,
          ),
        );
        const res = await updateSabcrmRecordTw(
          object.slug,
          record.id,
          { [relation.field]: option.id },
          projectId ?? undefined,
        );
        if (!res.ok) {
          setRecord((r) => ({
            ...r,
            data: { ...r.data, [relation.field]: record.data[relation.field] },
          }));
          setRelations(prevRelations);
          setRelationError(res.error);
          return;
        }
        setRecord(res.data);
        await refreshRelations();
        return;
      }

      // ONE_TO_MANY: point the child's inverse field at this record.
      const inverseKey = resolveInverseKey(
        objectsBySlug[relation.targetObject],
        object.slug,
      );
      if (!inverseKey) {
        setRelationError('Cannot resolve the related field to attach.');
        return;
      }
      // Optimistically append the child to this section.
      setRelations((rels) =>
        rels.map((rel) =>
          rel.field === relation.field
            ? {
                ...rel,
                records: [
                  ...rel.records,
                  {
                    id: option.id,
                    projectId: '',
                    object: relation.targetObject,
                    data: { name: option.label },
                    createdAt: '',
                    updatedAt: '',
                  },
                ],
              }
            : rel,
        ),
      );
      const res = await updateSabcrmRecordTw(
        relation.targetObject,
        option.id,
        { [inverseKey]: record.id },
        projectId ?? undefined,
      );
      if (!res.ok) {
        setRelations(prevRelations);
        setRelationError(res.error);
        return;
      }
      await refreshRelations();
    },
    [
      relations,
      object.slug,
      record.id,
      record.data,
      projectId,
      objectsBySlug,
      refreshRelations,
    ],
  );

  // Detach a related record (kind-aware, optimistic + rollback):
  //   MANY_TO_ONE → null THIS record's `data[field]`.
  //   ONE_TO_MANY → null the CHILD's inverse field.
  const handleDetachRelation = React.useCallback(
    async (relation: RecordRelation, childId: string) => {
      if (detachBusyId) return;
      setRelationError(null);
      setDetachBusyId(childId);
      const prevRelations = relations;

      // Optimistically drop the row from this section.
      setRelations((rels) =>
        rels.map((rel) =>
          rel.field === relation.field
            ? { ...rel, records: rel.records.filter((r) => r.id !== childId) }
            : rel,
        ),
      );

      if (relation.kind === 'MANY_TO_ONE') {
        const prevValue = record.data[relation.field];
        setRecord((r) => ({
          ...r,
          data: { ...r.data, [relation.field]: null },
        }));
        const res = await updateSabcrmRecordTw(
          object.slug,
          record.id,
          { [relation.field]: null },
          projectId ?? undefined,
        );
        if (!res.ok) {
          setRecord((r) => ({
            ...r,
            data: { ...r.data, [relation.field]: prevValue },
          }));
          setRelations(prevRelations);
          setRelationError(res.error);
        } else {
          setRecord(res.data);
          await refreshRelations();
        }
        setDetachBusyId(null);
        return;
      }

      // ONE_TO_MANY: clear the child's inverse field.
      const inverseKey = resolveInverseKey(
        objectsBySlug[relation.targetObject],
        object.slug,
      );
      if (!inverseKey) {
        setRelations(prevRelations);
        setRelationError('Cannot resolve the related field to detach.');
        setDetachBusyId(null);
        return;
      }
      const res = await updateSabcrmRecordTw(
        relation.targetObject,
        childId,
        { [inverseKey]: null },
        projectId ?? undefined,
      );
      if (!res.ok) {
        setRelations(prevRelations);
        setRelationError(res.error);
      } else {
        await refreshRelations();
      }
      setDetachBusyId(null);
    },
    [
      detachBusyId,
      relations,
      object.slug,
      record.id,
      record.data,
      projectId,
      objectsBySlug,
      refreshRelations,
    ],
  );

  // Add a NOTE-kind activity (Notes tab composer).
  const handleAddNote = React.useCallback(
    (title: string, body: string, attachments: SabcrmAttachment[]) =>
      handleAddActivity('NOTE', title, body, attachments),
    [handleAddActivity],
  );

  // Add a TASK-kind activity, defaulting status to TODO (Tasks tab composer).
  const handleAddTask = React.useCallback(
    async (title: string) => {
      const res = await createSabcrmActivityTw(
        {
          targetObject: object.slug,
          targetRecordId: record.id,
          type: 'TASK',
          title,
          status: 'TODO',
        },
        projectId ?? undefined,
      );
      if (!res.ok) return false;
      setActivities((prev) => [res.data, ...prev]);
      return true;
    },
    [object.slug, record.id, projectId],
  );

  // Toggle a task between TODO and DONE (optimistic; rolls back on failure).
  const handleToggleTask = React.useCallback(
    async (task: SabcrmRustActivity) => {
      if (taskBusyId) return;
      const nextStatus = isTaskDone(task) ? 'TODO' : 'DONE';
      setTaskBusyId(task.id);
      setActivities((prev) =>
        prev.map((a) =>
          a.id === task.id ? { ...a, status: nextStatus } : a,
        ),
      );
      const res = await updateSabcrmActivityTw(
        task.id,
        { status: nextStatus },
        projectId ?? undefined,
      );
      if (!res.ok) {
        // Roll back to the prior status.
        setActivities((prev) =>
          prev.map((a) => (a.id === task.id ? { ...a, status: task.status } : a)),
        );
        setError(res.error);
      } else {
        setActivities((prev) =>
          prev.map((a) => (a.id === task.id ? res.data : a)),
        );
      }
      setTaskBusyId(null);
    },
    [taskBusyId, projectId],
  );

  const notes = React.useMemo(
    () => activities.filter((a) => a.type.toUpperCase() === 'NOTE'),
    [activities],
  );
  const tasks = React.useMemo(
    () => activities.filter((a) => a.type.toUpperCase() === 'TASK'),
    [activities],
  );

  // Total attachments across all activities — drives the Files tab badge.
  const filesCount = React.useMemo(
    () => activities.reduce((sum, a) => sum + activityAttachments(a).length, 0),
    [activities],
  );

  const tabCounts = React.useMemo<Partial<Record<TabKey, number>>>(
    () => ({
      fields: editableFields.length,
      notes: notes.length,
      tasks: tasks.length,
      activity: activities.length,
      files: filesCount,
    }),
    [
      editableFields.length,
      notes.length,
      tasks.length,
      activities.length,
      filesCount,
    ],
  );

  // Group the left details panel into Twenty-style labelled sections.
  const fieldSections = React.useMemo(
    () => groupFieldSections(editableFields),
    [editableFields],
  );

  const label = recordLabel(object, record);

  return (
    <div className={`st-page${printing ? ' is-printing' : ''}`}>
      <Link href={`/sabcrm/${object.slug}`} className="st-back">
        <ArrowLeft size={14} />
        {object.labelPlural}
      </Link>

      {/* Twenty breadcrumb: {Object plural} / {record label} */}
      <nav className="stp-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/sabcrm/${object.slug}`} className="stp-breadcrumb__crumb">
          <ObjectIcon size={13} aria-hidden="true" />
          {object.labelPlural}
        </Link>
        <ChevronRight
          size={13}
          className="stp-breadcrumb__sep"
          aria-hidden="true"
        />
        <span className="stp-breadcrumb__current" aria-current="page">
          {label}
        </span>
      </nav>

      <div className="st-detail-header">
        <span className="st-page-header__icon" aria-hidden="true">
          <ObjectIcon size={16} />
        </span>
        <h1 className="st-page-header__title">{label}</h1>
        <div className="stp-header-actions">
          <StarToggle
            active={favorite}
            busy={favBusy}
            onToggle={handleToggleFavorite}
          />
          <RecordMenu
            onPrint={handlePrint}
            onDelete={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          />
        </div>
      </div>

      <TagsRow
        catalogue={tagCatalogue}
        catalogueError={tagCatalogueError}
        appliedIds={appliedTagIds}
        onToggle={handleToggleTag}
        pendingIds={tagPendingIds}
        error={tagError}
      />

      {deleteOpen ? (
        <DeleteDialog
          label={label}
          objectLabel={object.labelSingular}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleting) setDeleteOpen(false);
          }}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      {error && (
        <div className="st-banner" role="alert">
          <AlertTriangle className="st-banner__icon" size={15} />
          <span>{error}</span>
        </div>
      )}

      <div className="st-detail-grid">
        {/* Main column — field list, grouped into labelled sections */}
        <section className="st-panel" aria-label="Record fields">
          <div className="st-panel__head">Details</div>
          <div className="st-panel__body">
            {fieldSections.map((section) => (
              <CollapsibleFieldSection
                key={section.label}
                label={section.label}
                fields={section.fields}
                collapsed={!!collapsedSections[section.label]}
                onToggle={() => toggleSection(section.label)}
                record={record}
                onCommit={handleCommit}
              />
            ))}
          </div>
        </section>

        {/* Right rail — Twenty tab strip (Fields / Notes / Tasks / Activity) */}
        <aside className="st-panel" aria-label="Record sections">
          <div className="st-panel__body">
            <DetailsSummary fields={editableFields} record={record} />

            <TabStrip active={tab} onSelect={setTab} counts={tabCounts} />

            {tab === 'fields' && (
              <div
                className="rt-panel"
                role="tabpanel"
                aria-label="Fields summary"
              >
                {editableFields.length === 0 ? (
                  <div className="rt-panel__empty">No fields.</div>
                ) : (
                  <div className="rt-fields">
                    {editableFields.map((field) => (
                      <div className="rt-fields__row" key={field.key}>
                        <span className="rt-fields__key">{field.label}</span>
                        <span className="rt-fields__val">
                          <TwentyFieldValue
                            field={field}
                            value={record.data[field.key]}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'notes' && (
              <div className="rt-panel" role="tabpanel" aria-label="Notes">
                <NoteComposer onAdd={handleAddNote} />
                {loadingTimeline ? (
                  <TwentyTimeline activities={[]} loading emptyLabel="" />
                ) : notes.length === 0 ? (
                  <div className="rt-panel__empty">No notes yet.</div>
                ) : (
                  <div className="rt-notes">
                    {notes.map((n) => (
                      <article className="rt-note" key={n.id}>
                        <div className="rt-note__head">
                          <span className="rt-note__title">{n.title}</span>
                          <time className="rt-note__time" dateTime={n.createdAt}>
                            {relTime(n.createdAt)}
                          </time>
                        </div>
                        {n.body ? (
                          <RichTextView body={n.body} className="rt-note__body" />
                        ) : null}
                        <AttachmentList attachments={activityAttachments(n)} />
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'tasks' && (
              <div className="rt-panel" role="tabpanel" aria-label="Tasks">
                <TaskComposer onAdd={handleAddTask} />
                {loadingTimeline ? (
                  <TwentyTimeline activities={[]} loading emptyLabel="" />
                ) : tasks.length === 0 ? (
                  <div className="rt-panel__empty">No tasks yet.</div>
                ) : (
                  <div className="rt-tasks">
                    {tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        busy={taskBusyId === t.id}
                        onToggle={handleToggleTask}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'activity' && (
              <div
                className="rt-panel"
                role="tabpanel"
                aria-label="Activity timeline"
              >
                <Composer onAdd={handleAddActivity} />
                <AttachmentTimeline
                  activities={activities}
                  loading={loadingTimeline}
                  emptyLabel="No activity yet"
                  currentAuthorId={commentAuthorId}
                  onLearnAuthor={handleLearnCommentAuthor}
                />
              </div>
            )}

            {tab === 'files' && (
              <div className="rt-panel" role="tabpanel" aria-label="Files">
                <FilesPanel activities={activities} loading={loadingTimeline} />
              </div>
            )}

            {tab === 'emails' && (
              <div className="rt-panel" role="tabpanel" aria-label="Emails">
                <EmailsPanel />
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Relations — Twenty's related-records sections (attach / detach) */}
      {!loadingRelations && relations.length > 0 && (
        <div className="rt-relations" aria-label="Related records">
          {relationError ? (
            <div className="re-relerror" role="alert">
              {relationError}
            </div>
          ) : null}
          {relations.map((rel) => (
            <RelationSection
              key={rel.field}
              relation={rel}
              projectId={projectId}
              onAttach={handleAttachRelation}
              onDetach={handleDetachRelation}
              busyChildId={detachBusyId}
              inverseKey={resolveInverseKey(
                objectsBySlug[rel.targetObject],
                object.slug,
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default RecordDetailTw;
