/**
 * SabFlow Recipes — type definitions.
 *
 * A "recipe" is a pre-built workflow template that can be instantiated into
 * a fresh `SabFlowDoc` for any tenant.  Recipes ship as code and are
 * registered in `registry.ts` so they show up in the template gallery.
 *
 * Recipes intentionally re-use the existing `Block`, `SabFlowEvent`, and
 * `Variable` shapes from `src/lib/sabflow/types.ts` — there is no separate
 * runtime schema.
 */

import type { Block, SabFlowEvent, Variable } from '@/lib/sabflow/types';

/**
 * High-level grouping shown in the gallery sidebar.  Adding a new category
 * is a one-line change here.
 */
export type RecipeCategory =
  | 'sales'
  | 'marketing'
  | 'support'
  | 'ops'
  | 'finance'
  | 'crm'
  | 'whatsapp'
  | 'ecommerce'
  | 'ads'
  | 'onboarding';

/**
 * A single block reference inside a recipe.
 *
 * Recipes describe the graph in a flat list — `groupId` is the logical
 * "step" the block belongs to.  When the recipe is instantiated, the
 * registry collects every distinct `groupId` and creates a `Group` for it,
 * laying them out left-to-right on the canvas.
 */
export type SabFlowBlock = Block;

/** Declarative recipe shape — pure data, no behaviour. */
export type Recipe = {
  /** Stable id used to look up the recipe (e.g. "lead-to-whatsapp-welcome"). */
  id: string;
  /** Display name shown in the gallery. */
  name: string;
  /** Gallery grouping. */
  category: RecipeCategory;
  /** Short marketing-style description (1–3 sentences). */
  description: string;
  /** The trigger event that starts this recipe. */
  trigger: SabFlowEvent;
  /** Ordered list of blocks; `groupId` clusters blocks into canvas groups. */
  blocks: SabFlowBlock[];
  /** Variables exposed by the recipe (visible in the variable panel). */
  variables: Variable[];
  /** Free-form labels for search / filtering. */
  tags: string[];
};
