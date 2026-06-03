/**
 * SabCRM Workflow-Runs — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the workflow-runs actions surface to their (client) callers
 * lives in this plain sibling module. Importing it has no runtime cost.
 *
 * These re-export the Rust workflow-runs client wire shapes
 * (`@/lib/rust-client/sabcrm-workflow-runs`) for the run-history UI.
 */

import type {
  SabcrmWorkflowRunCreateInput,
  SabcrmWorkflowRunUpdateInput,
} from '@/lib/rust-client/sabcrm-workflow-runs';

export type {
  SabcrmRustWorkflowRun,
  SabcrmRustWorkflowRunStep,
  SabcrmWorkflowRunStatus,
  SabcrmWorkflowRunCreateInput,
  SabcrmWorkflowRunUpdateInput,
  SabcrmWorkflowRunListOpts,
} from '@/lib/rust-client/sabcrm-workflow-runs';

/** Input accepted by {@link createWorkflowRunTw} — the flattened run document. */
export type CreateWorkflowRunTwInput = SabcrmWorkflowRunCreateInput;

/** Partial patch accepted by {@link updateWorkflowRunTw}. */
export type UpdateWorkflowRunTwPatch = SabcrmWorkflowRunUpdateInput;
