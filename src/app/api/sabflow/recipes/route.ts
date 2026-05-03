/**
 * SabFlow Recipes API.
 *
 *  GET  /api/sabflow/recipes
 *    Returns the catalogue of recipes grouped by category, plus a flat
 *    list for client-side search.
 *
 *  POST /api/sabflow/recipes
 *    Body: { recipeId: string }
 *    Instantiates the recipe into a fresh draft flow owned by the
 *    authenticated user and returns its id.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { saveSabFlow } from '@/lib/sabflow/db';
import {
  instantiateRecipe,
  listRecipes,
  getRecipe,
} from '@/lib/sabflow/recipes/registry';
import { listTemplateCategories } from '@/lib/sabflow/templates';

export const dynamic = 'force-dynamic';

/* ── GET — list recipes ─────────────────────────────────── */

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  // The list endpoint is safe to expose without further plan / RBAC gating
  // — it returns marketing-style metadata only.  Instantiation (POST) is
  // where tenant scoping matters.
  const flat = listRecipes().map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    tags: r.tags,
  }));

  const categories = listTemplateCategories().map((g) => ({
    id: g.id,
    label: g.label,
    description: g.description,
    recipes: g.recipes.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      tags: r.tags,
    })),
  }));

  return NextResponse.json({ recipes: flat, categories });
}

/* ── POST — instantiate ─────────────────────────────────── */

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  let body: { recipeId?: string };
  try {
    body = (await req.json()) as { recipeId?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { recipeId } = body;
  if (!recipeId || typeof recipeId !== 'string') {
    return NextResponse.json(
      { error: '`recipeId` is required' },
      { status: 400 },
    );
  }

  if (!getRecipe(recipeId)) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  const tenantId = session.user.id;
  const doc = instantiateRecipe(recipeId, tenantId);
  if (!doc) {
    return NextResponse.json(
      { error: 'Failed to instantiate recipe' },
      { status: 500 },
    );
  }

  try {
    await saveSabFlow(doc);
  } catch (err) {
    console.error('[SABFLOW RECIPES] saveSabFlow error:', err);
    return NextResponse.json(
      { error: 'Failed to persist new flow' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    flowId: doc._id?.toHexString(),
    name: doc.name,
    recipeId,
  });
}
