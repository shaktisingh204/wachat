

import { WebsiteBuilder } from '@/components/wabasimplify/website-builder/website-builder';
import { getEcommShopById, getEcommPages, getEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/context/cart-context';

export const dynamic = 'force-dynamic';

export default async function WebsiteBuilderPage({ params }: { params: { shopId: string } }) {
    const [shop, pages, products] = await Promise.all([
        getEcommShopById(params.shopId),
        getEcommPages(params.shopId),
        getEcommProducts(params.shopId)
    ]);

    if (!shop) {
        notFound();
    }

    return (
        <CartProvider>
            <WebsiteBuilder shop={shop} initialPages={pages} availableProducts={products} />
        </CartProvider>
    );
}
