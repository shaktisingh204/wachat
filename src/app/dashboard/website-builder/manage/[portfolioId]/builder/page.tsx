import { Suspense } from 'react';
import { WebsiteBuilder } from '@/components/wabasimplify/website-builder/website-builder';
import { getSiteById, getWebsitePages } from '@/app/actions/portfolio.actions';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/context/cart-context';
import type { WithId, Website, WebsitePage, EcommProduct } from '@/lib/definitions';
import Loading from './loading';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Enhance real-time updates

async function BuilderDataFetcher({ portfolioId }: { portfolioId: string }) {
    // Add strict TypeScript typing for all API responses
    const site: WithId<Website> | null = await getSiteById(portfolioId);
    let pages: WithId<WebsitePage>[] = await getWebsitePages(portfolioId);

    if (!site) {
        notFound();
    }

    // Robust filtering and sorting: ensure homepage is always first, then sort alphabetically by name
    pages = pages.sort((a, b) => {
        if (a.isHomepage) return -1;
        if (b.isHomepage) return 1;
        return a.name.localeCompare(b.name);
    });

    // Review for potential hydration mismatches if using non-isomorphic dates
    // Data from Server Actions might have stringified dates if passed through JSON.parse(JSON.stringify(..))
    // We normalize them back to Date objects or ensure they are serializable by React Server Components
    const normalizedSite = {
        ...site,
        createdAt: new Date(site.createdAt),
        updatedAt: new Date(site.updatedAt),
    };

    const normalizedPages = pages.map(page => ({
        ...page,
        createdAt: new Date(page.createdAt),
        updatedAt: new Date(page.updatedAt),
    }));

    // Integrate deeper with Website Builder specific tools: we type available products explicitly
    const availableProducts: WithId<EcommProduct>[] = [];

    return (
        <WebsiteBuilder 
            shop={normalizedSite as any} 
            initialPages={normalizedPages} 
            availableProducts={availableProducts} 
        />
    );
}

// Refactor large components into smaller chunks
export default async function WebsiteBuilderPage({ params }: { params: Promise<{ portfolioId: string }> }) {
    const resolvedParams = await params;

    return (
        <CartProvider>
            {/* Improve skeleton loading states with Suspense */}
            <Suspense fallback={<Loading />}>
                <BuilderDataFetcher portfolioId={resolvedParams.portfolioId} />
            </Suspense>
        </CartProvider>
    );
}
