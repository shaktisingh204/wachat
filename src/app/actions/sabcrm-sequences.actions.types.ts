/**
 * Shared types for the SabCRM sequence (cadence) server actions.
 *
 * `sabcrm-sequences.actions.ts` is a `'use server'` module, so every export
 * there must be an async function — these non-async types live here instead
 * (the same split as `sabcrm-stage-gates.actions.types.ts`).
 */

import type {
  SabcrmSequenceSettings,
  SabcrmSequenceStatus,
  SabcrmSequenceStep,
} from '@/lib/rust-client/sabcrm-sequences';

/** Input to `createSabcrmSequence` — the builder's sequence draft. */
export interface SabcrmSequenceBuilderInput {
  /** Human label — required, non-empty. */
  name: string;
  /** Ordered email / task / wait steps. Defaults to `[]`. */
  steps?: SabcrmSequenceStep[];
  /** Behaviour switches. `unenrollOnReply` defaults to `true` server-side. */
  settings?: Partial<SabcrmSequenceSettings>;
  /** Lifecycle status — `active` (default) / `paused`. */
  status?: SabcrmSequenceStatus;
}

/** Flattened partial patch for `updateSabcrmSequence`. */
export interface SabcrmSequencePatchInput {
  name?: string;
  status?: SabcrmSequenceStatus;
  steps?: SabcrmSequenceStep[];
  settings?: Partial<SabcrmSequenceSettings>;
}

/** Input to `enrollSabcrmSequence` — enroll record(s) into one sequence. */
export interface SabcrmSequenceEnrollInput {
  /** The sequence to enroll into. */
  sequenceId: string;
  /** Funnel object slug the records belong to (e.g. `"leads"`). */
  objectSlug: string;
  /** Records to enroll (already-active enrollments are skipped). */
  recordIds: string[];
}
