/**
 * /dashboard/sabflow/marketplace — C.10.5 browse UX rebuild.
 *
 * Server component:
 *  - Authenticates the request (redirects to login if unauthenticated).
 *  - Fetches `published` templates from `sabflow_marketplace_templates`
 *    (the canonical Mongo collection registered in
 *    `src/lib/sabflow/marketplace/templates.ts`).
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

export const dynamic = 'force-dynamic';

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
      complexity: (doc as { complexity?: MarketplaceComplexity }).complexity ?? undefined,
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

  const templates = await fetchPublishedTemplates();

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
