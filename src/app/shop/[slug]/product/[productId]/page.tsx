import { notFound } from 'next/navigation';
import { getPublicEcommProductById, getPublicEcommShopById } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/zoruui-domain/website-builder/canvas';
import { Suspense } from 'react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
    { params }: { params: Promise<{ productId: string, slug: string }> }
): Promise<Metadata> {
    const { productId } = await params;
    const product = await getPublicEcommProductById(productId);
    if (!product) return { title: 'Product Not Found' };
    
    return {
        title: product.name,
        description: product.description || `Buy ${product.name} at our store`,
    };
}

async function ProductContent({ productId, slug }: { productId: string, slug: string }) {
    const product = await getPublicEcommProductById(productId);
    if (!product) {
        notFound();
    }

    const shop = await getPublicEcommShopById(product.shopId.toString());
    if (!shop || shop.slug !== slug) {
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

export default async function ProductDetailPage(props: { params: Promise<{ productId: string, slug: string }>}) {
    const params = await props.params;
    
    return (
        <Suspense fallback={<div className="p-8 text-center animate-pulse">Loading product details...</div>}>
            <ProductContent productId={params.productId} slug={params.slug} />
        </Suspense>
    );
}
