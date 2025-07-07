
import { notFound } from 'next/navigation';
import { getEcommShopBySlug, getPublicEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { LayoutGrid } from 'lucide-react';

export default async function ShopPage({ params }: { params: { slug: string } }) {
    if (!params.slug) {
        notFound();
    }

    const shop = await getEcommShopBySlug(params.slug);

    if (!shop) {
        notFound();
    }
    
    const products = await getPublicEcommProducts(shop._id.toString());
    const homepageLayout = shop.homepageLayout || [];
    
    return (
        <main>
            {homepageLayout.length > 0 ? (
                <Canvas
                    layout={homepageLayout}
                    products={products}
                    shopSlug={shop.slug}
                    isEditable={false}
                />
            ) : (
                <div className="text-center py-24 text-muted-foreground">
                    <LayoutGrid className="mx-auto h-12 w-12 text-muted-foreground/50"/>
                    <h1 className="mt-4 text-2xl font-semibold">{shop.name}</h1>
                    <p className="mt-2 text-sm">This shop is under construction. Come back soon!</p>
                </div>
            )}
        </main>
    );
}
