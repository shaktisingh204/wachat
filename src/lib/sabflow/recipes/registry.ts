/**
 * SabFlow Recipe Registry.
 *
 * Recipes register themselves with `registerRecipe()` (typically at module
 * import time).  `instantiateRecipe()` clones a recipe into a fresh
 * `SabFlowDoc` ready to be persisted by `saveSabFlow()`.
 *
 * The registry is an in-memory map — because recipes are code-defined this
 * is fine for cluster deployments (every Node process has the same set).
 */

import type {
  SabFlowDoc,
  Block,
  Group,
  Edge,
  SabFlowEvent,
  Coordinates,
} from '@/lib/sabflow/types';
import type { Recipe } from './types';

/* ── Registry storage ───────────────────────────────────── */

const recipeMap = new Map<string, Recipe>();

/** Register a recipe.  Re-registering the same id silently overwrites. */
export function registerRecipe(recipe: Recipe): void {
  recipeMap.set(recipe.id, recipe);
}

/** Returns every registered recipe in insertion order. */
export function listRecipes(): Recipe[] {
  return Array.from(recipeMap.values());
}

/** Returns a recipe by id, or `undefined` when not found. */
export function getRecipe(id: string): Recipe | undefined {
  return recipeMap.get(id);
}

/* ── Helpers ────────────────────────────────────────────── */

/**
 * Generates a short random id suffix.  Recipes intentionally use stable ids
 * inside their definition so we can freely re-clone them — but every
 * instantiation needs *fresh* block/group/edge ids so two flows built from
 * the same recipe don't collide in storage.
 */
function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Lays groups out left-to-right on the canvas with a fixed horizontal
 * stride.  This matches the n8n-style canvas the engine ports use today.
 */
function layoutCoords(index: number): Coordinates {
  return { x: 200 + index * 320, y: 200 };
}

/**
 * Materialise a recipe into a `SabFlowDoc` for the given tenant.
 *
 * - Every block / group / edge id is regenerated to avoid collisions.
 * - The trigger event keeps its options but gets a fresh id and an outgoing
 *   edge wired to the first group.
 * - `userId` is the tenant identifier used by the rest of the SabFlow code
 *   (see `getSabFlowsByUserId`).  Multi-tenancy lives one layer up — we
 *   simply stamp it onto the document.
 */
export function instantiateRecipe(
  recipeId: string,
  tenantId: string,
): SabFlowDoc | null {
  const recipe = recipeMap.get(recipeId);
  if (!recipe) return null;

  // Map old groupId → new groupId so edges remain consistent.
  const groupIdMap = new Map<string, string>();
  // Map old blockId → new blockId for edge translation.
  const blockIdMap = new Map<string, string>();

  // Collect the distinct groupIds in the order they first appear.
  const orderedGroupIds: string[] = [];
  for (const block of recipe.blocks) {
    if (!groupIdMap.has(block.groupId)) {
      const newId = `g_${shortId()}`;
      groupIdMap.set(block.groupId, newId);
      orderedGroupIds.push(block.groupId);
    }
  }

  // Build groups with re-keyed blocks.
  const groups: Group[] = orderedGroupIds.map((oldId, idx) => {
    const newGroupId = groupIdMap.get(oldId)!;
    const blocks: Block[] = recipe.blocks
      .filter((b) => b.groupId === oldId)
      .map((b) => {
        const newBlockId = `b_${shortId()}`;
        blockIdMap.set(b.id, newBlockId);
        return {
          ...b,
          id: newBlockId,
          groupId: newGroupId,
        } as Block;
      });

    return {
      id: newGroupId,
      title: `Step ${idx + 1}`,
      graphCoordinates: layoutCoords(idx),
      blocks,
    };
  });

  // Wire sequential edges between groups (first-block → next-group).
  // Recipes describe a linear pipeline; for branchy recipes, authors can
  // supply additional edges via a follow-up extension point.
  const edges: Edge[] = [];
  for (let i = 0; i < orderedGroupIds.length - 1; i++) {
    const fromGroupId = groupIdMap.get(orderedGroupIds[i])!;
    const toGroupId = groupIdMap.get(orderedGroupIds[i + 1])!;
    edges.push({
      id: `e_${shortId()}`,
      from: { groupId: fromGroupId },
      to: { groupId: toGroupId },
    });
  }

  // Re-key trigger and wire its outgoing edge to the first group.
  const newTriggerId = `t_${shortId()}`;
  const trigger: SabFlowEvent = {
    ...recipe.trigger,
    id: newTriggerId,
    graphCoordinates: { x: 80, y: 200 },
  };
  if (orderedGroupIds.length > 0) {
    const firstGroupId = groupIdMap.get(orderedGroupIds[0])!;
    edges.unshift({
      id: `e_${shortId()}`,
      from: { eventId: newTriggerId },
      to: { groupId: firstGroupId },
    });
  }

  const now = new Date();
  const doc: SabFlowDoc = {
    userId: tenantId,
    name: recipe.name,
    events: [trigger],
    groups,
    edges,
    variables: recipe.variables.map((v) => ({ ...v })),
    annotations: [],
    theme: {},
    settings: {
      description: recipe.description,
    },
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
  };

  return doc;
}

/* ── Built-in recipe imports ────────────────────────────── */
//
// Importing the recipe modules here ensures each one calls
// `registerRecipe()` at startup.  Side-effect imports keep the public
// surface clean (consumers just `import { listRecipes }` and they're set).

import './lead-to-whatsapp-welcome';
import './abandoned-cart';
import './ad-spend-alert';
import './welcome-onboarding';
import './payment-received';
