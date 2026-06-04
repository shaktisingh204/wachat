import 'server-only';

/**
 * SabCRM Notifications client — wraps the Rust `/v1/sabcrm/notifications`
 * surface (crate `sabcrm-notifications`, mounted by `sabnode-api`).
 *
 * A notification is a per-user in-app message (`title`, optional `body`,
 * `kind`, optional `targetObject` + `targetRecordId`) within a project. The
 * `userId` is resolved on the Rust side from the `AuthUser` JWT for reads and
 * writes — except `create`, which may fan a notification out to another user
 * by supplying `userId` in the body. Tenant scope is `projectId`.
 *
 * The Rust handlers wrap responses in `{ notifications: [...] }` (list),
 * `{ notification: {...} }` (single), `{ unread }` (count) and
 * `{ ok, updated }` (read-all); this client unwraps the list/single ones.
 * Wire shapes mirror `rust/crates/sabcrm-notifications/src/{dto,handlers}.rs`.
 *
 * Server-only. (Except for {@link sabcrmNotificationsApi.streamPath}, which only
 * returns a relative URL string the browser can hand to `EventSource`.)
 */
import { rustFetch } from './fetcher';

/**
 * A SabCRM notification kind. The Rust side now accepts the full Twenty set —
 * `mention | assignment | comment | system | info` — and rejects unknown
 * kinds, defaulting to `system` when absent.
 */
export type SabcrmNotificationKind =
  | 'info'
  | 'mention'
  | 'assignment'
  | 'comment'
  | 'system';

/**
 * A resolved reference to the actor who triggered a notification. Injected by
 * the Rust list handler onto each item under `actor` when the stored `actorId`
 * resolves against the project's `workspaceMembers` records (or from the
 * snapshot stored at creation time). Mirrors the Rust `ActorRef` DTO.
 */
export interface SabcrmNotificationActor {
  /** The actor's `workspaceMembers` record id (hex). */
  id: string;
  /** Display name for the actor. */
  name: string;
  /** Avatar URL, when known (omitted by the engine when none). */
  avatarUrl?: string;
}

/** A SabCRM notification as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustNotification {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  body?: string;
  kind?: SabcrmNotificationKind | string;
  targetObject?: string;
  targetRecordId?: string;
  read: boolean;
  createdAt: string;
  /**
   * Stored id of the actor (`workspaceMembers` record) who triggered the
   * notification, when set at creation time. Defaults Rust-side to the caller.
   */
  actorId?: string;
  /** Pre-resolved actor display name snapshot stored at creation time. */
  actorName?: string;
  /** Pre-resolved actor avatar URL snapshot stored at creation time. */
  actorAvatarUrl?: string;
  /**
   * Resolved actor reference, injected in place by the list handler when the
   * `actorId` resolves (or from the stored snapshot). Absent when unresolved.
   */
  actor?: SabcrmNotificationActor;
}

/**
 * `POST /` body sans `projectId` — the notification to create. `userId` is
 * optional; absent means the caller (resolved Rust-side from the JWT).
 */
export interface SabcrmNotificationCreateInput {
  userId?: string;
  title: string;
  body?: string;
  kind?: SabcrmNotificationKind | string;
  targetObject?: string;
  targetRecordId?: string;
  /**
   * Id of the actor (`workspaceMembers` record) who triggered the
   * notification. Defaults Rust-side to the caller; stored so the list can
   * enrich it back into an {@link SabcrmNotificationActor}.
   */
  actorId?: string;
  /** Pre-resolved actor display name to snapshot at creation time. */
  actorName?: string;
  /** Pre-resolved actor avatar URL to snapshot at creation time. */
  actorAvatarUrl?: string;
}

/** Options for {@link sabcrmNotificationsApi.list}. */
export interface SabcrmNotificationListOpts {
  /** When true, only unread notifications are returned. */
  unreadOnly?: boolean;
  /**
   * Filter by notification kind
   * (`mention` | `assignment` | `comment` | `system` | `info`).
   */
  kind?: SabcrmNotificationKind | string;
  /** Page size (1..=200). Defaults to 50, capped at 200 server-side. */
  limit?: number;
  /**
   * Zero-based offset (skip) into the result set. Defaults to 0. Pass back the
   * {@link SabcrmNotificationListResult.nextCursor} from a prior page to page.
   */
  cursor?: number;
}

/**
 * Paged list result from `GET /` — the caller's notifications plus pagination
 * metadata. Mirrors the Rust `ListResponse`: `total` is the full match count,
 * `nextCursor` is the offset to pass back as `cursor` for the next page (or
 * `null`/absent when exhausted), and `hasMore` mirrors that as a boolean.
 */
export interface SabcrmNotificationListResult {
  notifications: SabcrmRustNotification[];
  total: number;
  nextCursor?: number | null;
  hasMore: boolean;
}

/** Raw `{ notifications, total, nextCursor?, hasMore }` envelope from `GET /`. */
interface ListEnvelope {
  notifications: SabcrmRustNotification[];
  total: number;
  nextCursor?: number | null;
  hasMore: boolean;
}

/** Raw `{ notification }` envelope from `POST /` and `POST /{id}/read`. */
interface SingleEnvelope {
  notification: SabcrmRustNotification;
}

/**
 * The named SSE events the Rust `GET /stream` handler emits, in the order a
 * consumer should expect them:
 *
 * - `ready`        — sent once on open; `data` is the literal `"ok"`.
 * - `notification` — one per newly-created row; `data` is the JSON of a
 *                    {@link SabcrmRustNotification} (already actor-enriched).
 * - `count`        — the caller's current unread total; `data` is that number
 *                    as a decimal string. Emitted after each poll batch so
 *                    badge UIs stay live.
 *
 * `EventSource` clients should `addEventListener(<name>, …)` for each. A
 * periodic `keep-alive` comment frame is also sent and is ignored by consumers.
 */
export type SabcrmNotificationStreamEvent = 'ready' | 'notification' | 'count';

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const BASE = '/v1/sabcrm/notifications';

export const sabcrmNotificationsApi = {
  /**
   * `GET /v1/sabcrm/notifications` — the caller's notifications, newest first.
   * Returns just the notifications array (backward-compatible); use
   * {@link listPaged} for the full `{ total, nextCursor, hasMore }` envelope.
   */
  async list(
    projectId: string,
    opts?: SabcrmNotificationListOpts,
  ): Promise<SabcrmRustNotification[]> {
    const res = await this.listPaged(projectId, opts);
    return res.notifications;
  },

  /**
   * `GET /v1/sabcrm/notifications` — paged variant exposing the full Rust
   * `ListResponse` (`notifications`, `total`, `nextCursor`, `hasMore`).
   * Supports `kind` filtering and offset (`cursor`) / `limit` pagination.
   */
  async listPaged(
    projectId: string,
    opts?: SabcrmNotificationListOpts,
  ): Promise<SabcrmNotificationListResult> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({
        projectId,
        unreadOnly: opts?.unreadOnly,
        kind: opts?.kind,
        limit: opts?.limit,
        cursor: opts?.cursor,
      })}`,
    );
    return {
      notifications: res.notifications,
      total: res.total,
      nextCursor: res.nextCursor ?? null,
      hasMore: res.hasMore,
    };
  },

  /** `GET /v1/sabcrm/notifications/count` — the caller's unread count. */
  count(projectId: string): Promise<{ unread: number }> {
    return rustFetch<{ unread: number }>(`${BASE}/count${qs({ projectId })}`);
  },

  /** `POST /v1/sabcrm/notifications` — create a notification. */
  async create(
    projectId: string,
    input: SabcrmNotificationCreateInput,
  ): Promise<SabcrmRustNotification> {
    const res = await rustFetch<SingleEnvelope>(`${BASE}${qs({ projectId })}`, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.notification;
  },

  /** `POST /v1/sabcrm/notifications/{id}/read` — mark read/unread. */
  async markRead(
    projectId: string,
    id: string,
    read: boolean,
  ): Promise<SabcrmRustNotification> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/read${qs({ projectId })}`,
      { method: 'POST', body: JSON.stringify({ projectId, read }) },
    );
    return res.notification;
  },

  /** `POST /v1/sabcrm/notifications/read-all` — mark all caller's as read. */
  markAllRead(projectId: string): Promise<{ ok: boolean; updated: number }> {
    return rustFetch<{ ok: boolean; updated: number }>(
      `${BASE}/read-all${qs({ projectId })}`,
      { method: 'POST', body: JSON.stringify({ projectId }) },
    );
  },

  /** `DELETE /v1/sabcrm/notifications/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },

  /**
   * Returns the relative SSE path for `GET /v1/sabcrm/notifications/stream`
   * (a `text/event-stream` of live notification + unread-count events for the
   * caller within `projectId`; see {@link SabcrmNotificationStreamEvent}).
   *
   * `EventSource` cannot send the `Authorization` bearer that {@link rustFetch}
   * mints, so the browser must consume this through a server-side proxy route
   * that forwards the token (mirroring the Telegram chats `streamPath` pattern).
   * This helper only builds the string, so it is safe to import in a
   * `'use client'` boundary even though the rest of the module is server-only.
   */
  streamPath(projectId: string): string {
    return `${BASE}/stream${qs({ projectId })}`;
  },
};
