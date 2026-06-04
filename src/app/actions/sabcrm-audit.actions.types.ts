/**
 * SabCRM Audit — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the audit actions surface to their (client) callers lives in
 * this plain sibling module. Importing it has no runtime cost.
 *
 * These re-export the Rust audit client wire shapes
 * (`@/lib/rust-client/sabcrm-audit`) that the change-log UI consumes.
 */

import type {
  SabcrmAuditListOpts,
  SabcrmAuditLogInput,
} from '@/lib/rust-client/sabcrm-audit';

export type {
  SabcrmRustAuditEntry,
  SabcrmAuditListOpts,
  SabcrmAuditLogInput,
  SabcrmAuditChainBreak,
  SabcrmAuditVerifyResult,
} from '@/lib/rust-client/sabcrm-audit';

/** Filters accepted by {@link listAuditTw}. */
export type ListAuditTwOpts = SabcrmAuditListOpts;

/** Input accepted by {@link logAuditTw}. */
export type LogAuditTwInput = SabcrmAuditLogInput;
