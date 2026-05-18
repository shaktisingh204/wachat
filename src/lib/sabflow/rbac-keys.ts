/**
 * SabFlow permission keys (single source of truth for the module).
 *
 * These keys are also enumerated in:
 *   - `src/lib/permission-modules.ts` (`globalModules` + `moduleCategories.SabFlow`)
 *   - `src/lib/definitions.ts` (`GlobalRolePermissions` type)
 *
 * Use `SabflowPermissionKey` whenever you need a compile-time-checked SabFlow
 * key (e.g. when calling `requirePermission(key, action, workspaceId)`).
 *
 * Mirrors the SabWa pattern from `src/lib/sabwa/rbac-keys.ts`. The dot-notation
 * (`sabflow.doc.read` rather than `sabflow_doc_read`) is preserved to match
 * the keys already reserved by earlier SabFlow phases:
 *
 *   - `src/lib/sabflow/executor/credentials/rbac.ts`  (credential keys)
 *   - `src/lib/sabflow/persistence/guards.ts`         (doc keys)
 *   - `src/app/api/sabflow/triggers/[id]/replay/route.ts` (workflow/trigger keys)
 *
 * Default role grants for the four SabFlow workspace roles
 * (`viewer` / `editor` / `admin` / `owner`, see
 * `src/lib/sabflow/workspaces/types.ts`) are exported as
 * `DEFAULT_SABFLOW_ROLE_GRANTS` for downstream consumers that materialise
 * workspace `customPermissions` templates.
 *
 * See Track A · Phase 8 §1 for the registration rationale.
 */

import type { WorkspaceRole } from '@/lib/sabflow/workspaces/types';

/* ──────────────────────────────────────────────────────────────────────── */
/*  Reserved permission keys                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Document-scoped keys (flows, folders, saved views).
 *
 * | Key                    | Intent                                                            |
 * |------------------------|-------------------------------------------------------------------|
 * | `sabflow.doc.read`     | View / open a flow document.                                      |
 * | `sabflow.doc.write`    | Create or update a flow document.                                 |
 * | `sabflow.doc.delete`   | Delete a flow document.                                           |
 * | `sabflow.doc.share`    | Manage per-doc ACLs / public sharing.                             |
 * | `sabflow.doc.admin`    | Full control over docs (force-revoke, ownership transfer).        |
 */
export const SABFLOW_DOC_PERMISSION_KEYS = [
    'sabflow.doc.read',
    'sabflow.doc.write',
    'sabflow.doc.delete',
    'sabflow.doc.share',
    'sabflow.doc.admin',
] as const;

/**
 * Credential-scoped keys — re-exported here to keep one canonical list for
 * `permission-modules.ts`. The source of truth for these strings and their
 * helper signatures remains `src/lib/sabflow/executor/credentials/rbac.ts`.
 */
export const SABFLOW_CREDENTIAL_PERMISSION_KEYS = [
    'sabflow.credential.read',
    'sabflow.credential.use',
    'sabflow.credential.write',
    'sabflow.credential.delete',
    'sabflow.credential.share',
    'sabflow.credential.admin',
] as const;

/**
 * Workflow-execution keys (run / write / read flow definitions).
 *
 * | Key                          | Intent                                              |
 * |------------------------------|-----------------------------------------------------|
 * | `sabflow.workflow.read`      | View workflow definitions and run history.          |
 * | `sabflow.workflow.write`     | Edit workflow definitions.                          |
 * | `sabflow.workflow.execute`   | Trigger workflow runs (manual + via replay).        |
 */
export const SABFLOW_WORKFLOW_PERMISSION_KEYS = [
    'sabflow.workflow.read',
    'sabflow.workflow.write',
    'sabflow.workflow.execute',
] as const;

/**
 * Trigger-management keys.
 *
 * | Key                       | Intent                                                  |
 * |---------------------------|---------------------------------------------------------|
 * | `sabflow.trigger.admin`   | Create / edit / delete trigger sources, replay events.  |
 */
export const SABFLOW_TRIGGER_PERMISSION_KEYS = [
    'sabflow.trigger.admin',
] as const;

/**
 * Marketplace keys — template submission and moderation.
 *
 * | Key                              | Intent                                          |
 * |----------------------------------|-------------------------------------------------|
 * | `sabflow:marketplace:submit`     | Submit a flow to the public marketplace queue.  |
 * | `sabflow:marketplace:review`     | Review, approve, or reject pending submissions. |
 *
 * `review` is an admin/owner-only key; `submit` is granted to editors and
 * above. Dot-notation is intentionally broken here: the colon separator
 * matches the external RBAC style used for marketplace keys across modules
 * (see `src/lib/permission-modules.ts`).
 */
export const SABFLOW_MARKETPLACE_PERMISSION_KEYS = [
    'sabflow:marketplace:submit',
    'sabflow:marketplace:review',
] as const;

/**
 * Execution-management keys (read / pin / unpin individual execution rows).
 *
 * | Key                          | Intent                                              |
 * |------------------------------|-----------------------------------------------------|
 * | `sabflow.execution.pin`      | Pin an execution row + its trace to bypass the      |
 * |                              | 30-day trace TTL on important runs.                 |
 * | `sabflow.execution.unpin`    | Unpin an execution row — restores the trace's       |
 * |                              | rolling 30-day `expiresAt`.                         |
 * | `sabflow.execution.admin`    | Catch-all admin grant — implies both pin & unpin.   |
 *
 * Reserved by Phase C.9 §4. NOT yet registered in `permission-modules.ts` /
 * `definitions.ts` — global registration happens in Phase B.8 §1, following
 * the same forward-declaration pattern used for the credential keys
 * (`src/lib/sabflow/executor/credentials/rbac.ts`) and trigger keys.
 */
export const SABFLOW_EXECUTION_PERMISSION_KEYS = [
    'sabflow.execution.pin',
    'sabflow.execution.unpin',
    'sabflow.execution.admin',
] as const;

/** All SabFlow permission keys — single flat list for module registration. */
export const SABFLOW_PERMISSION_KEYS = [
    ...SABFLOW_DOC_PERMISSION_KEYS,
    ...SABFLOW_CREDENTIAL_PERMISSION_KEYS,
    ...SABFLOW_WORKFLOW_PERMISSION_KEYS,
    ...SABFLOW_TRIGGER_PERMISSION_KEYS,
    ...SABFLOW_EXECUTION_PERMISSION_KEYS,
    ...SABFLOW_MARKETPLACE_PERMISSION_KEYS,
] as const;

export type SabflowPermissionKey = (typeof SABFLOW_PERMISSION_KEYS)[number];

/* ──────────────────────────────────────────────────────────────────────── */
/*  Default role grants (workspace role → granted keys)                      */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Default mapping from SabFlow workspace role to the SabFlow permission keys
 * that role is granted out of the box.
 *
 * - `viewer`: read-only across doc, workflow. No credential access (credentials
 *   are explicitly opt-in for editors and above).
 * - `editor`: read + write docs + workflows, execute workflows, read & use
 *   credentials (i.e. configure nodes that reference credentials).
 * - `admin`:  editor + delete/share docs + write/delete/share credentials +
 *   admin triggers.
 * - `owner`:  full control — every reserved key including
 *   `sabflow.doc.admin` and `sabflow.credential.admin`.
 *
 * Mirrors `DEFAULT_CREDENTIAL_ROLE_GRANTS` from
 * `src/lib/sabflow/executor/credentials/rbac.ts` so the two stay in sync.
 */
export const DEFAULT_SABFLOW_ROLE_GRANTS: Record<
    WorkspaceRole,
    readonly SabflowPermissionKey[]
> = {
    viewer: [
        'sabflow.doc.read',
        'sabflow.workflow.read',
    ],
    editor: [
        'sabflow.doc.read',
        'sabflow.doc.write',
        'sabflow.credential.read',
        'sabflow.credential.use',
        'sabflow.workflow.read',
        'sabflow.workflow.write',
        'sabflow.workflow.execute',
        'sabflow:marketplace:submit',
    ],
    admin: [
        'sabflow.doc.read',
        'sabflow.doc.write',
        'sabflow.doc.delete',
        'sabflow.doc.share',
        'sabflow.credential.read',
        'sabflow.credential.use',
        'sabflow.credential.write',
        'sabflow.credential.delete',
        'sabflow.credential.share',
        'sabflow.workflow.read',
        'sabflow.workflow.write',
        'sabflow.workflow.execute',
        'sabflow.trigger.admin',
        // Execution pinning — admins get the catch-all `execution.admin`,
        // which implies both `execution.pin` and `execution.unpin` at the
        // enforcement layer (see `hasExecutionPinPermission` in
        // src/app/api/sabflow/executions/[id]/pin/route.ts).
        'sabflow.execution.pin',
        'sabflow.execution.unpin',
        'sabflow.execution.admin',
        'sabflow:marketplace:submit',
        'sabflow:marketplace:review',
    ],
    owner: [
        'sabflow.doc.read',
        'sabflow.doc.write',
        'sabflow.doc.delete',
        'sabflow.doc.share',
        'sabflow.doc.admin',
        'sabflow.credential.read',
        'sabflow.credential.use',
        'sabflow.credential.write',
        'sabflow.credential.delete',
        'sabflow.credential.share',
        'sabflow.credential.admin',
        'sabflow.workflow.read',
        'sabflow.workflow.write',
        'sabflow.workflow.execute',
        'sabflow.trigger.admin',
        'sabflow.execution.pin',
        'sabflow.execution.unpin',
        'sabflow.execution.admin',
        'sabflow:marketplace:submit',
        'sabflow:marketplace:review',
    ],
} as const;
