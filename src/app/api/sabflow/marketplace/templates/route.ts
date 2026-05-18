/**
 * GET /api/sabflow/marketplace/templates
 *
 * Phase C.10.8 — unified template registry browse endpoint.
 *
 * Returns a paginated, filterable list of templates drawn from the unified
 * registry (`@/lib/sabflow/marketplace/registry`).  Both chatbot and recipe
 * templates are returned; callers can filter by kind, category, complexity,
 * or free-text search.
 *
 * The response first tries the Mongo `sabflow_marketplace_templates` collection
 * for any **published** rows (partner-submitted templates curated via the admin
 * review queue in C.10.3).  Code-defined first-party templates (chatbot +
 * recipe seed-packs) are always included via the unified in-memory registry
 * and are merged *after* the Mongo rows so community templates surface first
 * when both sets match the same query.
 *
 * Query params
 * ────────────
 * | param      | type                      | default | notes                          |
 * |------------|---------------------------|---------|--------------------------------|
 * | category   | ManifestCategory string   | —       | filter by manifest category    |
 * | complexity | starter│intermediate│adv. | —       | filter by complexity tier      |
 * | kind       | chatbot│recipe            | —       | filter by template kind        |
 * | q          | string                    | —       | full-text search (name+desc+tags)|
 * | page       | integer ≥ 1               | 1       | 1-indexed page number          |
 * | limit      | integer 1–100             | 12      | items per page                 |
 *
 * Response
 * ────────
 * ```jsonc
 * {
 *   "templates": TemplateManifest[],
 *   "total": number,       // total matched items (before pagination)
 *   "page": number,
 *   "limit": number,
 *   "pages": number        // ceil(total / limit)
 * }
 * ```
 *
 * Auth: requires a valid session.  Listing templates is safe to expose to any
 * authenticated user; install is gated separately via the install endpoint.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getSession } from '@/app/actions/user.actions';
import {
  getTemplateRegistry,
  type TemplateManifest,
  type ManifestCategory,
} from '@/lib/sabflow/marketplace/registry';
// Bootstrap the recipe seed-packs so the registry is populated on first call.
// This import is a side-effect — it registers all built-in recipes.
import '@/lib/sabflow/recipes';
// Bootstrap the chatbot templates likewise.
import '@/components/sabflow/templates';
import {
  getMarketplaceTemplatesCollection,
  type MarketplaceTemplate,
} from '@/lib/sabflow/marketplace/templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── Types ─────────────────────────────────────────────────────────────── */

const VALID_COMPLEXITY = new Set(['starter', 'intermediate', 'advanced']);
const VALID_KIND = new Set(['chatbot', 'recipe']);

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** Convert a Mongo `MarketplaceTemplate` row to a `TemplateManifest`. */
function mongoRowToManifest(row: MarketplaceTemplate): TemplateManifest {
  // Derive category: use first entry from `categories[]`, defaulting to 'other'.
  const rawCat = (row.categories ?? [])[0] ?? 'other';
  // Mongo rows use the ManifestCategory vocabulary directly (populated by
  // the admin publish flow).  Pass through with a safe fallback.
  const manifestCategories: ManifestCategory[] = [
    'data', 'communication', 'devops', 'finance',
    'productivity', 'chatbot', 'crm', 'other',
  ];
  const category: ManifestCategory = manifestCategories.includes(
    rawCat as ManifestCategory,
  )
    ? (rawCat as ManifestCategory)
    : 'other';

  return {
    id: row.slug,
    name: row.name,
    description: row.description,
    category,
    complexity: 'intermediate', // Mongo rows don't carry complexity yet; default.
    tags: row.tags ?? [],
    flowJsonPath: `/${row.slug}.json`,
    thumbnailUrl: undefined,
    authorName: row.author?.displayName ?? 'SabNode',
    kind: 'recipe', // All Mongo-published rows are workflow recipes.
  };
}

/**
 * Attempt to fetch published Mongo templates.  Returns an empty array on
 * any error so the route never fails just because the collection is empty
 * or the DB is unavailable during early setup.
 */
async function fetchMongoTemplates(): Promise<TemplateManifest[]> {
  try {
    const col = await getMarketplaceTemplatesCollection();
    const rows = await col
      .find({ status: 'published' }, { projection: {
        slug: 1, name: 1, description: 1, categories: 1, tags: 1,
        author: 1, installCount: 1, rating: 1,
      } })
      .limit(500)
      .toArray();
    return rows.map(mongoRowToManifest);
  } catch {
    // Collection may not exist yet in dev / fresh deployments — fail silently.
    return [];
  }
}

/* ── Route handler ─────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const tag = '[SABFLOW MARKETPLACE TEMPLATES]';

  /* ── Auth ─────────────────────────────────────────────────────────── */
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  /* ── Parse query params ───────────────────────────────────────────── */
  // Use `new URL(req.url).searchParams` — the synchronous URL API used
  // consistently across all SabFlow Route Handlers.  The async `searchParams`
  // prop only applies to page/layout components in Next.js 16, not to Route
  // Handlers where the request URL is always available synchronously.
  const { searchParams } = new URL(request.url);

  const categoryParam = searchParams.get('category') ?? undefined;
  const complexityParam = searchParams.get('complexity') ?? undefined;
  const kindParam = searchParams.get('kind') ?? undefined;
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
  const rawLimit = parseInt(searchParams.get('limit') ?? '12', 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 && rawLimit <= 100
    ? rawLimit
    : 12;

  console.info(
    `${tag} GET category=${categoryParam ?? '*'} complexity=${complexityParam ?? '*'} ` +
    `kind=${kindParam ?? '*'} q="${q}" page=${page} limit=${limit}`,
  );

  /* ── Build candidate list ─────────────────────────────────────────── */

  // 1. Published Mongo rows (community / curated templates).
  const mongoTemplates = await fetchMongoTemplates();

  // 2. Code-defined first-party templates from the unified in-memory registry.
  const codeTemplates = getTemplateRegistry();

  // Merge: Mongo rows first, then code-defined ones that don't already exist
  // in the Mongo set (deduplicate by id/slug).
  const mongoIds = new Set(mongoTemplates.map((t) => t.id));
  const merged: TemplateManifest[] = [
    ...mongoTemplates,
    ...codeTemplates.filter((t) => !mongoIds.has(t.id)),
  ];

  /* ── Filter ───────────────────────────────────────────────────────── */

  let filtered = merged;

  if (categoryParam) {
    const cat = categoryParam as ManifestCategory;
    filtered = filtered.filter((t) => t.category === cat);
  }

  if (complexityParam && VALID_COMPLEXITY.has(complexityParam)) {
    const complexity = complexityParam as TemplateManifest['complexity'];
    filtered = filtered.filter((t) => t.complexity === complexity);
  }

  if (kindParam && VALID_KIND.has(kindParam)) {
    const kind = kindParam as 'chatbot' | 'recipe';
    filtered = filtered.filter((t) => t.kind === kind);
  }

  if (q) {
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }

  /* ── Paginate ─────────────────────────────────────────────────────── */

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const templates = filtered.slice(offset, offset + limit);

  return NextResponse.json({
    templates,
    total,
    page,
    limit,
    pages,
  });
}
