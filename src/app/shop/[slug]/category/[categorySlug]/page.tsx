import { notFound } from 'next/navigation';
import { getEcommShopBySlug, getPublicEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { LayoutGrid } from 'lucide-react';

export default async function CategoryPage({ params }: { params: { slug: string, categorySlug: string } }) {
    const shop = await getEcommShopBySlug(params.slug);
    if (!shop) {
        notFound();
    }
    
    const products = await getPublicEcommProducts(shop._id.toString(), { category: params.categorySlug });
    const layout = shop.categoryPageLayout || [];
    
    return (
        <main>
            {layout.length > 0 ? (
                <Canvas
                    layout={layout}
                    products={products}
                    shopSlug={shop.slug}
                    contextData={{ categoryName: params.categorySlug.replace(/-/g, ' ') }}
                    isEditable={false}
                />
            ) : (
                 <div className="text-center py-24 text-muted-foreground">
                    <h1 className="mt-4 text-2xl font-semibold capitalize">{params.categorySlug.replace(/-/g, ' ')}</h1>
                </div>
            )}
        </main>
    );
}
