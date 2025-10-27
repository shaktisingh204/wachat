
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getEcommShopBySlug, getPublicEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';

async function SearchResults({ slug, query }: { slug: string, query: string }) {
    const shop = await getEcommShopBySlug(slug);
    if (!shop) {
        notFound();
    }
    
    const products = await getPublicEcommProducts(shop._id.toString(), { searchQuery: query });
    const layout = shop.searchPageLayout || [];
    
    return (
        <main>
            <Canvas
                layout={layout}
                products={products}
                shopSlug={shop.slug}
                contextData={{ searchQuery: query }}
                isEditable={false}
            />
        </main>
    );
}

export default async function SearchPage({ params, searchParams }: { params: { slug: string }, searchParams: { q: string } }) {
    return (
        <Suspense fallback={<div>Loading search results...</div>}>
            <SearchResults slug={params.slug} query={searchParams.q} />
        </Suspense>
    );
}
