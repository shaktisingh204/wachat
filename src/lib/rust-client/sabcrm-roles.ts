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

/**
 * Canonical permission-flag keys — SabCRM's structured analogue of Twenty's
 * `PermissionFlagType` (settings + tool capability families, 25 keys). Mirrors
 * `CANONICAL_PERMISSION_FLAGS` in `rust/crates/sabcrm-roles/src/dto.rs`; the
 * Rust engine rejects any `permissionFlags` value not in this set.
 */
export const CANONICAL_PERMISSION_FLAGS = [
  // settings permissions
  'API_KEYS_AND_WEBHOOKS',
  'WORKSPACE',
  'WORKSPACE_MEMBERS',
  'ROLES',
  'DATA_MODEL',
  'SECURITY',
  'WORKFLOWS',
  'IMPERSONATE',
  'SSO_BYPASS',
  'APPLICATIONS',
  'MARKETPLACE_APPS',
  'LAYOUTS',
  'BILLING',
  'AI_SETTINGS',
  // tool permissions
  'AI',
  'VIEWS',
  'UPLOAD_FILE',
  'DOWNLOAD_FILE',
  'SEND_EMAIL_TOOL',
  'HTTP_REQUEST_TOOL',
  'CODE_INTERPRETER_TOOL',
  'IMPORT_CSV',
  'EXPORT_CSV',
  'CONNECTED_ACCOUNTS',
  'PROFILE_INFORMATION',
] as const;

/** A canonical SabCRM permission-flag key. */
export type SabcrmPermissionFlag = (typeof CANONICAL_PERMISSION_FLAGS)[number];

/**
 * Role-level "all records" CRUD defaults (Twenty's
 * `canReadAll/canUpdateAll/canSoftDeleteAll/canDestroyAll`). Workspace-wide
 * default-allow per verb; per-object overrides refine it. All optional.
 */
export interface SabcrmRoleDefaults {
  canReadAll?: boolean;
  canUpdateAll?: boolean;
  canSoftDeleteAll?: boolean;
  canDestroyAll?: boolean;
}

/**
 * Per-object tri-state CRUD override (Twenty's `ObjectPermissionEntity`).
 * `true` grant / `false` deny / omitted (`undefined`) inherit the role default.
 */
export interface SabcrmObjectPermission {
  object: string;
  read?: boolean;
  update?: boolean;
  softDelete?: boolean;
  destroy?: boolean;
}

/**
 * Per-field tri-state read/update override (Twenty's `FieldPermissionEntity`).
 * Layered on top of object permissions; tri-state via `undefined` = inherit.
 */
export interface SabcrmFieldPermission {
  object: string;
  field: string;
  read?: boolean;
  update?: boolean;
}

/** A SabCRM role as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustRole {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  /** Free-form permission keys (legacy / curated). */
  permissions: string[];
  /** Structured capability flags (canonical set, validated server-side). */
  permissionFlags?: SabcrmPermissionFlag[];
  /** Role-level "all records" CRUD defaults. */
  defaults?: SabcrmRoleDefaults;
  /** Per-object tri-state CRUD overrides. */
  objectPermissions?: SabcrmObjectPermission[];
  /** Per-field tri-state read/update overrides. */
  fieldPermissions?: SabcrmFieldPermission[];
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
  /** Structured capability flags (canonical set; validated server-side). */
  permissionFlags?: SabcrmPermissionFlag[];
  /** Role-level "all records" CRUD defaults. */
  defaults?: SabcrmRoleDefaults;
  /** Per-object tri-state CRUD overrides. */
  objectPermissions?: SabcrmObjectPermission[];
  /** Per-field tri-state read/update overrides. */
  fieldPermissions?: SabcrmFieldPermission[];
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
