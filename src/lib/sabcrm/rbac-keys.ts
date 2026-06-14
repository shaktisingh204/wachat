/**
 * RBAC permission keys for the SabCRM module.
 *
 * These keys gate access to SabCRM. They are registered in the central
 * RBAC registry and checked via the `useRbac` hook / `RBACGuard`.
 *
 * Follows the SabNode RBAC-key registry pattern. Fine-grained object/field
 * permissions stay inside the Twenty engine (its own role system); these
 * keys only gate the SabNode-side mount + plan access.
 */

export const SABCRM_RBAC_KEYS = {
  /** Can open the SabCRM module at all. */
  VIEW: 'sabcrm:view',
  /** Can manage CRM records (create / edit / delete). */
  MANAGE: 'sabcrm:manage',
  /** Can manage the data model — objects, fields, views (Twenty settings). */
  ADMIN: 'sabcrm:admin',
} as const;

export type SabcrmRbacKey =
  (typeof SABCRM_RBAC_KEYS)[keyof typeof SABCRM_RBAC_KEYS];
