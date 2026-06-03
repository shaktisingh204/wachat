/**
 * SabCRM Workflows — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the workflows actions surface to their (client) callers lives
 * in this plain sibling module. Importing it has no runtime cost.
 *
 * These wrap the Rust workflows client wire shapes
 * (`@/lib/rust-client/sabcrm-workflows`) into the small, serialisable payloads
 * the automation UI consumes.
 */

import type {
  SabcrmWorkflowCreateInput,
  SabcrmWorkflowUpdateInput,
} from '@/lib/rust-client/sabcrm-workflows';

export type {
  SabcrmRustWorkflow,
  SabcrmWorkflowTrigger,
  SabcrmWorkflowStep,
  SabcrmWorkflowEvent,
  SabcrmWorkflowStepType,
  SabcrmWorkflowCreateInput,
  SabcrmWorkflowUpdateInput,
} from '@/lib/rust-client/sabcrm-workflows';

/** Input accepted by {@link createWorkflowTw} — the new workflow document. */
export type CreateWorkflowTwInput = SabcrmWorkflowCreateInput;

/** Partial patch accepted by {@link updateWorkflowTw}. */
export type UpdateWorkflowTwPatch = SabcrmWorkflowUpdateInput;
