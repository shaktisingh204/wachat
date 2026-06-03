import 'server-only';

/**
 * SabCRM Roles client — wraps the Rust `/v1/sabcrm/roles` surface
 * (crate `sabcrm-roles`, mounted by `sabnode-api`).
 *
 * A role is a named permission set: free-form `permissions` string keys
 * (e.g. `records:read`, `settings:manage`) plus a list of assigned
 * `memberIds`. Tenant scope is `projectId`; the Rust side requires a valid
 * `AuthUser` JWT.
 *
 * The Rust handlers wrap responses in `{ roles: [...] }` (list) and
 * `{ role: {...} }` (single); this client unwraps them. Wire shapes mirror
 * `rust/crates/sabcrm-roles/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/**
 * Canonical permission keys offered by the SabCRM roles UI. Permissions are
 * free-form strings on the wire — this list is for reference only.
 */
export const CANONICAL_PERMISSIONS = [
  'records:read',
  'records:write',
  'records:delete',
  'settings:manage',
  'members:manage',
] as const;

/** A SabCRM role as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustRole {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  permissions: string[];
  memberIds: string[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * `POST /` body sans `projectId` — the new role's fields. Sent as
 * `{ projectId, ...input }`.
 */
export interface SabcrmRoleCreateInput {
  name: string;
  description?: string;
  permissions?: string[];
  memberIds?: string[];
  isDefault?: boolean;
}

/** `PATCH /{id}` body sans `projectId` — a partial role document. */
export interface SabcrmRoleUpdateInput {
  [key: string]: unknown;
}

/** Raw `{ roles }` envelope from `GET /`. */
interface ListEnvelope {
  roles: SabcrmRustRole[];
}

/** Raw `{ role }` envelope from `GET /{id}`, `POST /`, `PATCH /{id}`, `POST /{id}/members`. */
interface SingleEnvelope {
  role: SabcrmRustRole;
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

const BASE = '/v1/sabcrm/roles';

export const sabcrmRolesApi = {
  /** `GET /v1/sabcrm/roles` — list every role for the project. */
  async list(projectId: string): Promise<SabcrmRustRole[]> {
    const res = await rustFetch<ListEnvelope>(`${BASE}${qs({ projectId })}`);
    return res.roles;
  },

  /** `GET /v1/sabcrm/roles/{id}` — fetch one role. */
  async get(projectId: string, id: string): Promise<SabcrmRustRole> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
    return res.role;
  },

  /** `POST /v1/sabcrm/roles` — create a role. */
  async create(
    projectId: string,
    input: SabcrmRoleCreateInput,
  ): Promise<SabcrmRustRole> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.role;
  },

  /** `PATCH /v1/sabcrm/roles/{id}` — partial update. */
  async update(
    projectId: string,
    id: string,
    input: SabcrmRoleUpdateInput,
  ): Promise<SabcrmRustRole> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.role;
  },

  /** `DELETE /v1/sabcrm/roles/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },

  /**
   * `POST /v1/sabcrm/roles/{id}/members` — assign (`assigned: true`) or
   * unassign (`assigned: false`) a single member id on the role.
   */
  async setMember(
    projectId: string,
    id: string,
    memberId: string,
    assigned: boolean,
  ): Promise<SabcrmRustRole> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/members`,
      {
        method: 'POST',
        body: JSON.stringify({ projectId, memberId, assigned }),
      },
    );
    return res.role;
  },
};
