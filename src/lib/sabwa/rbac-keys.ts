/**
 * SabWa permission keys (single source of truth for the module).
 *
 * These keys are also enumerated in:
 *   - `src/lib/permission-modules.ts` (`globalModules` + `moduleCategories.SabWa`)
 *   - `src/lib/definitions.ts` (`GlobalRolePermissions` type)
 *
 * Use `SabwaPermissionKey` whenever you need a compile-time-checked SabWa key
 * (e.g. when calling `can(effective, key, 'view')` from a SabWa-only callsite).
 *
 * See `SABWA_PLAN.md` §10 for the full RBAC & plan-gating rationale.
 */

export const SABWA_PERMISSION_KEYS = [
    'sabwa_overview',
    'sabwa_connect',
    'sabwa_inbox',
    'sabwa_chats',
    'sabwa_groups',
    'sabwa_group_manage',
    'sabwa_broadcasts',
    'sabwa_bulk_send',
    'sabwa_scheduler',
    'sabwa_contacts',
    'sabwa_templates',
    'sabwa_auto_reply',
    'sabwa_flows',
    'sabwa_ai',
    'sabwa_media',
    'sabwa_status',
    'sabwa_calls',
    'sabwa_labels',
    'sabwa_starred',
    'sabwa_analytics',
    'sabwa_export',
    'sabwa_webhooks',
    'sabwa_api_keys',
    'sabwa_audit',
    'sabwa_settings',
] as const;

export type SabwaPermissionKey = (typeof SABWA_PERMISSION_KEYS)[number];
