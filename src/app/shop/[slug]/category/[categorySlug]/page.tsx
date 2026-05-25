import { notFound } from 'next/navigation';
import { getEcommShopBySlug, getPublicEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { Suspense } from 'react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
    { params }: { params: Promise<{ slug: string, categorySlug: string }> }
): Promise<Metadata> {
    const { categorySlug } = await params;
    const categoryName = categorySlug.replace(/-/g, ' ');
    return {
        title: `${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} - Shop Category`,
        description: `Browse our amazing selection of ${categoryName}`,
    };
}

async function CategoryContent({ slug, categorySlug }: { slug: string, categorySlug: string }) {
    const shop = await getEcommShopBySlug(slug);
    if (!shop) {
        notFound();
    }

    const products = await getPublicEcommProducts(shop._id.toString(), { category: categorySlug });
    const layout = shop.categoryPageLayout || [];
    const categoryName = categorySlug.replace(/-/g, ' ');

    return (
        <main>
            {layout.length > 0 ? (
                <Canvas
                    layout={layout}
                    products={products}
                    shopSlug={shop.slug}
                    contextData={{ categoryName }}
                    isEditable={false}
                />
            ) : (
                 <div className="text-center py-24 text-muted-foreground">
                    <h1 className="mt-4 text-2xl font-semibold capitalize">{categoryName}</h1>
                </div>
            )}
        </main>
    );
}

export default async function CategoryPage(props: { params: Promise<{ slug: string, categorySlug: string }> }) {
    const params = await props.params;
    
    return (
        <Suspense fallback={<div className="py-24 text-center animate-pulse">Loading category...</div>}>
            <CategoryContent slug={params.slug} categorySlug={params.categorySlug} />
        </Suspense>
    );
}
