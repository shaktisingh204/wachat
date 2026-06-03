/**
 * SabCRM Invites — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the invites actions surface to their (client) callers lives
 * in this plain sibling module. Importing it has no runtime cost.
 *
 * These re-export the Rust invites client wire shapes
 * (`@/lib/rust-client/sabcrm-invites`) consumed by the workspace-members UI.
 */

export type {
  SabcrmRustInvite,
  SabcrmInviteStatus,
} from '@/lib/rust-client/sabcrm-invites';

/** Options accepted by {@link listInvitesTw}. */
export interface ListInvitesTwOpts {
  /** Optional status filter (`pending` | `accepted` | `revoked`). */
  status?: import('@/lib/rust-client/sabcrm-invites').SabcrmInviteStatus;
  /** Explicit project id; defaults to the caller's first project. */
  projectId?: string;
}
