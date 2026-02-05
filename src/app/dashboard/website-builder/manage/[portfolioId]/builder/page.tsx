

import { WebsiteBuilder } from '@/components/wabasimplify/website-builder/website-builder';
import { getSiteById, getWebsitePages } from '@/app/actions/portfolio.actions';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/context/cart-context';

export const dynamic = 'force-dynamic';

export default async function WebsiteBuilderPage({ params }: { params: Promise<{ portfolioId: string }> }) {
    const resolvedParams = await params;
    const [site, pages] = await Promise.all([
        getSiteById(resolvedParams.portfolioId),
        getWebsitePages(resolvedParams.portfolioId),
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
