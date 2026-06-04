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
 * `standardId` values for the three seeded standard roles (Twenty's
 * Admin / Member / Guest). Mirrors `STANDARD_ROLE_*` in
 * `rust/crates/sabcrm-roles/src/dto.rs`.
 */
export const STANDARD_ROLE_ADMIN = 'admin';
/** `standardId` for the seeded **Member** role. */
export const STANDARD_ROLE_MEMBER = 'member';
/** `standardId` for the seeded **Guest** role. */
export const STANDARD_ROLE_GUEST = 'guest';

/**
 * Recognised role-target discriminants (Twenty's `RoleTarget`). Mirrors
 * `ROLE_TARGET_KINDS` in `rust/crates/sabcrm-roles/src/dto.rs`.
 */
export const ROLE_TARGET_KINDS = ['user', 'apiKey', 'agent'] as const;

/** A role-target discriminant (`user` | `apiKey` | `agent`). */
export type SabcrmRoleTarget = (typeof ROLE_TARGET_KINDS)[number];

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
  /** Display label (Twenty's `label`); persisted, falls back to `name`. */
  label?: string;
  /** Optional icon key (Twenty's `icon`, e.g. `IconUserCog`). */
  icon?: string;
  description?: string;
  /**
   * `standardId` of a seeded standard role (`admin` | `member` | `guest`),
   * present only on the three seeded rows. See `STANDARD_ROLE_*`.
   */
  standardId?: string;
  /** Free-form permission keys (legacy / curated). */
  permissions: string[];
  /** Structured capability flags (canonical set, validated server-side). */
  permissionFlags?: SabcrmPermissionFlag[];
  /**
   * Settings master switch (Twenty's `canUpdateAllSettings`). When `true` the
   * role implicitly holds every settings permission flag. Persisted; defaults
   * to `false` on create.
   */
  canUpdateAllSettings?: boolean;
  /**
   * Tool master switch (Twenty's `canAccessAllTools`). When `true` the role
   * implicitly holds every tool permission flag. Defaults to `false`.
   */
  canAccessAllTools?: boolean;
  /** Whether the role may be assigned to workspace members. Defaults `true`. */
  canBeAssignedToUsers?: boolean;
  /** Whether the role may be assigned to API keys. Defaults `true`. */
  canBeAssignedToApiKeys?: boolean;
  /** Whether the role may be assigned to AI agents. Defaults `true`. */
  canBeAssignedToAgents?: boolean;
  /**
   * Whether the role can be edited/deleted from the UI. Seeded standard roles
   * set this `false`. Defaults `true`.
   */
  isEditable?: boolean;
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
  /** Display label (Twenty's `label`); falls back to `name` when omitted. */
  label?: string;
  /** Icon key (Twenty's `icon`, e.g. `IconUserCog`). */
  icon?: string;
  description?: string;
  /** Settings master switch (Twenty's `canUpdateAllSettings`). Default `false`. */
  canUpdateAllSettings?: boolean;
  /** Tool master switch (Twenty's `canAccessAllTools`). Default `false`. */
  canAccessAllTools?: boolean;
  /** Whether the role may be assigned to workspace members. Default `true`. */
  canBeAssignedToUsers?: boolean;
  /** Whether the role may be assigned to API keys. Default `true`. */
  canBeAssignedToApiKeys?: boolean;
  /** Whether the role may be assigned to AI agents. Default `true`. */
  canBeAssignedToAgents?: boolean;
  /** Whether the role can be edited/deleted from the UI. Default `true`. */
  isEditable?: boolean;
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

/**
 * `POST /seed` response — the three standard role documents (existing rows are
 * reused, missing ones created) plus whether anything was newly created this
 * call. Mirrors `SeedRolesResponse` in `rust/crates/sabcrm-roles/src/dto.rs`.
 */
export interface SabcrmSeedRolesResult {
  roles: SabcrmRustRole[];
  /** `true` if at least one role was newly created this call. */
  createdAny: boolean;
}

/**
 * `POST /assign-member` response — the member's new role plus the role they were
 * moved off (if any). Mirrors `AssignMemberRoleResponse` in the Rust dto.
 */
export interface SabcrmAssignMemberResult {
  role: SabcrmRustRole;
  /** Previous role the member was removed from, when applicable. */
  previousRole?: SabcrmRustRole;
}

/** Raw `{ roles, createdAny }` envelope from `POST /seed`. */
interface SeedEnvelope {
  roles: SabcrmRustRole[];
  createdAny: boolean;
}

/** Raw `{ role, previousRole? }` envelope from `POST /assign-member`. */
interface AssignMemberEnvelope {
  role: SabcrmRustRole;
  previousRole?: SabcrmRustRole;
}

/** Raw `{ memberIds }` envelope from `GET /{id}/members`. */
interface MembersEnvelope {
  memberIds: string[];
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

  /**
   * `GET /v1/sabcrm/roles/{id}/members` — the member ids assigned to a role.
   */
  async listMembers(projectId: string, id: string): Promise<string[]> {
    const res = await rustFetch<MembersEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/members${qs({ projectId })}`,
    );
    return res.memberIds;
  },

  /**
   * `POST /v1/sabcrm/roles/seed` — idempotently provision the three standard
   * roles (Admin / Member / Guest) for a project. Optionally assigns the
   * Admin role to `adminMemberId`.
   */
  async seed(
    projectId: string,
    adminMemberId?: string,
  ): Promise<SabcrmSeedRolesResult> {
    const res = await rustFetch<SeedEnvelope>(`${BASE}/seed`, {
      method: 'POST',
      body: JSON.stringify({ projectId, adminMemberId }),
    });
    return { roles: res.roles, createdAny: res.createdAny };
  },

  /**
   * `POST /v1/sabcrm/roles/assign-member` — assign a member to exactly one role
   * (unassigning them from any other role first). `updatorMemberId` blocks
   * self-demotion server-side.
   */
  async assignMember(
    projectId: string,
    memberId: string,
    roleId: string,
    updatorMemberId?: string,
  ): Promise<SabcrmAssignMemberResult> {
    const res = await rustFetch<AssignMemberEnvelope>(`${BASE}/assign-member`, {
      method: 'POST',
      body: JSON.stringify({ projectId, memberId, roleId, updatorMemberId }),
    });
    return { role: res.role, previousRole: res.previousRole };
  },

  /**
   * `PUT /v1/sabcrm/roles/{id}/object-permissions` — replace the role's
   * per-object CRUD matrix wholesale (Twenty's `upsertObjectPermissions`).
   */
  async upsertObjectPermissions(
    projectId: string,
    id: string,
    objectPermissions: SabcrmObjectPermission[],
  ): Promise<SabcrmRustRole> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/object-permissions`,
      { method: 'PUT', body: JSON.stringify({ projectId, objectPermissions }) },
    );
    return res.role;
  },

  /**
   * `PUT /v1/sabcrm/roles/{id}/field-permissions` — replace the role's
   * per-field read/update matrix wholesale (Twenty's `upsertFieldPermissions`).
   */
  async upsertFieldPermissions(
    projectId: string,
    id: string,
    fieldPermissions: SabcrmFieldPermission[],
  ): Promise<SabcrmRustRole> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/field-permissions`,
      { method: 'PUT', body: JSON.stringify({ projectId, fieldPermissions }) },
    );
    return res.role;
  },

  /**
   * `PUT /v1/sabcrm/roles/{id}/permission-flags` — replace the role's
   * capability flags wholesale (Twenty's `upsertPermissionFlags`). Each key
   * must be canonical (validated server-side).
   */
  async upsertPermissionFlags(
    projectId: string,
    id: string,
    permissionFlags: SabcrmPermissionFlag[],
  ): Promise<SabcrmRustRole> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/permission-flags`,
      { method: 'PUT', body: JSON.stringify({ projectId, permissionFlags }) },
    );
    return res.role;
  },
};
