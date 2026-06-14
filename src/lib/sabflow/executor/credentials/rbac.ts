/**
 * SabFlow credential RBAC — reserved permission keys + helper signatures.
 *
 * **Track B · Phase 5 · §10** (sibling of Phase 8 §1).
 *
 * This file *reserves* the permission keys and ships ready-to-call helpers
 * (`canReadCredential`, `canUseCredential`, …) that forward to the existing
 * `requirePermission` enforcement surface in `src/lib/rbac-server.ts`.
 *
 * ### ⚠️ DO NOT add these to `src/lib/permission-modules.ts` here.
 *
 * Module registration — appending to `globalModules`, the
 * `moduleCategories.SabFlow` entry, and the `GlobalRolePermissions` type in
 * `src/lib/definitions.ts` — is owned exclusively by **Phase B.8 §1**
 * ("Per-doc RBAC keys registered in SabNode RBAC registry"). Following the
 * SabNode RBAC-key registry precedent, Phase B.8 §1 will mirror the
 * keys exported from this file into those three registries in one atomic PR.
 *
 * Sibling tasks calling into these helpers will Just Work the moment Phase
 * B.8 §1 lands — they hit `requirePermission` against keys that resolve to
 * the registered modules. Until then, the helpers safely return `false`
 * (deny-by-default) for non-owner / non-admin callers, since the underlying
 * permission map will not contain unregistered keys.
 *
 * See `docs/adr/sabflow-auth.md` §2 for the full registration pattern and
 * `src/lib/sabflow/workspaces/permissions.ts` for the parallel workspace-role
 * helpers this file complements.
 */

import { requirePermission, canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import type { WorkspaceRole } from '@/lib/sabflow/workspaces/types';

/* ──────────────────────────────────────────────────────────────────────── */
/*  Reserved permission keys                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Reserved SabFlow credential permission keys.
 *
 * Phase B.8 §1 will copy this tuple verbatim into
 * `src/lib/permission-modules.ts` (`globalModules` + `moduleCategories.SabFlow`)
 * and extend `GlobalRolePermissions` in `src/lib/definitions.ts`.
 *
 * | Key                          | Intent                                                                |
 * |------------------------------|-----------------------------------------------------------------------|
 * | `sabflow.credential.read`    | View credential **metadata** (name, type, owner) — never plaintext.   |
 * | `sabflow.credential.use`     | Invoke at runtime via nodes (decrypt for in-flight execution only).   |
 * | `sabflow.credential.write`   | Create or update a credential.                                        |
 * | `sabflow.credential.delete`  | Delete a credential.                                                  |
 * | `sabflow.credential.share`   | Grant other workspace members access (ACL writes).                    |
 * | `sabflow.credential.admin`   | Full control — rotate KEK, view secret values in test, force-revoke.  |
 */
export const SABFLOW_CREDENTIAL_PERMISSION_KEYS = [
    'sabflow.credential.read',
    'sabflow.credential.use',
    'sabflow.credential.write',
    'sabflow.credential.delete',
    'sabflow.credential.share',
    'sabflow.credential.admin',
] as const;

export type SabflowCredentialPermissionKey =
    (typeof SABFLOW_CREDENTIAL_PERMISSION_KEYS)[number];

/* ──────────────────────────────────────────────────────────────────────── */
/*  Default-role mapping (workspace role → granted keys)                    */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Default mapping from workspace role (see
 * `src/lib/sabflow/workspaces/permissions.ts`) to the credential permission
 * keys that role is granted out of the box.
 *
 * - `viewer`: nothing (no credential surface — viewers only consume rendered flows).
 * - `editor`: read, use (can configure nodes that reference credentials, can run flows).
 * - `admin`:  read, use, write, delete, share (manages the credential vault).
 * - `owner`:  everything above + `admin` (KEK rotation, secret-value reveals).
 *
 * Phase B.8 §1 will materialise these defaults into the workspace's
 * `customPermissions` template when a new workspace is created. Until then,
 * helper functions below fall back to this map for previews / unit tests.
 */
export const DEFAULT_CREDENTIAL_ROLE_GRANTS: Record<
    WorkspaceRole,
    readonly SabflowCredentialPermissionKey[]
> = {
    viewer: [],
    editor: ['sabflow.credential.read', 'sabflow.credential.use'],
    admin: [
        'sabflow.credential.read',
        'sabflow.credential.use',
        'sabflow.credential.write',
        'sabflow.credential.delete',
        'sabflow.credential.share',
    ],
    owner: [
        'sabflow.credential.read',
        'sabflow.credential.use',
        'sabflow.credential.write',
        'sabflow.credential.delete',
        'sabflow.credential.share',
        'sabflow.credential.admin',
    ],
} as const;

/* ──────────────────────────────────────────────────────────────────────── */
/*  Helper signatures (forward-decl into requirePermission)                 */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Context passed to every credential-RBAC helper.
 *
 * `workspaceId` doubles as the `projectId` passed to `requirePermission` —
 * SabFlow workspaces ARE SabNode projects per the workspace migration
 * (see `src/lib/sabflow/workspaces/db.ts`).
 *
 * `credentialId` is included for future per-credential ACLs (Phase B.8 §2 will
 * extend these helpers to consult a `credential_acl` collection when present);
 * today it is logged for auditing only.
 */
export type CredentialRbacContext = {
    workspaceId: string;
    /** Optional — when omitted, the check is a workspace-wide capability probe. */
    credentialId?: string;
};

/**
 * Internal: route a credential permission key through the global
 * `requirePermission` guard. Maps each reserved key to the `PermissionAction`
 * that best matches the global `{view, create, edit, delete}` action model.
 *
 * @internal — exported for unit tests only.
 */
export function _actionForCredentialKey(
    key: SabflowCredentialPermissionKey,
): PermissionAction {
    switch (key) {
        case 'sabflow.credential.read':
            return 'view';
        case 'sabflow.credential.use':
            // "Use" is a read-shaped op: it reveals nothing the user can edit,
            // it just decrypts in-flight for the execution worker.
            return 'view';
        case 'sabflow.credential.write':
            return 'create';
        case 'sabflow.credential.delete':
            return 'delete';
        case 'sabflow.credential.share':
            // Share is a write against the ACL collection.
            return 'edit';
        case 'sabflow.credential.admin':
            // Admin is delete-shaped: it is the highest-trust op (KEK rotate,
            // force-reveal). Matches plan ceiling for super-admin actions.
            return 'delete';
    }
}

/**
 * Generic gate — `true` iff the current session has `key` on the given
 * workspace. Forward-decl: delegates to
 * `src/lib/rbac-server.ts::canServer` once Phase B.8 §1 registers the keys.
 *
 * Until registration, non-owner / non-admin callers receive `false`
 * (deny-by-default) — owners and elevated roles still pass via the plan
 * ceiling.
 */
export async function canCredential(
    ctx: CredentialRbacContext,
    key: SabflowCredentialPermissionKey,
): Promise<boolean> {
    return canServer(key, _actionForCredentialKey(key), ctx.workspaceId);
}

/**
 * Hard-enforcing variant — returns the same discriminated `{ok, error}` shape
 * as `requirePermission` so server actions and route handlers can short-circuit
 * with a uniform error surface.
 */
export async function requireCredentialPermission(
    ctx: CredentialRbacContext,
    key: SabflowCredentialPermissionKey,
) {
    return requirePermission(
        key,
        _actionForCredentialKey(key),
        ctx.workspaceId,
    );
}

/** View credential metadata (NOT the secret value). */
export async function canReadCredential(
    ctx: CredentialRbacContext,
): Promise<boolean> {
    return canCredential(ctx, 'sabflow.credential.read');
}

/** Invoke a credential at runtime via a node (decrypt for in-flight use). */
export async function canUseCredential(
    ctx: CredentialRbacContext,
): Promise<boolean> {
    return canCredential(ctx, 'sabflow.credential.use');
}

/** Create or update a credential. */
export async function canWriteCredential(
    ctx: CredentialRbacContext,
): Promise<boolean> {
    return canCredential(ctx, 'sabflow.credential.write');
}

/** Delete a credential. */
export async function canDeleteCredential(
    ctx: CredentialRbacContext,
): Promise<boolean> {
    return canCredential(ctx, 'sabflow.credential.delete');
}

/** Grant another workspace member access to a credential. */
export async function canShareCredential(
    ctx: CredentialRbacContext,
): Promise<boolean> {
    return canCredential(ctx, 'sabflow.credential.share');
}

/**
 * Full control: rotate the KEK, reveal secret values in test, force-revoke.
 * Reserved for owners and the explicit `sabflow.credential.admin` grant.
 */
export async function canAdminCredential(
    ctx: CredentialRbacContext,
): Promise<boolean> {
    return canCredential(ctx, 'sabflow.credential.admin');
}
