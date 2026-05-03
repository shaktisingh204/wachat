/**
 * SabFlow templates — gallery view.
 *
 * Groups every registered recipe by its `category`, producing the
 * structure the template-picker UI expects.  Recipes themselves live in
 * `src/lib/sabflow/recipes/` — this module is a thin presentation layer.
 */

import { listRecipes } from '@/lib/sabflow/recipes';
import type { Recipe, RecipeCategory } from '@/lib/sabflow/recipes/types';

export type TemplateCategoryGroup = {
  /** Stable category id, e.g. "ecommerce". */
  id: RecipeCategory;
  /** Display label for the gallery sidebar. */
  label: string;
  /** Short tagline shown beneath the label. */
  description: string;
  /** Recipes in this category. */
  recipes: Recipe[];
};

const CATEGORY_LABELS: Record<RecipeCategory, { label: string; description: string }> = {
  sales: {
    label: 'Sales',
    description: 'Pipeline, follow-ups, and deal automations.',
  },
  marketing: {
    label: 'Marketing',
    description: 'Campaigns, nurturing, and broadcast flows.',
  },
  support: {
    label: 'Support',
    description: 'Ticket triage and customer reply automation.',
  },
  ops: {
    label: 'Operations',
    description: 'Internal alerts, syncs, and approvals.',
  },
  finance: {
    label: 'Finance',
    description: 'Payments, receipts, and reconciliation.',
  },
  crm: {
    label: 'CRM',
    description: 'Lead routing and contact lifecycle.',
  },
  whatsapp: {
    label: 'WhatsApp',
    description: 'Templates, sessions and inbox automations.',
  },
  ecommerce: {
    label: 'E-commerce',
    description: 'Cart recovery, order updates, retention.',
  },
  ads: {
    label: 'Ads',
    description: 'Spend monitoring and performance alerts.',
  },
  onboarding: {
    label: 'Onboarding',
    description: 'New-customer drip sequences and activation.',
  },
};

/**
 * Returns the full list of categories (with their recipes) in the order
 * defined by `CATEGORY_LABELS`.  Empty categories are omitted so the
 * gallery doesn't render blank sections.
 */
export function listTemplateCategories(): TemplateCategoryGroup[] {
  const allRecipes = listRecipes();
  const byCategory = new Map<RecipeCategory, Recipe[]>();

  for (const recipe of allRecipes) {
    const list = byCategory.get(recipe.category) ?? [];
    list.push(recipe);
    byCategory.set(recipe.category, list);
  }

  const groups: TemplateCategoryGroup[] = [];
  for (const [id, meta] of Object.entries(CATEGORY_LABELS) as [
    RecipeCategory,
    { label: string; description: string },
  ][]) {
    const recipes = byCategory.get(id);
    if (!recipes || recipes.length === 0) continue;
    groups.push({
      id,
      label: meta.label,
      description: meta.description,
      recipes,
    });
  }

  return groups;
}

/** Convenience — flat list of every template, useful for search. */
export function listAllTemplates(): Recipe[] {
  return listRecipes();
}
