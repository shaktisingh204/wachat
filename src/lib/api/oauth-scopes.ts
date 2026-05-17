/**
 * CRM Public API — OAuth2 scope catalogue (Phase 7 foundation).
 *
 * These scopes gate the curated public REST API exposed at
 * `/api/v1/crm/<entity>` (the 10 top entities). Tokens are issued by tenant
 * admins via `/dashboard/crm/settings/api-tokens` and are stored hashed in
 * the `crm_api_tokens` Mongo collection.
 *
 * Naming convention (intentionally distinct from the legacy codegen'd
 * `crm:<entity>:read` shape on `/api/v1/crm/taxes/*`):
 *
 *   `crm:read:<entity>`   — list/detail
 *   `crm:write:<entity>`  — create/update/delete
 *
 * A wildcard `crm:*` scope satisfies any check (used for full-tenant
 * automation tokens). Keep this file in sync with `CRM_API_ENTITIES`
 * below — the rest of the codebase reads the list from here.
 */

// NOTE: do NOT add `import 'server-only'` here. This module exposes pure
// types, constants and predicates that are reused by the OAuth-token
// admin UI (`/dashboard/crm/settings/api-tokens/new`) — a client
// component. The scope catalogue itself is not a secret; the runtime
// enforcement lives in `crm-rest-handler.ts`, which IS server-only.

/** The 10 top-level CRM entities exposed via the public REST API. */
export const CRM_API_ENTITIES = [
    'accounts',
    'contacts',
    'leads',
    'deals',
    'quotations',
    'invoices',
    'sales-orders',
    'tasks',
    'items',
    'vendors',
] as const;

export type CrmApiEntity = (typeof CRM_API_ENTITIES)[number];

/** Read-only scopes (one per entity). */
export type CrmReadScope =
    | 'crm:read:accounts'
    | 'crm:read:contacts'
    | 'crm:read:leads'
    | 'crm:read:deals'
    | 'crm:read:quotations'
    | 'crm:read:invoices'
    | 'crm:read:sales-orders'
    | 'crm:read:tasks'
    | 'crm:read:items'
    | 'crm:read:vendors';

/** Write scopes (one per entity). */
export type CrmWriteScope =
    | 'crm:write:accounts'
    | 'crm:write:contacts'
    | 'crm:write:leads'
    | 'crm:write:deals'
    | 'crm:write:quotations'
    | 'crm:write:invoices'
    | 'crm:write:sales-orders'
    | 'crm:write:tasks'
    | 'crm:write:items'
    | 'crm:write:vendors';

/** Wildcard scope — satisfies any scope check. */
export type CrmWildcardScope = 'crm:*';

/** Full OAuth scope union for the CRM public REST API. */
export type OAuthScope = CrmReadScope | CrmWriteScope | CrmWildcardScope;

/** All 20 entity-level scopes (read + write) for the picker UI. */
export const ALL_CRM_SCOPES: OAuthScope[] = CRM_API_ENTITIES.flatMap(
    (entity) =>
        [`crm:read:${entity}`, `crm:write:${entity}`] as [
            CrmReadScope,
            CrmWriteScope,
        ],
);

/** Convenience builders so route files don't hand-construct strings. */
export function readScope(entity: CrmApiEntity): CrmReadScope {
    return `crm:read:${entity}` as CrmReadScope;
}

export function writeScope(entity: CrmApiEntity): CrmWriteScope {
    return `crm:write:${entity}` as CrmWriteScope;
}

/** Type guard. */
export function isOAuthScope(s: unknown): s is OAuthScope {
    if (typeof s !== 'string') return false;
    if (s === 'crm:*') return true;
    return (ALL_CRM_SCOPES as string[]).includes(s);
}

/**
 * Returns `true` when the token's `grantedScopes` satisfy `required`. The
 * wildcard `crm:*` short-circuits the check.
 */
export function requireScope(
    grantedScopes: readonly OAuthScope[] | undefined,
    required: OAuthScope,
): boolean {
    if (!grantedScopes || grantedScopes.length === 0) return false;
    if (grantedScopes.includes('crm:*')) return true;
    return grantedScopes.includes(required);
}
