
import { notFound } from 'next/navigation';
import { getEcommShopBySlug, getPublicEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { BlockRenderer } from '@/components/wabasimplify/website-builder/block-renderer';

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
        <main className="flex flex-col items-center">
            {homepageLayout.length > 0 ? (
                homepageLayout.map(block => <BlockRenderer key={block.id} block={block} products={products} shopSlug={shop.slug} isEditable={false} />)
            ) : (
                <div className="text-center py-24">
                    <h1 className="text-4xl font-bold">{shop.name}</h1>
                    <p className="text-lg text-muted-foreground mt-4">This shop is under construction. Come back soon!</p>
                </div>
            )}
        </main>
    );
}
