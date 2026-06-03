/**
 * SabCRM Pipelines — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the pipelines actions surface to their (client) callers lives
 * in this plain sibling module. Importing it has no runtime cost.
 *
 * These wrap the Rust pipelines client wire shapes
 * (`@/lib/rust-client/sabcrm-pipelines`) into the small, serialisable payloads
 * the SabCRM pipeline editor consumes.
 */

import type {
  SabcrmRustPipeline,
  SabcrmPipelineCreateInput,
  SabcrmPipelineUpdateInput,
} from '@/lib/rust-client/sabcrm-pipelines';

export type {
  SabcrmRustPipeline,
  SabcrmRustPipelineStage,
  SabcrmPipelineCreateInput,
  SabcrmPipelineUpdateInput,
} from '@/lib/rust-client/sabcrm-pipelines';

/** Input accepted by {@link createPipelineTw} — the flattened pipeline doc. */
export type CreatePipelineTwInput = SabcrmPipelineCreateInput;

/** Partial patch accepted by {@link updatePipelineTw}. */
export type UpdatePipelineTwPatch = SabcrmPipelineUpdateInput;

/** Convenience re-export of the persisted pipeline shape. */
export type PipelineTw = SabcrmRustPipeline;
