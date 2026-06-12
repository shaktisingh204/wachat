/**
 * Shared types for the SabCRM assignment-routing server actions.
 *
 * `sabcrm-routing.actions.ts` is a `'use server'` module, so every export
 * there must be an async function — these non-async types live here instead
 * (the same split as `sabcrm-stage-gates.actions.types.ts`).
 */

import type {
  SabcrmRoutingCondition,
  SabcrmRoutingStrategy,
  SabcrmRoutingTrigger,
} from '@/lib/rust-client/sabcrm-routing';

/** Input to `createSabcrmRoutingRule` — the builder's rule draft. */
export interface SabcrmRoutingRuleBuilderInput {
  /** Human label — required, non-empty. */
  name: string;
  /** Funnel object slug the rule targets (e.g. `"leads"`). */
  objectSlug: string;
  /** What fires the rule. Defaults to `record.created` server-side. */
  trigger?: SabcrmRoutingTrigger;
  /**
   * Conditions ANDed against the record `data` (workflow condition model —
   * `eq` / `ne` / `in` / `contains` / ...). Defaults to `[]` (match all).
   */
  conditions?: SabcrmRoutingCondition[];
  /** Assignee-picking strategy. Defaults to `round_robin` server-side. */
  strategy?: SabcrmRoutingStrategy;
  /** Member user-ids assignment rotates over — required, non-empty. */
  assignees: string[];
  /** Record `data.<key>` the assignee is written to. Defaults to `owner`. */
  assignField?: string;
  /** Whether the rule participates in evaluation. Defaults to `true`. */
  active?: boolean;
  /** Priority order — lower runs first. Defaults to `0`. */
  position?: number;
}

/** Flattened partial patch for `updateSabcrmRoutingRule`. */
export interface SabcrmRoutingRulePatchInput {
  name?: string;
  objectSlug?: string;
  trigger?: SabcrmRoutingTrigger;
  conditions?: SabcrmRoutingCondition[];
  strategy?: SabcrmRoutingStrategy;
  assignees?: string[];
  assignField?: string;
  active?: boolean;
  position?: number;
}
