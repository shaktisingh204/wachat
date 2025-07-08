

import { notFound } from 'next/navigation';
import { getPublicEcommProductById, getPublicEcommShopById } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';

export default async function ProductDetailPage({ params }: { params: { productId: string, slug: string }}) {
    const product = await getPublicEcommProductById(params.productId);
    if (!product) {
        notFound();
    }

    const shop = await getPublicEcommShopById(product.shopId.toString());
    if (!shop || shop.slug !== params.slug) {
        notFound();
    }

    if (!shop.productPageLayout || shop.productPageLayout.length === 0) {
        return <div className="p-8 text-center">Product page layout not configured for this shop.</div>;
    }
    
    return (
        <Canvas
            layout={shop.productPageLayout}
            products={[]}
            shopSlug={shop.slug}
            contextData={{ product }}
            isEditable={false}
        />
    );
}
