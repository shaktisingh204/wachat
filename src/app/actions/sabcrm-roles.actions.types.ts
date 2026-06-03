/**
 * SabCRM Roles — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the roles actions surface to their (client) callers lives in
 * this plain sibling module. Importing it has no runtime cost.
 *
 * These re-export the Rust roles client wire shapes
 * (`@/lib/rust-client/sabcrm-roles`) the SabCRM roles/permissions admin
 * surface consumes.
 */

export type {
  SabcrmRustRole,
  SabcrmRoleCreateInput,
  SabcrmRoleUpdateInput,
} from '@/lib/rust-client/sabcrm-roles';

import type {
  SabcrmRoleCreateInput,
  SabcrmRoleUpdateInput,
} from '@/lib/rust-client/sabcrm-roles';

/** Input accepted by `createRoleTw` — the new role's fields. */
export type CreateRoleTwInput = SabcrmRoleCreateInput;

/** Partial patch accepted by `updateRoleTw`. */
export type UpdateRoleTwPatch = SabcrmRoleUpdateInput;
