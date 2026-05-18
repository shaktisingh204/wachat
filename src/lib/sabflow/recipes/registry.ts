/**
 * SabFlow Recipe Registry.
 *
 * Recipes register themselves with `registerRecipe()` (typically at module
 * import time).  `instantiateRecipe()` clones a recipe into a fresh
 * `SabFlowDoc` ready to be persisted by `saveSabFlow()`.
 *
 * Phase C.10.8 #8 — this module is now a **backwards-compat wrapper** around
 * the unified marketplace registry at `@/lib/sabflow/marketplace/registry`.
 * Existing call-sites (the seed-pack files, the API route, the recipes API)
 * continue to import from here unchanged; under the hood we adapt each
 * `Recipe` into a canonical `Template` and store it in the single map.
 */

import type { SabFlowDoc } from '@/lib/sabflow/types';
import type { Recipe } from './types';
import {
  registerTemplate,
  getTemplate,
  listTemplates,
  instantiateRecipeTemplate,
  normaliseCategory,
  extractRequiredCredentials,
  FIRST_PARTY_PUBLISHER,
  type Template,
} from '@/lib/sabflow/marketplace/registry';

/* ── Adapters ───────────────────────────────────────────── */

/** Convert a legacy `Recipe` into the canonical `Template` shape. */
function recipeToTemplate(recipe: Recipe): Template {
  return {
    id: recipe.id,
    slug: recipe.id,
    displayName: recipe.name,
    description: recipe.description,
    category: normaliseCategory(recipe.category),
    tags: [...recipe.tags],
    requiredCredentials: extractRequiredCredentials(recipe.blocks),
    screenshots: [],
    version: '1.0.0',
    publisher: FIRST_PARTY_PUBLISHER,
    installCount: 0,
    kind: 'recipe',
    flow: {
      trigger: recipe.trigger,
      blocks: recipe.blocks,
      variables: recipe.variables,
    },
  };
}

/** Re-derive the legacy `Recipe` shape from a stored `Template`.  Keeps the
 *  public API of `listRecipes()` / `getRecipe()` byte-compatible with what
 *  the API route + the seed-pack tests expect today. */
function templateToRecipe(t: Template): Recipe | undefined {
  if (t.kind !== 'recipe' || !t.flow) return undefined;
  return {
    id: t.id,
    name: t.displayName,
    // Down-cast: the legacy enum is a closed string union; the unified
    // categories are a superset.  Callers that compare against the recipe
    // enum still get a string that matches one of the legacy values (the
    // chatbot-only buckets like `'Health'` never apply to recipes).
    category: legacyRecipeCategory(t.category),
    description: t.description,
    trigger: t.flow.trigger,
    blocks: t.flow.blocks,
    variables: t.flow.variables,
    tags: t.tags,
  };
}

/** Map canonical category back to the legacy `RecipeCategory` string. */
function legacyRecipeCategory(c: string): Recipe['category'] {
  const back: Record<string, Recipe['category']> = {
    Sales: 'sales',
    Marketing: 'marketing',
    Support: 'support',
    Ops: 'ops',
    Finance: 'finance',
    CRM: 'crm',
    WhatsApp: 'whatsapp',
    'E-commerce': 'ecommerce',
    Ads: 'ads',
    Onboarding: 'onboarding',
  };
  return back[c] ?? 'ops';
}

/* ── Public API (backwards-compatible) ──────────────────── */

/** Register a recipe.  Re-registering the same id silently overwrites. */
export function registerRecipe(recipe: Recipe): void {
  registerTemplate(recipeToTemplate(recipe));
}

/** Returns every registered recipe in insertion order. */
export function listRecipes(): Recipe[] {
  const out: Recipe[] = [];
  for (const t of listTemplates()) {
    const r = templateToRecipe(t);
    if (r) out.push(r);
  }
  return out;
}

/** Returns a recipe by id, or `undefined` when not found. */
export function getRecipe(id: string): Recipe | undefined {
  const t = getTemplate(id);
  if (!t) return undefined;
  return templateToRecipe(t);
}

/**
 * Materialise a recipe into a `SabFlowDoc` for the given tenant.
 * Delegates to the unified registry — identical id-rekeying semantics as
 * before.
 */
export function instantiateRecipe(
  recipeId: string,
  tenantId: string,
): SabFlowDoc | null {
  return instantiateRecipeTemplate(recipeId, tenantId);
}

// Built-in recipe modules used to be side-effect-imported here. That created
// a circular import (recipe → registry → recipe) which crashes at module
// init under bundlers that hoist imports strictly: the recipe runs
// `registerRecipe(...)` while `recipeMap` is still in the TDZ. The bootstrap
// imports now live in `./index.ts` — consumers should import from
// `@/lib/sabflow/recipes` (the package entry), not directly from `registry`.
