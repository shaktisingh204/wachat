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
import { LuLoader, LuStore } from 'react-icons/lu';

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
    <div className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-800 bg-zinc-950 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900">
            <LuStore className="h-4.5 w-4.5 text-zinc-300" strokeWidth={1.7} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold text-zinc-100 leading-tight">
              Template Marketplace
            </h1>
            <p className="text-[12px] text-zinc-500 mt-0.5">
              Browse ready-made workflow templates and install them into your workspace.
            </p>
          </div>
        </div>
      </header>

      {/* ── Browse grid ──────────────────────────────────────────────────── */}
      <main className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full">
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center">
              <LuLoader className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          }
        >
          <MarketplaceBrowseClient templates={templates} />
        </Suspense>
      </main>
    </div>
  );
}
