/**
 * /dashboard/sabflow/marketplace — C.10.5 browse UX rebuild.
 *
 * Server component:
 *  - Authenticates the request (redirects to login if unauthenticated).
 *  - Fetches `published` templates from `sabflow_marketplace_templates`
 *    (the canonical Mongo collection registered in
 *    `src/lib/sabflow/marketplace/templates.ts`) and MERGES them with the
 *    always-available code-defined registry (built-in recipes + chatbots).
 *    The Mongo collection is empty on fresh installs, so without the registry
 *    merge the grid renders "No templates found". This mirrors the merge in
 *    `GET /api/sabflow/marketplace/templates`.
 *  - Serialises the minimal "summary" slice and passes it to the
 *    interactive `MarketplaceBrowseClient` component.
 *
 * All filtering, sorting, and pagination happen client-side — the
 * collection size is small enough that a single fetch + local slice
 * is faster than round-tripping to the server for every filter change.
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { Spinner } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';
import { getSession } from '@/app/actions/user.actions';
import { getMarketplaceTemplatesCollection } from '@/lib/sabflow/marketplace/templates';
import { MarketplaceBrowseClient } from '@/components/sabflow/marketplace/MarketplaceBrowseClient';
import type { TemplateCardData } from '@/components/sabflow/marketplace/TemplateCard';
import type { MarketplaceComplexity } from '@/components/sabflow/marketplace/MarketplaceFilters';
import {
  getTemplateRegistry,
  type ManifestCategory,
  type TemplateManifest,
} from '@/lib/sabflow/marketplace/registry';
// Side-effect bootstraps that populate the in-memory template registry: every
// built-in recipe + chatbot registers itself at import time. Without these the
// registry getter returns an empty list. (Same imports the
// `/api/sabflow/marketplace/templates` route uses.)
import '@/lib/sabflow/recipes';
import '@/components/sabflow/templates';

export const dynamic = 'force-dynamic';

/* ── Normalisation helpers ──────────────────────────────────────────────── */

/**
 * Coerce any-cased complexity (`'advanced'`, `'Advanced'`) onto the PascalCase
 * values the filter UI uses. Registry manifests are lowercase and some Mongo
 * rows may be too, so without this the complexity filter silently drops every
 * card (`'advanced' !== 'Advanced'`).
 */
function normaliseComplexity(raw: unknown): MarketplaceComplexity | undefined {
  if (typeof raw !== 'string') return undefined;
  switch (raw.toLowerCase()) {
    case 'starter':
      return 'Starter';
    case 'intermediate':
      return 'Intermediate';
    case 'advanced':
      return 'Advanced';
    default:
      return undefined;
  }
}

/**
 * Display label for a registry manifest category. Each value is also a key the
 * browse filter's `normaliseCategoryForFilter` understands, so the card badge
 * and the active filter chip stay in sync.
 */
const MANIFEST_CATEGORY_LABEL: Record<ManifestCategory, string> = {
  data: 'Data',
  communication: 'Communication',
  devops: 'DevOps',
  finance: 'Finance',
  productivity: 'Productivity',
  chatbot: 'Communication',
  crm: 'CRM',
  other: 'Productivity',
};

/** Map a code-defined registry manifest onto the browse card shape. */
function manifestToCardData(m: TemplateManifest): TemplateCardData {
  return {
    slug: m.id,
    name: m.name,
    description: m.description,
    category: MANIFEST_CATEGORY_LABEL[m.category] ?? 'Productivity',
    complexity: normaliseComplexity(m.complexity),
    installCount: 0,
    author: m.authorName ? { displayName: m.authorName } : undefined,
  };
}

/**
 * Snapshot of the code-defined first-party templates (recipes + chatbots).
 * Synchronous: the registry is fully populated by the side-effect imports
 * above. Wrapped defensively so a registry hiccup can't blank the page.
 */
function loadRegistryTemplates(): TemplateCardData[] {
  try {
    return getTemplateRegistry().map(manifestToCardData);
  } catch {
    return [];
  }
}

/* ── Data helpers ───────────────────────────────────────────────────────── */

/**
 * Fetches the summary slice used by the browse grid.
 *
 * We project only the fields needed by `TemplateCardData` to keep the
 * payload lean. The flow body (groups, blocks, edges) is intentionally
 * excluded — it is only fetched at install time.
 */
async function fetchPublishedTemplates(): Promise<TemplateCardData[]> {
  try {
    const col = await getMarketplaceTemplatesCollection();
    const docs = await col
      .find(
        { status: 'published' },
        {
          projection: {
            slug: 1,
            name: 1,
            description: 1,
            categories: 1,
            author: 1,
            installCount: 1,
            rating: 1,
            complexity: 1,
          },
        },
      )
      .sort({ installCount: -1 })
      .toArray();

    return docs.map((doc): TemplateCardData => ({
      slug: doc.slug,
      name: doc.name,
      description: doc.description,
      // Use the first category in the array, falling back to 'Productivity'.
      category: Array.isArray(doc.categories) && doc.categories.length > 0
        ? doc.categories[0]
        : 'Productivity',
      complexity: normaliseComplexity((doc as { complexity?: unknown }).complexity),
      installCount: doc.installCount ?? 0,
      rating: doc.rating,
      author: doc.author
        ? {
            displayName: doc.author.displayName,
            avatarUrl: doc.author.avatarUrl,
          }
        : undefined,
    }));
  } catch {
    // Return an empty list rather than crashing the page when the collection
    // doesn't exist yet (e.g. fresh dev environment).
    return [];
  }
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default async function SabFlowMarketplacePage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }

  // Published community/curated rows from Mongo (usually empty in dev) merged
  // with the always-available code-defined registry templates, deduped by slug
  // (Mongo wins on conflict). Mirrors the merge in
  // `GET /api/sabflow/marketplace/templates` so the grid and the API agree.
  const mongoTemplates = await fetchPublishedTemplates();
  const seen = new Set(mongoTemplates.map((t) => t.slug));
  const templates = [
    ...mongoTemplates,
    ...loadRegistryTemplates().filter((t) => !seen.has(t.slug)),
  ];

  return (
    <SabflowPage
      breadcrumb={[...SABFLOW_CRUMBS, { label: 'Marketplace' }]}
      title="Template Marketplace"
      description="Browse ready-made workflow templates and install them into your workspace."
    >
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Spinner label="Loading templates" />
          </div>
        }
      >
        <MarketplaceBrowseClient templates={templates} />
      </Suspense>
    </SabflowPage>
  );
}
