/**
 * Identity barrel — re-exports for `Identity, RBAC & Multi-Tenancy`.
 *
 * Note: server-only modules (`sessions`, `jit-grant` Mongo store, `ip-allowlist`
 * Mongo store) re-export only their pure helpers + types here. Importers that
 * need the persistence layer should import from the file directly so the
 * "server-only" guard applies.
 */

export * from './types';
export * from './sso';
export * from './scim';
export * from './mfa';
export * from './rbac-fine';
export * from './ip-allowlist';
export {
    requestJitGrant,
    approveGrant,
    denyGrant,
    revokeGrant,
    expireDueGrants,
} from './jit-grant';
export type { JitGrantStore, RequestJitGrantInput } from './jit-grant';
export {
    buildSession,
    listSessions,
    revokeSession,
    revokeAllSessions,
} from './sessions';
export type { SessionStore, CreateSessionInput } from './sessions';
