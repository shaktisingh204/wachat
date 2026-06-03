import 'server-only';

/**
 * SabCRM Invites client — wraps the Rust `/v1/sabcrm/invites` surface
 * (crate `sabcrm-invites`, mounted by `sabnode-api`).
 *
 * An invite is a pending workspace-member offer for an `email` within a
 * project, carrying a `token` and a `status` (`pending` | `accepted` |
 * `revoked`). The `invitedBy` field is resolved on the Rust side from the
 * `AuthUser` JWT — never sent in the body. Tenant scope is `projectId`.
 *
 * The Rust handlers wrap responses in `{ invites: [...] }` (list),
 * `{ invite: {...} }` (create), and `{ ok, invite }` (revoke); this client
 * unwraps them. Wire shapes mirror
 * `rust/crates/sabcrm-invites/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** Invite lifecycle status. */
export type SabcrmInviteStatus = 'pending' | 'accepted' | 'revoked';

/** A SabCRM invite as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustInvite {
  id: string;
  projectId: string;
  email: string;
  roleId?: string;
  status: SabcrmInviteStatus;
  token: string;
  invitedBy: string;
  createdAt: string;
  acceptedAt?: string;
}

/** Raw `{ invites }` envelope from `GET /`. */
interface ListEnvelope {
  invites: SabcrmRustInvite[];
}

/** Raw `{ invite }` envelope from `POST /`. */
interface SingleEnvelope {
  invite: SabcrmRustInvite;
}

/** Raw `{ ok, invite }` envelope from `POST /{id}/revoke`. */
interface RevokeEnvelope {
  ok: boolean;
  invite: SabcrmRustInvite;
}

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const BASE = '/v1/sabcrm/invites';

export const sabcrmInvitesApi = {
  /** `GET /v1/sabcrm/invites` — a project's invites, newest first. */
  async list(
    projectId: string,
    status?: SabcrmInviteStatus,
  ): Promise<SabcrmRustInvite[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({ projectId, status })}`,
    );
    return res.invites;
  },

  /** `POST /v1/sabcrm/invites` — create a pending invite. */
  async create(
    projectId: string,
    email: string,
    roleId?: string,
  ): Promise<SabcrmRustInvite> {
    const res = await rustFetch<SingleEnvelope>(`${BASE}${qs({ projectId })}`, {
      method: 'POST',
      body: JSON.stringify({ projectId, email, roleId }),
    });
    return res.invite;
  },

  /** `POST /v1/sabcrm/invites/{id}/revoke` — set status=revoked. */
  async revoke(
    projectId: string,
    id: string,
  ): Promise<{ ok: boolean; invite: SabcrmRustInvite }> {
    const res = await rustFetch<RevokeEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/revoke${qs({ projectId })}`,
      { method: 'POST' },
    );
    return { ok: res.ok, invite: res.invite };
  },

  /** `DELETE /v1/sabcrm/invites/{id}` — hard-delete an invite. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },
};
