/**
 * SabCRM Targets — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the targets actions surface to their (client) callers lives
 * in this plain sibling module. Importing it has no runtime cost.
 *
 * These re-export the Rust targets client wire shapes
 * (`@/lib/rust-client/sabcrm-targets`) consumed by the note / task
 * relation pickers on the Twenty-faithful record pages.
 */

export type {
  SabcrmQuotaCreateInput,
  SabcrmQuotaListOpts,
  SabcrmQuotaMetric,
  SabcrmQuotaPeriod,
  SabcrmQuotaUpdateInput,
  SabcrmRustQuota,
  SabcrmRustTarget,
} from '@/lib/rust-client/sabcrm-targets';
