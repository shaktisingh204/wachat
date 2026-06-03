/**
 * SabCRM Dashboards — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the dashboards actions surface to their (client) callers lives
 * in this plain sibling module. Importing it has no runtime cost.
 *
 * These wrap the Rust dashboards client wire shapes
 * (`@/lib/rust-client/sabcrm-dashboards`).
 */

import type {
  SabcrmDashboardCreateInput,
  SabcrmDashboardUpdateInput,
} from '@/lib/rust-client/sabcrm-dashboards';

export type {
  SabcrmRustDashboard,
  SabcrmRustWidget,
  SabcrmDashboardCreateInput,
  SabcrmDashboardUpdateInput,
} from '@/lib/rust-client/sabcrm-dashboards';

/** Input accepted by {@link createDashboardTw}. */
export type CreateDashboardTwInput = SabcrmDashboardCreateInput;

/** Partial patch accepted by {@link updateDashboardTw}. */
export type UpdateDashboardTwPatch = SabcrmDashboardUpdateInput;
