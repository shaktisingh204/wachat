

import { notFound } from 'next/navigation';
import { getPublicEcommProductById, getEcommShopById } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { notFound } from 'next/navigation';

export default async function ProductDetailPage({ params }: { params: { productId: string, slug: string }}) {
    const product = await getPublicEcommProductById(params.productId);
    if (!product) {
        notFound();
    }

    const shop = await getEcommShopById(product.shopId.toString());
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

    