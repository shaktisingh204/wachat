/**
 * SabCRM — persistent notification inbox — PURE shape + format helpers.
 *
 * The structural twin of `./scoring.ts`: a `'server-only'`- and I/O-free module
 * so the unit tests (`tsx --test`) AND the `'use client'` notification bell can
 * import the {@link SabcrmInboxNotification} shape and the deterministic
 * title / body / href / grouping helpers directly. The Mongo CRUD side effects
 * live in `./notifications.server.ts`, which re-exports everything here.
 *
 * ## Model
 *
 * A notification is a durable, per-recipient inbox row scoped to one
 * `userId` + `projectId`. It carries a {@link NotificationKind} (what happened),
 * a `title` + optional `body` (rendered in the bell dropdown), an optional
 * deep-link `href`, a `read` flag and a `createdAt`. The on-record CRM data is
 * never duplicated here — instead `target` (object slug + record id) lets the
 * helpers build a canonical `/sabcrm/<object>/<recordId>` deep link.
 *
 * ## Why a separate in-house inbox
 *
 * This is the durable, Mongo-backed inbox (collection `sabcrm_notifications`)
 * that comments-mentions, assignments, SLA breaches and approvals enqueue via
 * the `notify()` helper in `./notifications.server.ts`. It owns its own
 * collection + helper; callers never touch Mongo directly.
 */

/** What happened — drives the icon, the default title verb, and grouping. */
export type NotificationKind =
  | 'mention'
  | 'assignment'
  | 'sla_breach'
  | 'approval'
  | 'comment'
  | 'system'
  | 'info';

/** Every recognised {@link NotificationKind} (validates persisted rows). */
export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  'mention',
  'assignment',
  'sla_breach',
  'approval',
  'comment',
  'system',
  'info',
] as const;

/** Type guard — narrows an unknown stored value to a {@link NotificationKind}. */
export function isNotificationKind(v: unknown): v is NotificationKind {
  return (
    typeof v === 'string' &&
    (NOTIFICATION_KINDS as readonly string[]).includes(v)
  );
}

/**
 * A reference to the CRM record a notification points at. Optional — a `system`
 * notice may have none. When present the helpers build a canonical deep link.
 */
export interface NotificationTarget {
  /** Object slug, e.g. `leads`, `companies`, `cases`. */
  object: string;
  /** Serialized record id (hex). */
  recordId: string;
  /** Display label snapshot for the body line (rendered without a join). */
  label?: string;
}

/**
 * The serialisable notification shape (the Mongo doc minus the raw `_id` —
 * surfaced as the string `id`). Timestamps are ISO strings for transport.
 */
export interface SabcrmInboxNotification {
  id: string;
  /** Tenant scope. */
  projectId: string;
  /** Recipient user id (the inbox owner). */
  userId: string;
  kind: NotificationKind;
  title: string;
  /** Optional supporting line under the title. */
  body?: string;
  /** Deep link the row navigates to when clicked. */
  href?: string;
  /** The CRM record this is about, when applicable. */
  target?: NotificationTarget;
  /** Id of the user who triggered the notification (the actor), when known. */
  actorId?: string;
  /** Display-name snapshot of the actor, for the body line. */
  actorName?: string;
  read: boolean;
  createdAt: string;
}

/**
 * What `notify()` accepts. The server stamps `id`, `read`, `createdAt`, and —
 * when omitted — derives `title` / `body` / `href` from {@link buildTitle} /
 * {@link buildBody} / {@link buildHref}.
 */
export interface NotifyInput {
  projectId: string;
  /** Recipient user id (the inbox owner). */
  userId: string;
  kind: NotificationKind;
  /** Override the derived title. */
  title?: string;
  /** Override the derived body. */
  body?: string;
  /** Override the derived deep link. */
  href?: string;
  target?: NotificationTarget;
  actorId?: string;
  actorName?: string;
}

/** Default human verbs per kind, used by {@link buildTitle}. */
const KIND_TITLE: Record<NotificationKind, string> = {
  mention: 'You were mentioned',
  assignment: 'You were assigned a record',
  sla_breach: 'An SLA was breached',
  approval: 'An approval needs your attention',
  comment: 'New comment',
  system: 'Notification',
  info: 'Notification',
};

/** Lucide icon name per kind (resolved by the bell via `renderIcon`). */
const KIND_ICON: Record<NotificationKind, string> = {
  mention: 'AtSign',
  assignment: 'UserCheck',
  sla_breach: 'AlarmClock',
  approval: 'ShieldCheck',
  comment: 'MessageSquare',
  system: 'Bell',
  info: 'Info',
};

/** The lucide icon name a row of `kind` should render with. */
export function iconForKind(kind: NotificationKind): string {
  return KIND_ICON[kind] ?? KIND_ICON.info;
}

/** Trim + collapse a snippet so body lines never blow out the dropdown. */
export function truncate(text: string, max = 140): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Human label for an object slug fallback ("service-cases" → "Service cases"). */
function humanizeSlug(slug: string): string {
  const s = String(slug ?? '').replace(/[-_]+/g, ' ').trim();
  if (!s) return 'record';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A short, readable name for the target a row points at. */
function targetName(target?: NotificationTarget): string {
  if (!target) return 'a record';
  if (target.label && target.label.trim()) return target.label.trim();
  const obj = humanizeSlug(target.object);
  const tail = target.recordId ? ` ${target.recordId.slice(-6)}` : '';
  return `${obj}${tail}`;
}

/**
 * Derive the row title from the kind + optional actor/target. Pure. Used when
 * the caller does not pass an explicit `title`.
 */
export function buildTitle(input: NotifyInput): string {
  if (input.title && input.title.trim()) return input.title.trim();
  const actor = input.actorName?.trim();
  switch (input.kind) {
    case 'mention':
      return actor ? `${actor} mentioned you` : KIND_TITLE.mention;
    case 'comment':
      return actor ? `${actor} commented` : KIND_TITLE.comment;
    case 'assignment':
      return actor
        ? `${actor} assigned you ${targetName(input.target)}`
        : KIND_TITLE.assignment;
    case 'sla_breach':
      return `SLA breached on ${targetName(input.target)}`;
    case 'approval':
      return actor
        ? `${actor} requested your approval`
        : KIND_TITLE.approval;
    default:
      return KIND_TITLE[input.kind] ?? KIND_TITLE.info;
  }
}

/**
 * Derive the supporting body line. Pure. Returns `undefined` when there is
 * nothing useful to add beyond the title (so the row stays single-line).
 */
export function buildBody(input: NotifyInput): string | undefined {
  if (input.body !== undefined) {
    const b = truncate(input.body);
    return b || undefined;
  }
  if (input.target) {
    return truncate(`On ${targetName(input.target)}`);
  }
  return undefined;
}

/**
 * Build the canonical deep link a row navigates to. Pure. Prefers an explicit
 * `href`; otherwise `/sabcrm/<object>/<recordId>` when a target is present.
 * Returns `undefined` when there is nothing to link to.
 */
export function buildHref(input: NotifyInput): string | undefined {
  if (input.href && input.href.trim()) return input.href.trim();
  const t = input.target;
  if (t && t.object && t.recordId) {
    return `/sabcrm/${encodeURIComponent(t.object)}/${encodeURIComponent(t.recordId)}`;
  }
  return undefined;
}

/**
 * Count unread rows in a list. Pure. (The authoritative count comes from the
 * server's `unreadCount`, but the bell uses this for optimistic updates.)
 */
export function countUnread(items: SabcrmInboxNotification[]): number {
  return items.reduce((n, x) => n + (x.read ? 0 : 1), 0);
}

/** A day bucket label used by {@link groupByDay}. */
export type DayBucket = 'Today' | 'Yesterday' | 'Earlier';

/** Which day bucket an ISO timestamp falls into, relative to `now` (ms). */
export function dayBucketFor(createdAt: string, now: number): DayBucket {
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return 'Earlier';
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  if (ts >= todayMs) return 'Today';
  if (ts >= todayMs - 86_400_000) return 'Yesterday';
  return 'Earlier';
}

/** A grouped section of the feed (preserves input order within a bucket). */
export interface NotificationGroup {
  bucket: DayBucket;
  items: SabcrmInboxNotification[];
}

/**
 * Group a (newest-first) feed into Today / Yesterday / Earlier sections,
 * dropping empty buckets and preserving the input order. Pure + deterministic.
 */
export function groupByDay(
  items: SabcrmInboxNotification[],
  now: number = Date.now(),
): NotificationGroup[] {
  const order: DayBucket[] = ['Today', 'Yesterday', 'Earlier'];
  const map = new Map<DayBucket, SabcrmInboxNotification[]>();
  for (const it of items) {
    const bucket = dayBucketFor(it.createdAt, now);
    const arr = map.get(bucket) ?? [];
    arr.push(it);
    map.set(bucket, arr);
  }
  const out: NotificationGroup[] = [];
  for (const bucket of order) {
    const arr = map.get(bucket);
    if (arr && arr.length > 0) out.push({ bucket, items: arr });
  }
  return out;
}
