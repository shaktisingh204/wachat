

import { WebsiteBuilder } from '@/components/wabasimplify/website-builder/website-builder';
import { getEcommShopById, getEcommPages, getEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { notFound } from 'next/navigation';

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

    return <WebsiteBuilder shop={shop} initialPages={pages} availableProducts={products} />;
}
