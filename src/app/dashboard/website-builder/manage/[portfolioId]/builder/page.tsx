

import { WebsiteBuilder } from '@/components/wabasimplify/website-builder/website-builder';
import { getSiteById, getWebsitePages } from '@/app/actions/portfolio.actions';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/context/cart-context';

export const dynamic = 'force-dynamic';

export default async function WebsiteBuilderPage({ params }: { params: { portfolioId: string } }) {
    const [site, pages] = await Promise.all([
        getSiteById(params.portfolioId),
        getWebsitePages(params.portfolioId),
    ]);

    if (!site) {
        notFound();
    }

    return (
        <CartProvider>
            <WebsiteBuilder shop={site as any} initialPages={pages} availableProducts={[]} />
        </CartProvider>
    );
}
