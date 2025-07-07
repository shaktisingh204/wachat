
import { WebsiteBuilder } from '@/components/wabasimplify/website-builder/website-builder';
import { getEcommShopById, getEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WebsiteBuilderPage({ params }: { params: { shopId: string } }) {
    const [shop, products] = await Promise.all([
        getEcommShopById(params.shopId),
        getEcommProducts(params.shopId)
    ]);

    if (!shop) {
        notFound();
    }

    return <WebsiteBuilder shop={shop} availableProducts={products} />;
}
