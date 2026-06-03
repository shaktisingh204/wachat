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
 */
import { rustFetch } from './fetcher';

/** A SabCRM notification kind. */
export type SabcrmNotificationKind = 'info' | 'mention' | 'assignment' | 'system';

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
}

/** Options for {@link sabcrmNotificationsApi.list}. */
export interface SabcrmNotificationListOpts {
  /** When true, only unread notifications are returned. */
  unreadOnly?: boolean;
}

/** Raw `{ notifications }` envelope from `GET /`. */
interface ListEnvelope {
  notifications: SabcrmRustNotification[];
}

/** Raw `{ notification }` envelope from `POST /` and `POST /{id}/read`. */
interface SingleEnvelope {
  notification: SabcrmRustNotification;
}

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
  /** `GET /v1/sabcrm/notifications` — the caller's notifications, newest first. */
  async list(
    projectId: string,
    opts?: SabcrmNotificationListOpts,
  ): Promise<SabcrmRustNotification[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({ projectId, unreadOnly: opts?.unreadOnly })}`,
    );
    return res.notifications;
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
};
